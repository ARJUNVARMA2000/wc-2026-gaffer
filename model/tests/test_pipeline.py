"""pipeline pure helpers + the predictions-log / history upsert logic."""

import pytest

from conftest import (
    DummyModel,
    ko_row,
    make_results_df,
    make_shootouts_df,
    wc2026_all_played_rows,
)
from wc_model import history as hist
from wc_model import predictions_log as plog
from wc_model.data.results import world_cup_2026
from wc_model.pipeline import (
    _bracket_feeders,
    _inorder_matches,
    _slot_label,
    build_matches,
    current_standings,
    round_robin_scores,
)
from wc_model.sim import bracket_2026 as B
from wc_model.sim.knockout import build_knockout_state


class TestCurrentStandings:
    def test_points_and_goal_difference(self):
        df = make_results_df(
            [
                {"home_team": "Mexico", "away_team": "South Africa",
                 "home_score": 2, "away_score": 0, "tournament": "FIFA World Cup",
                 "date": "2026-06-11"},
                {"home_team": "South Korea", "away_team": "Czech Republic",
                 "home_score": 1, "away_score": 1, "tournament": "FIFA World Cup",
                 "date": "2026-06-11"},
                # unplayed -> ignored
                {"home_team": "Mexico", "away_team": "South Korea",
                 "tournament": "FIFA World Cup", "date": "2026-06-18"},
                # unknown side -> ignored
                {"home_team": "Elbonia", "away_team": "Mexico",
                 "home_score": 9, "away_score": 0, "tournament": "FIFA World Cup",
                 "date": "2026-06-12"},
            ]
        )
        rec = current_standings(df)
        assert rec["Mexico"] == {"played": 1, "points": 3, "gf": 2, "ga": 0, "gd": 2}
        assert rec["South Africa"] == {"played": 1, "points": 0, "gf": 0, "ga": 2, "gd": -2}
        assert rec["South Korea"]["points"] == 1
        assert rec["Czech Republic"]["points"] == 1
        assert "Elbonia" not in rec

    def test_all_48_teams_present_even_before_kickoff(self):
        rec = current_standings(make_results_df([{"home_team": "X", "away_team": "Y"}]))
        assert len(rec) == 48
        assert all(r["played"] == 0 for r in rec.values())

    def test_knockout_rematches_never_count(self):
        # Both teams are known WC teams, but from different groups — a played
        # knockout row must not leak into group standings.
        rec = current_standings(make_results_df(
            [ko_row("2026-06-29", "Germany", "Paraguay", 1, 1)]
        ))
        assert rec["Germany"]["played"] == 0
        assert rec["Paraguay"]["played"] == 0


