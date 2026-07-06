"""Vectorized Monte Carlo simulation of the 2026 World Cup.

All N simulations run in parallel as NumPy arrays. Matches already played are
fixed to their real scoreline (live conditioning); the rest are drawn from the
Dixon-Coles goal model. Produces title odds, round-by-round advancement, group
qualification odds and expected group points.
"""

from __future__ import annotations

from dataclasses import dataclass
from itertools import combinations
from typing import TYPE_CHECKING, Dict, List, Optional

import numpy as np
import pandas as pd

from ..config import DEFAULT_N_SIMS
from ..data.results import world_cup_2026
from ..goals.dixon_coles import outcome_probs, scoreline_matrix
from . import bracket_2026 as B

if TYPE_CHECKING:
    from .knockout import KnockoutState

SLOT_ORDER = [74, 77, 79, 80, 81, 82, 85, 87]   # third-place slot match numbers
_GRID = None  # set to scoreline grid width lazily


# ---------------------------------------------------------------------------
# Precompute: third-place slot-assignment lookup table indexed by group bitmask
# ---------------------------------------------------------------------------
def build_thirds_lut() -> np.ndarray:
    """LUT[bitmask] -> array(8) of group indices (0-11) per slot in SLOT_ORDER.

    Only the C(12,8)=495 bitmasks with exactly 8 groups set are populated.
    """
    lut = np.full((1 << 12, 8), -1, dtype=np.int64)
    letters = "ABCDEFGHIJKL"
    for combo in combinations(range(12), 8):
        mask = 0
        for g in combo:
            mask |= (1 << g)
        assign = B.assign_thirds([letters[g] for g in combo])
        if assign is None:
            continue
        lut[mask] = [ord(assign[s]) - 65 for s in SLOT_ORDER]
    return lut


def _partial_thirds_lut(open_slots: tuple, pinned_groups: frozenset) -> np.ndarray:
    """build_thirds_lut for the sub-problem left once live results pin some
    third-place slots: LUT[bitmask of remaining qualified groups] -> group index
    per open slot. If eligibility is unsatisfiable for a combo (reality can pin
    awkwardly), fall back to any bijection — a duplicate-free bracket beats a
    crash, and the CSV overrides these slots as soon as their rows land.
    """
    letters = "ABCDEFGHIJKL"
    n_open = len(open_slots)
    lut = np.full((1 << 12, n_open), -1, dtype=np.int64)
    avail = [g for g in range(12) if g not in pinned_groups]
    for combo in combinations(avail, n_open):
        mask = 0
        for g in combo:
            mask |= (1 << g)
        assign = B.assign_thirds([letters[g] for g in combo], slots=list(open_slots))
        if assign is None:
            assign = {s: letters[g] for s, g in zip(open_slots, combo)}
        lut[mask] = [ord(assign[s]) - 65 for s in open_slots]
    return lut


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@dataclass
class Fixture:
    gi: int          # group-local index of home side
    gj: int          # group-local index of away side
    played: bool
    hg: int
    ag: int
    dist: Optional[np.ndarray]  # flattened scoreline distribution (unplayed)


def load_group_fixtures(model, df: Optional[pd.DataFrame] = None):
    """Return (group_fixtures, played_count). group_fixtures[letter] -> [Fixture].

    `model` is anything exposing lambdas(home, away, adv_team) -> (lh, la)
    (a BlendedModel; a plain GoalStrength works too via its expected_goals).
    """
    wc = world_cup_2026(df, stage="group")
    team_to_group = {t: g for g, ts in B.GROUPS.items() for t in ts}
    local_idx = {g: {t: i for i, t in enumerate(ts)} for g, ts in B.GROUPS.items()}

    fixtures: Dict[str, List[Fixture]] = {g: [] for g in B.GROUPS}
    played = 0
    for row in wc.itertuples(index=False):
        h, a = row.home_team, row.away_team
        g = team_to_group.get(h)
        if g is None or team_to_group.get(a) != g:
            continue  # not a group-stage match we recognise
        # host advantage: a host nation playing in its own country
        venue = getattr(row, "country", None)
        adv = h if (h in B.HOSTS and venue == h) else (a if (a in B.HOSTS and venue == a) else None)
        gi, gj = local_idx[g][h], local_idx[g][a]
        if bool(row.played):
            fixtures[g].append(Fixture(gi, gj, True, int(row.home_score), int(row.away_score), None))
            played += 1
        else:
            lh, la = model.lambdas(h, a, adv)
            dist = scoreline_matrix(lh, la).ravel()
            fixtures[g].append(Fixture(gi, gj, False, 0, 0, dist))
    return fixtures, played


