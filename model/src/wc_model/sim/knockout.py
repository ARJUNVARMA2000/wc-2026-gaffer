"""Ingest played 2026 knockout results and map them onto the bracket.

The sim's own third-place allocation (`assign_thirds`) is a modelling choice
that already diverged from FIFA's real allocation once (predicted GER-BIH,
actual GER-PAR), so the actual bracket is LEARNED from the dataset instead:
every R32 row is anchored by a team occupying a deterministic winner/runner-up
slot (every R32 match has at least one), and the row's other team pins the
remaining slot. Winners then propagate up the tree; R16+ rows are matched
against feeder winners. Drawn matches (scores include extra time) are decided
by shootouts.csv; a later-round fixture row can also reveal a drawn feeder's
winner when the shootout data lags.

Bad data never crashes the build: unmappable/conflicting rows are skipped with
a warning and the sim simply stays probabilistic where reality isn't known.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple

import pandas as pd

from ..data.results import load_results, load_shootouts, world_cup_2026
from . import bracket_2026 as B

# match_no -> (feeder_a, feeder_b). THIRD_PLACE takes the LOSERS of the SFs.
FEEDERS: Dict[int, Tuple[int, int]] = {
    **B.R16, **B.QF, **B.SF, B.FINAL: (101, 102), B.THIRD_PLACE: (101, 102),
}
R32_SLOTS: Dict[str, Tuple[int, str]] = {}   # slot -> (match_no, other_slot)
for _m, _sa, _sb in B.R32:
    R32_SLOTS[_sa] = (_m, _sb)
    R32_SLOTS[_sb] = (_m, _sa)


@dataclass
class KOMatch:
    match_no: int                     # 73..104 (103 = third place)
    round: str                        # B.ROUND_OF[match_no]
    home: str
    away: str
    date: str                         # "YYYY-MM-DD"
    city: str
    country: str
    neutral: bool
    played: bool
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    winner: Optional[str] = None      # None if unplayed, or drawn w/o shootout data
    pens: bool = False                # winner decided on penalties


@dataclass
class KnockoutState:
    # R32 slot code ("1E"/"2C"/"T74") -> team. Seeded from unambiguous computed
    # standings, then overridden/completed by CSV-anchored rows (learns actual
    # third-place placements; also resolves standings ties from reality).
    slot_occupants: Dict[str, str] = field(default_factory=dict)
    matches: Dict[int, KOMatch] = field(default_factory=dict)
    unmapped: List[dict] = field(default_factory=list)

    def winners(self) -> Dict[int, str]:
        """Decided winners that condition the sim (the 3P match isn't modelled)."""
        return {m: km.winner for m, km in self.matches.items()
                if km.winner is not None and m != B.THIRD_PLACE}

    def drawn_pending(self) -> Set[int]:
        """Played draws whose shootout winner isn't known yet (excl. 3P)."""
        return {m for m, km in self.matches.items()
                if km.played and km.winner is None and m != B.THIRD_PLACE}

    def known_pairings(self) -> Dict[int, Tuple[str, str]]:
        """Every KO match whose two participants are known: from a mapped row,
        from both R32 slots being occupied, or from both feeder winners (losers
        for the 3P match)."""
        out: Dict[int, Tuple[str, str]] = {}
        for m, km in self.matches.items():
            out[m] = (km.home, km.away)
        for m, sa, sb in B.R32:
            if m not in out and sa in self.slot_occupants and sb in self.slot_occupants:
                out[m] = (self.slot_occupants[sa], self.slot_occupants[sb])
        wins = self.winners()
        for m, (fa, fb) in FEEDERS.items():
            if m in out:
                continue
            a = self._loser(fa) if m == B.THIRD_PLACE else wins.get(fa)
            b = self._loser(fb) if m == B.THIRD_PLACE else wins.get(fb)
            if a and b:
                out[m] = (a, b)
        return out

    def _loser(self, m: int) -> Optional[str]:
        km = self.matches.get(m)
        if km is None or km.winner is None:
            return None
        return km.away if km.winner == km.home else km.home

    def validate(self) -> List[str]:
        """Invariant re-check; returns human-readable warnings (empty = clean)."""
        warns: List[str] = []
        seen: Dict[str, str] = {}
        for slot, team in self.slot_occupants.items():
            if team in seen:
                warns.append(f"team {team} occupies both {seen[team]} and {slot}")
            seen[team] = slot
        for m, km in self.matches.items():
            if km.winner is not None and km.winner not in (km.home, km.away):
                warns.append(f"match {m}: winner {km.winner} not a participant")
            fa_fb = FEEDERS.get(m)
            if fa_fb and m != B.THIRD_PLACE:
                expect = {w for w in (self.winners().get(fa_fb[0]),
                                      self.winners().get(fa_fb[1])) if w}
                if expect and not expect <= {km.home, km.away}:
                    warns.append(f"match {m}: participants {km.home}/{km.away} "
                                 f"don't include feeder winners {expect}")
        return warns


def final_group_standings(group_df: pd.DataFrame) -> Dict[str, List[Optional[str]]]:
    """Final standings per group: letter -> [1st, 2nd, 3rd, 4th].

    A position is None when the group isn't fully played or when the pts/GD/GF
    key ties exactly at that boundary (FIFA's deeper tiebreakers — head-to-head
    among the tied, fair play, lots — aren't computable here; the CSV-anchor
    pass learns such slots from reality instead).
    """
    played = group_df[group_df["played"]]
    stand: Dict[str, List[Optional[str]]] = {}
    for g, teams in B.GROUPS.items():
        rows = played[played["home_team"].isin(teams) & played["away_team"].isin(teams)]
        if len(rows) < 6:
            stand[g] = [None, None, None, None]
            continue
        rec = {t: [0, 0, 0] for t in teams}          # [pts, gd, gf]
        for r in rows.itertuples(index=False):
            hg, ag = int(r.home_score), int(r.away_score)
            rec[r.home_team][1] += hg - ag
            rec[r.away_team][1] += ag - hg
            rec[r.home_team][2] += hg
            rec[r.away_team][2] += ag
            if hg > ag:
                rec[r.home_team][0] += 3
            elif ag > hg:
                rec[r.away_team][0] += 3
            else:
                rec[r.home_team][0] += 1
                rec[r.away_team][0] += 1
        order = sorted(teams, key=lambda t: rec[t], reverse=True)
        pos: List[Optional[str]] = []
        for i, t in enumerate(order):
            tied = (i > 0 and rec[order[i - 1]] == rec[t]) or \
                   (i + 1 < len(order) and rec[order[i + 1]] == rec[t])
            pos.append(None if tied else t)
        stand[g] = pos
    return stand


def _warn(state: KnockoutState, row: dict, reason: str) -> None:
    print(f"  WARN knockout: {reason}: {row['date']} {row['home']} v {row['away']}")
    state.unmapped.append({**row, "reason": reason})


def build_knockout_state(df: Optional[pd.DataFrame] = None,
                         shootouts: Optional[pd.DataFrame] = None) -> KnockoutState:
    """Map every 2026 KO row in the dataset onto the bracket. Never raises on
    bad data — see module docstring."""
    if df is None:
        df = load_results()
    if shootouts is None:
        shootouts = load_shootouts()
    group_df = world_cup_2026(df, "group")
    ko_df = world_cup_2026(df, "ko")

    state = KnockoutState()
    standings = final_group_standings(group_df)
    for g, pos in standings.items():
        if pos[0]:
            state.slot_occupants[f"1{g}"] = pos[0]
        if pos[1]:
            state.slot_occupants[f"2{g}"] = pos[1]
    third_of = {g: pos[2] for g, pos in standings.items() if pos[2]}

    so_winner: Dict[Tuple[str, str, str], str] = {}
    for r in shootouts.itertuples(index=False):
        d = r.date.strftime("%Y-%m-%d")
        so_winner[(d, r.home_team, r.away_team)] = r.winner
        so_winner[(d, r.away_team, r.home_team)] = r.winner

    rows = []
    for r in ko_df.sort_values("date").itertuples(index=False):
        rows.append({
            "date": r.date.strftime("%Y-%m-%d"),
            "home": r.home_team, "away": r.away_team,
            "city": getattr(r, "city", ""), "country": getattr(r, "country", ""),
            "neutral": bool(r.neutral), "played": bool(r.played),
            "hg": int(r.home_score) if bool(r.played) else None,
            "ag": int(r.away_score) if bool(r.played) else None,
        })

    def decide(row: dict) -> Tuple[Optional[str], bool]:
        if not row["played"]:
            return None, False
        if row["hg"] > row["ag"]:
            return row["home"], False
        if row["ag"] > row["hg"]:
            return row["away"], False
        w = so_winner.get((row["date"], row["home"], row["away"]))
        if w is not None and w not in (row["home"], row["away"]):
            print(f"  WARN knockout: shootout winner {w} not a participant of "
                  f"{row['home']} v {row['away']}; treating as undecided")
            return None, False
        return w, w is not None

    def add_match(m: int, row: dict) -> None:
        winner, pens = decide(row)
        state.matches[m] = KOMatch(
            match_no=m, round=B.ROUND_OF[m], home=row["home"], away=row["away"],
            date=row["date"], city=row["city"], country=row["country"],
            neutral=row["neutral"], played=row["played"],
            home_score=row["hg"], away_score=row["ag"], winner=winner, pens=pens,
        )

    # ---- R32 pass: anchor rows via deterministic slot occupants (date order) ----
    occ_of = {team: slot for slot, team in state.slot_occupants.items()}
    pending: List[dict] = []
    for row in rows:
        sh, sa = occ_of.get(row["home"]), occ_of.get(row["away"])
        mh = R32_SLOTS[sh][0] if sh else None
        ma = R32_SLOTS[sa][0] if sa else None
        if mh is None and ma is None:
            pending.append(row)                      # R16+ row, or standings gap
            continue
        if mh is not None and ma is not None and mh != ma:
            pending.append(row)                      # both anchored elsewhere: R16+ row
            continue
        m = mh if mh is not None else ma
        anchor_slot = sh if mh is not None else sa
        other_team = row["away"] if anchor_slot == sh else row["home"]
        other_slot = R32_SLOTS[anchor_slot][1]
        known_other = state.slot_occupants.get(other_slot)
        if m in state.matches:
            # R32 match already claimed by an earlier row -> this is a later-round
            # row whose team happens to be an R32 seed. Defer to the feeder pass.
            pending.append(row)
            continue
        if known_other is not None and known_other != other_team:
            # Anchor says match m, but m's other slot holds someone else: this is
            # a later-round pairing (e.g. Canada-Morocco after Canada played 73).
            pending.append(row)
            continue
        if known_other is None:
            if other_slot.startswith("T"):
                slot_no = int(other_slot[1:])
                grp = next((g for g, t in third_of.items() if t == other_team), None)
                if grp is None or grp not in B.THIRD_ELIGIBILITY[slot_no]:
                    print(f"  WARN knockout: learned {other_team} in {other_slot} "
                          f"contradicts eligibility/standings; accepting CSV as truth")
            state.slot_occupants[other_slot] = other_team
            occ_of[other_team] = other_slot
        add_match(m, row)

    # ---- R16+ fixpoint: match remaining rows against feeder winners; a fixture
    # row can reveal a drawn feeder's winner (shootout-data lag). ----
    def participant(m: int, third: bool) -> Optional[str]:
        return state._loser(m) if third else state.winners().get(m)

    progress = True
    while progress and pending:
        progress = False
        for row in pending[:]:
            pair = {row["home"], row["away"]}
            placed = False
            for m, (fa, fb) in FEEDERS.items():
                if m in state.matches:
                    continue
                third = m == B.THIRD_PLACE
                wa, wb = participant(fa, third), participant(fb, third)
                if wa and wb:
                    if {wa, wb} == pair:
                        add_match(m, row)
                        placed = True
                        break
                    continue
                # one side known: infer the drawn other feeder's winner from this row
                known, open_feeder = (wa, fb) if wa else (wb, fa)
                if known is None or known not in pair or third:
                    continue
                other_team = (pair - {known}).pop()
                fkm = state.matches.get(open_feeder)
                if fkm is not None and fkm.played and fkm.winner is None \
                        and other_team in (fkm.home, fkm.away):
                    fkm.winner = other_team
                    fkm.pens = True       # drawn after ET, so it went to penalties
                    print(f"  note knockout: match {open_feeder} winner "
                          f"{other_team} inferred from the match-{m} fixture row")
                    add_match(m, row)
                    placed = True
                    break
            if placed:
                pending.remove(row)
                progress = True

    for row in pending:
        _warn(state, row, "unmappable knockout row")
    return state