class TestBuildMatches:
    NO_SO = make_shootouts_df([])

    def _build(self, ko_rows, plog_dict=None):
        df = make_results_df(wc2026_all_played_rows() + ko_rows)
        ko = build_knockout_state(df, self.NO_SO)
        group_df = world_cup_2026(df, "group")
        return build_matches(group_df, ko, DummyModel(), plog_dict or {})

    def test_group_rows_keep_their_schema(self):
        out = self._build([])
        group_rows = [m for m in out if m.get("group")]
        assert len(group_rows) == 72
        for m in group_rows:
            assert "round" not in m and "matchNo" not in m
            assert m["played"] and "modelProb" in m

    def test_played_ko_row_shape(self):
        out = self._build([ko_row("2026-06-29", "Germany", "Sweden", 1, 1)])
        m = next(r for r in out if r.get("matchNo") == 74)
        assert m["round"] == "R32" and m["group"] is None
        assert (m["homeScore"], m["awayScore"]) == (1, 1)
        assert "pens" not in m                      # drawn, shootout winner unknown
        assert 0 < m["modelProb"] < 1

    def test_pens_metadata(self):
        df = make_results_df(wc2026_all_played_rows()
                             + [ko_row("2026-06-29", "Germany", "Sweden", 1, 1)])
        so = make_shootouts_df([{"date": "2026-06-29", "home_team": "Germany",
                                 "away_team": "Sweden", "winner": "Sweden"}])
        ko = build_knockout_state(df, so)
        out = build_matches(world_cup_2026(df, "group"), ko, DummyModel(), {})
        m = next(r for r in out if r.get("matchNo") == 74)
        assert m["pens"] is True and m["penWinner"] == "Sweden"

    def test_unplayed_fixture_row_gets_projection_and_advance_prob(self):
        out = self._build([ko_row("2026-06-29", "Germany", "Sweden")])
        m = next(r for r in out if r.get("matchNo") == 74)
        assert not m["played"]
        assert "projHome" in m and "likelyHome" in m
        assert m["advHome"] == pytest.approx(m["pHome"] + 0.5 * m["pDraw"], abs=1e-3)

    def test_known_pairing_without_row_is_synthesized_from_schedule(self):
        out = self._build([
            ko_row("2026-06-29", "Germany", "Sweden", 2, 0),   # 74 decided
            ko_row("2026-06-30", "France", "Haiti", 1, 0),     # 77 decided
        ])                                                     # no row for R16 match 89
        m = next(r for r in out if r.get("matchNo") == 89)
        assert (m["home"], m["away"]) == ("Germany", "France")
        assert m["round"] == "R16" and not m["played"]
        assert (m["date"], m["city"]) == B.KO_SCHEDULE[89][:2]

    def test_frozen_prematch_probs_are_preferred(self):
        key = "2026-06-29|Germany|Sweden"
        out = self._build([ko_row("2026-06-29", "Germany", "Sweden", 2, 0)],
                          plog_dict={key: {"pHome": 0.7, "pDraw": 0.2, "pAway": 0.1}})
        m = next(r for r in out if r.get("matchNo") == 74)
        assert (m["pHome"], m["frozen"], m["modelProb"]) == (0.7, True, 0.7)


class TestRoundRobinScores:
    def test_bounds_and_ordering(self):
        model = DummyModel(strengths={"Big": 1.5, "Mid": 1.0, "Small": 0.7})
        rr = round_robin_scores(model, ["Big", "Mid", "Small"])
        assert set(rr) == {"Big", "Mid", "Small"}
        for v in rr.values():
            assert 0.0 <= v <= 3.0
        assert rr["Big"] > rr["Mid"] > rr["Small"]


class TestBracketHelpers:
    def test_slot_labels(self):
        assert _slot_label("1E") == "Winner Grp E"
        assert _slot_label("2B") == "Runner-up Grp B"
        assert _slot_label("T74") == "3rd place"

    def test_feeders_cover_every_non_r32_match(self):
        feeders = _bracket_feeders()
        assert set(feeders) == set(B.R16) | set(B.QF) | set(B.SF) | {B.FINAL}
        assert feeders[B.FINAL] == (101, 102)

    def test_inorder_walk_visits_every_match_once(self):
        seq = _inorder_matches()
        assert len(seq) == len(set(seq)) == 31
        by_round = {}
        for m in seq:
            by_round.setdefault(B.ROUND_OF[m], []).append(m)
        assert {r: len(ms) for r, ms in by_round.items()} == {
            "R32": 16, "R16": 8, "QF": 4, "SF": 2, "Final": 1,
        }

    def test_inorder_walk_shape(self):
        seq = _inorder_matches()
        r32 = {m for m, _, _ in B.R32}
        # leaves (R32) sit at the even positions of an in-order tree walk,
        # and the final is the root, dead centre.
        assert all((seq[i] in r32) == (i % 2 == 0) for i in range(len(seq)))
        assert seq[15] == B.FINAL


def _match(date, home, away, played, p=0.4):
    m = {"date": date, "home": home, "away": away, "played": played}
    if not played:
        m.update({"pHome": p, "pDraw": 0.3, "pAway": round(0.7 - p, 3),
                  "projHome": 1.4, "projAway": 1.1})
    return m