# ---------------------------------------------------------------------------
# Simulation
# ---------------------------------------------------------------------------
@dataclass
class SimResult:
    teams: List[str]
    champion: np.ndarray      # P(win) per team
    rounds: Dict[str, np.ndarray]   # P(reach round) per team
    group_win: Dict[str, np.ndarray]
    group_advance: Dict[str, np.ndarray]
    exp_points: Dict[str, np.ndarray]
    n_sims: int
    # opponent co-occurrence counts per knockout round: opp[R][i,j] = #sims i faced j.
    # Row sum opp[R][i,:] == reach-count of i in round R, so opp[R][i]/rowsum is the
    # conditional opponent distribution given i reached round R.
    opp: Dict[str, np.ndarray] = None
    win: np.ndarray = None    # 48x48 knockout win-prob matrix win[i,j] = P(i beats j)
    # R32 slot occupancy: slots[slot][i] = #sims team i filled that slot (e.g. "1E", "2C", "T74").
    # argmax over a slot is the projected (modal) occupant — a self-consistent bracket.
    slots: Dict[str, np.ndarray] = None
    # Per knockout match: match_win[m][i] = P(team i WON match m) = P(i fills the slot that
    # match m feeds). Keyed by match number for every R32/R16/QF/SF match plus the final
    # (B.FINAL). Drives the forward-filled bracket's per-slot "who else could be here" hover.
    match_win: Dict[int, np.ndarray] = None


def simulate(model, n_sims: int = DEFAULT_N_SIMS, seed: int = 12345,
             df: Optional[pd.DataFrame] = None,
             ko: "Optional[KnockoutState]" = None) -> SimResult:
    global _GRID
    rng = np.random.default_rng(seed)
    teams = sorted({t for ts in B.GROUPS.values() for t in ts})
    tidx = {t: i for i, t in enumerate(teams)}
    nT = len(teams)

    # knockout win-probability matrix (neutral; draws -> 50/50 penalties)
    win = np.full((nT, nT), 0.5)
    for i, ti in enumerate(teams):
        for j, tj in enumerate(teams):
            if i == j:
                continue
            lh, la = model.lambdas(ti, tj, None)
            ph, pd_, pa = outcome_probs(scoreline_matrix(lh, la))
            win[i, j] = ph + 0.5 * pd_

    fixtures, played_count = load_group_fixtures(model, df)
    grid = fixtures["A"][0].dist
    _GRID = int(round(len(grid) ** 0.5)) if grid is not None else 11
    # find grid width from any unplayed fixture
    for g in fixtures.values():
        for fx in g:
            if fx.dist is not None:
                _GRID = int(round(len(fx.dist) ** 0.5))
                break

    N = n_sims
    letters = list(B.GROUPS.keys())
    # per-group finishing teams (global idx) and 3rd-place records
    winner_g, runner_g, third_g = {}, {}, {}
    third_pts = np.zeros((N, 12)); third_gd = np.zeros((N, 12)); third_gf = np.zeros((N, 12))
    third_team = np.zeros((N, 12), dtype=np.int64)

    # accumulators
    cnt = {r: np.zeros(nT) for r in ("R32", "R16", "QF", "SF", "Final", "Champion")}
    opp = {r: np.zeros((nT, nT), dtype=np.int64) for r in ("R32", "R16", "QF", "SF")}
    # per-R32-slot team occupancy counts (for the projected bracket)
    slot_cnt: Dict[str, np.ndarray] = {}
    for _m, _sa, _sb in B.R32:
        slot_cnt.setdefault(_sa, np.zeros(nT))
        slot_cnt.setdefault(_sb, np.zeros(nT))
    win_group = {g: np.zeros(4) for g in letters}
    pts_sum = {g: np.zeros(4) for g in letters}
    group_local_idx = {g: np.array([tidx[t] for t in B.GROUPS[g]]) for g in letters}

    for gli, g in enumerate(letters):
        gteams = B.GROUPS[g]
        gidx = np.array([tidx[t] for t in gteams])
        pts = np.zeros((N, 4)); gf = np.zeros((N, 4)); ga = np.zeros((N, 4))
        for fx in fixtures[g]:
            if fx.played:
                hg = np.full(N, fx.hg); ag = np.full(N, fx.ag)
            else:
                draws = rng.choice(fx.dist.size, size=N, p=fx.dist)
                hg = (draws // _GRID).astype(float); ag = (draws % _GRID).astype(float)
            i, j = fx.gi, fx.gj
            gf[:, i] += hg; ga[:, i] += ag; gf[:, j] += ag; ga[:, j] += hg
            hw = hg > ag; aw = ag > hg; dr = hg == ag
            pts[:, i] += 3 * hw + dr; pts[:, j] += 3 * aw + dr
        gd = gf - ga
        key = pts * 1e7 + (gd + 200) * 1e3 + gf + rng.random((N, 4)) * 1e-3
        order = np.argsort(-key, axis=1)                    # [N,4] local indices, best first
        rows = np.arange(N)
        win_local = order[:, 0]; run_local = order[:, 1]; thr_local = order[:, 2]
        winner_g[g] = gidx[win_local]; runner_g[g] = gidx[run_local]; third_g[g] = gidx[thr_local]
        third_team[:, gli] = gidx[thr_local]
        third_pts[:, gli] = pts[rows, thr_local]
        third_gd[:, gli] = gd[rows, thr_local]
        third_gf[:, gli] = gf[rows, thr_local]
        # group output tallies
        np.add.at(win_group[g], win_local, 1)
        for p in range(4):
            pts_sum[g][p] = pts[:, p].sum()

    # best third-placed teams -> third-place slots. Live knockout conditioning:
    # T-slots already pinned by real results take their actual occupant, and the
    # pinned teams' GROUPS are qualified-by-reality — excluded from the ranking
    # for the remaining slots, so a pinned team can never re-enter the bracket
    # through a second slot.
    letters_str = "ABCDEFGHIJKL"
    group_of_team = {t: gl for gl, ts in B.GROUPS.items() for t in ts}
    pinned: Dict[int, str] = {}                              # T-slot match_no -> team
    if ko is not None:
        for slot, team in ko.slot_occupants.items():
            if slot.startswith("T"):
                pinned[int(slot[1:])] = team

    key3 = third_pts * 1e7 + (third_gd + 200) * 1e3 + third_gf + rng.random((N, 12)) * 1e-3
    rows = np.arange(N)
    third_by_group = third_team.T                           # [12, N]
    slot_third: Dict[int, np.ndarray] = {
        s: np.full(N, tidx[t], dtype=np.int64) for s, t in pinned.items()
    }
    open_slots = [s for s in SLOT_ORDER if s not in pinned]
    if open_slots:
        if pinned:
            pinned_groups = frozenset(letters_str.index(group_of_team[t]) for t in pinned.values())
            key3[:, list(pinned_groups)] = -np.inf           # taken by reality
            lut = _partial_thirds_lut(tuple(open_slots), pinned_groups)
        else:
            lut = build_thirds_lut()
        n_open = len(open_slots)
        order3 = np.argsort(-key3, axis=1)
        top = order3[:, :n_open]                             # group indices (0-11)
        mask = np.zeros(N, dtype=np.int64)
        for k in range(n_open):
            mask |= (1 << top[:, k])
        assign = lut[mask]                                   # [N, n_open] group idx per slot
        for k, s in enumerate(open_slots):
            slot_third[s] = third_by_group[assign[:, k], rows]

    # Deterministic winner/runner-up slots pinned by real results (the sim's
    # random tie-break can diverge from FIFA's deeper criteria); decided
    # winners are forced; drawn matches awaiting shootout data stay a 50/50
    # coin per sim.
    fixed_slot: Dict[str, np.ndarray] = {}
    if ko is not None:
        for slot, team in ko.slot_occupants.items():
            if not slot.startswith("T"):
                fixed_slot[slot] = np.full(N, tidx[team], dtype=np.int64)
    forced = {} if ko is None else {m: tidx[t] for m, t in ko.winners().items()}
    coin = set() if ko is None else ko.drawn_pending()

    # resolve R32 slot -> team array
    def resolve(slot: str) -> np.ndarray:
        if slot in fixed_slot:
            return fixed_slot[slot]
        if slot.startswith("T"):
            return slot_third[int(slot[1:])]
        pos, gl = slot[0], slot[1]
        return winner_g[gl] if pos == "1" else runner_g[gl]

    def record_opp(R: str, ta: np.ndarray, tb: np.ndarray) -> None:
        # np.add.at (unbuffered) is required: ta/tb repeat team indices across sims.
        np.add.at(opp[R], (ta, tb), 1)
        np.add.at(opp[R], (tb, ta), 1)

    winners: Dict[int, np.ndarray] = {}
    match_win: Dict[int, np.ndarray] = {}   # m -> who-won-match-m histogram (fills next slot)

    def _record_winner(m: int, w: np.ndarray) -> None:
        winners[m] = w
        h = np.zeros(nT); np.add.at(h, w, 1); match_win[m] = h

    def settle(m: int, ta: np.ndarray, tb: np.ndarray) -> np.ndarray:
        if m in forced:                      # decided in reality
            w = np.full(N, forced[m], dtype=np.int64)
        elif m in coin:                      # played draw, shootout winner unknown yet
            w = np.where(rng.random(N) < 0.5, ta, tb)
        else:
            w = np.where(rng.random(N) < win[ta, tb], ta, tb)
        _record_winner(m, w)
        return w

    # R32
    for m, sa, sb in B.R32:
        ta, tb = resolve(sa), resolve(sb)
        np.add.at(cnt["R32"], ta, 1); np.add.at(cnt["R32"], tb, 1)
        np.add.at(slot_cnt[sa], ta, 1); np.add.at(slot_cnt[sb], tb, 1)
        record_opp("R32", ta, tb)
        settle(m, ta, tb)

    def play_round(pairs: Dict[int, tuple], reached_key: str):
        for m, (fa, fb) in pairs.items():
            ta, tb = winners[fa], winners[fb]
            np.add.at(cnt[reached_key], ta, 1); np.add.at(cnt[reached_key], tb, 1)
            if reached_key in opp:
                record_opp(reached_key, ta, tb)
            settle(m, ta, tb)

    play_round(B.R16, "R16")
    play_round(B.QF, "QF")
    play_round(B.SF, "SF")
    # final (winners of SF 101 vs 102)
    ta, tb = winners[101], winners[102]
    np.add.at(cnt["Final"], ta, 1); np.add.at(cnt["Final"], tb, 1)
    champ = settle(B.FINAL, ta, tb)
    np.add.at(cnt["Champion"], champ, 1)

    # group advancement (make knockouts) = share of R32 participants, per group team
    group_advance = {g: cnt["R32"][group_local_idx[g]] / N for g in letters}

    res = SimResult(
        teams=teams,
        champion=cnt["Champion"] / N,
        rounds={r: cnt[r] / N for r in ("R32", "R16", "QF", "SF", "Final")},
        group_win={g: win_group[g] / N for g in letters},
        group_advance=group_advance,
        exp_points={g: pts_sum[g] / N for g in letters},
        n_sims=N,
        opp=opp,
        win=win,
        slots=slot_cnt,
        match_win={m: v / N for m, v in match_win.items()},
    )
    return res