class TestPredictionsLog:
    def test_upserts_unplayed_only(self):
        matches = [
            _match("2026-06-20", "Spain", "Uruguay", played=False),
            {"date": "2026-06-11", "home": "Mexico", "away": "South Africa",
             "played": True, "pHome": 0.6, "pDraw": 0.2, "pAway": 0.2},
        ]
        log = plog.update_log(matches, prev={}, when="2026-06-19T00:00:00Z")
        assert list(log) == ["2026-06-20|Spain|Uruguay"]
        entry = log["2026-06-20|Spain|Uruguay"]
        assert entry["pHome"] == 0.4
        assert entry["snapshotAt"] == "2026-06-19T00:00:00Z"

    def test_played_matches_freeze(self):
        prev = {"2026-06-11|Mexico|South Africa": {"pHome": 0.55, "snapshotAt": "old"}}
        matches = [{"date": "2026-06-11", "home": "Mexico", "away": "South Africa",
                    "played": True, "pHome": 0.99}]
        log = plog.update_log(matches, prev=prev, when="2026-06-19T00:00:00Z")
        assert log["2026-06-11|Mexico|South Africa"]["pHome"] == 0.55  # untouched

    def test_missing_probs_skipped(self):
        matches = [{"date": "2026-06-20", "home": "A", "away": "B",
                    "played": False, "pHome": None}]
        assert plog.update_log(matches, prev={}, when="x") == {}

    def test_pure_does_not_mutate_prev(self):
        prev = {}
        plog.update_log([_match("2026-06-20", "A", "B", played=False)], prev=prev, when="x")
        assert prev == {}


def _teams_snapshot(champ_spain: float):
    rows = []
    for name, c in (("Spain", champ_spain), ("Argentina", 0.15), ("Brazil", 0.09)):
        rows.append({"name": name, "champion": c, "final": c + 0.1, "sf": c + 0.2,
                     "qf": c + 0.3, "r16": c + 0.4, "ko": c + 0.5, "elo": 2000.0})
    return rows


class TestHistory:
    def test_first_snapshot(self):
        meta = {"lastUpdated": "2026-06-19T06:00:00Z", "dataThrough": "2026-06-18",
                "groupMatchesPlayed": 10}
        out = hist.update_history(_teams_snapshot(0.11), meta, prev=[])
        assert len(out["snapshots"]) == 1
        snap = out["snapshots"][0]
        assert snap["ts"] == "2026-06-19T06:00:00Z"
        assert snap["date"] == "2026-06-18"
        assert snap["teams"]["Spain"]["c"] == 0.11
        assert out["movers"]["sinceStart"]["champ"] == {"risers": [], "fallers": []}

    def test_same_results_state_replaces_last_snapshot(self):
        meta = {"lastUpdated": "t1", "dataThrough": "2026-06-18", "groupMatchesPlayed": 10}
        out1 = hist.update_history(_teams_snapshot(0.11), meta, prev=[])
        meta2 = dict(meta, lastUpdated="t2")
        out2 = hist.update_history(_teams_snapshot(0.12), meta2, prev=out1["snapshots"])
        assert len(out2["snapshots"]) == 1
        assert out2["snapshots"][0]["ts"] == "t2"
        assert out2["snapshots"][0]["teams"]["Spain"]["c"] == 0.12

    def test_new_results_state_appends_and_computes_movers(self):
        meta1 = {"lastUpdated": "t1", "dataThrough": "2026-06-18", "groupMatchesPlayed": 10}
        meta2 = {"lastUpdated": "t2", "dataThrough": "2026-06-19", "groupMatchesPlayed": 14}
        out1 = hist.update_history(_teams_snapshot(0.10), meta1, prev=[])
        out2 = hist.update_history(_teams_snapshot(0.16), meta2, prev=out1["snapshots"])
        assert len(out2["snapshots"]) == 2
        risers = out2["movers"]["sinceLast"]["champ"]["risers"]
        assert risers and risers[0]["name"] == "Spain"
        assert risers[0]["delta"] == pytest.approx(0.06)
