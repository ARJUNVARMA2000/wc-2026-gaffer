"""knockout.py: standings, R32 anchor mapping, pens, fixpoint, state methods."""

from __future__ import annotations

from conftest import ko_row, make_results_df, make_shootouts_df, wc2026_all_played_rows
from wc_model.sim import bracket_2026 as B
from wc_model.sim.knockout import (
    KnockoutState,
    KOMatch,
    build_knockout_state,
    final_group_standings,
)

NO_SHOOTOUTS = make_shootouts_df([])


def state_for(ko_rows: list[dict], shootouts=None) -> KnockoutState:
    df = make_results_df(wc2026_all_played_rows() + ko_rows)
    return build_knockout_state(df, shootouts if shootouts is not None else NO_SHOOTOUTS)


class TestFinalGroupStandings:
    def test_full_group_orders_by_points(self, wc2026_all_played):
        stand = final_group_standings(wc2026_all_played)
        # deterministic scores: draw order = finish order, in every group
        for g, ts in B.GROUPS.items():
            assert stand[g] == ts

    def test_unplayed_group_is_all_none(self, wc2026_df):
        stand = final_group_standings(wc2026_df)
        assert all(pos == [None] * 4 for pos in stand.values())

    def test_exact_tie_blanks_the_tied_positions(self):
        t0, t1, t2, t3 = B.GROUPS["A"]
        rows = [
            ko_row("2026-06-11", t0, t2, 1, 0), ko_row("2026-06-11", t0, t3, 1, 0),
            ko_row("2026-06-12", t1, t2, 1, 0), ko_row("2026-06-12", t1, t3, 1, 0),
            ko_row("2026-06-13", t0, t1, 0, 0), ko_row("2026-06-13", t2, t3, 1, 1),
        ]
        stand = final_group_standings(make_results_df(rows))
        # t0/t1 and t2/t3 have identical pts/gd/gf keys -> unknowable here
        assert stand["A"] == [None, None, None, None]


class TestR32Anchoring:
    def test_anchor_learns_third_place_slot(self):
        # 1E Germany anchors match 74; Sweden (3rd of F, eligible) fills T74
        st = state_for([ko_row("2026-06-29", "Germany", "Sweden", 2, 0)])
        assert st.slot_occupants["T74"] == "Sweden"
        km = st.matches[74]
        assert (km.round, km.winner, km.pens) == ("R32", "Germany", False)
        assert st.winners()[74] == "Germany"
        assert not st.unmapped

    def test_both_slots_deterministic(self):
        # 73 = 2A v 2B = South Africa v Bosnia under the synthetic standings
        st = state_for([ko_row("2026-06-28", "South Africa", "Bosnia and Herzegovina", 1, 0)])
        assert st.matches[73].winner == "South Africa"

    def test_ineligible_third_is_accepted_with_csv_as_truth(self, capsys):
        # Iran is 3rd of G — not eligible for T74 — but the dataset is authoritative
        st = state_for([ko_row("2026-06-29", "Germany", "Iran", 0, 1)])
        assert st.slot_occupants["T74"] == "Iran"
        assert st.matches[74].winner == "Iran"
        assert "contradicts eligibility" in capsys.readouterr().out

    def test_conflicting_anchors_row_is_skipped(self):
        # Germany anchors 74, France anchors 77 -> not an R32 pairing, and with
        # neither feeder decided it cannot be an R16 row either
        st = state_for([ko_row("2026-07-04", "Germany", "France")])
        assert 74 not in st.matches and 77 not in st.matches
        assert len(st.unmapped) == 1

    def test_unknown_teams_are_unmapped(self):
        st = state_for([ko_row("2026-06-29", "Wales", "Poland", 1, 0)])
        assert st.unmapped and st.unmapped[0]["reason"] == "unmappable knockout row"


class TestPens:
    def test_drawn_match_decided_by_shootout(self):
        so = make_shootouts_df(
            [{"date": "2026-06-29", "home_team": "Germany", "away_team": "Sweden",
              "winner": "Sweden"}]
        )
        st = state_for([ko_row("2026-06-29", "Germany", "Sweden", 1, 1)], so)
        km = st.matches[74]
        assert (km.winner, km.pens) == ("Sweden", True)

    def test_shootout_lookup_tries_swapped_sides(self):
        so = make_shootouts_df(
            [{"date": "2026-06-29", "home_team": "Sweden", "away_team": "Germany",
              "winner": "Germany"}]
        )
        st = state_for([ko_row("2026-06-29", "Germany", "Sweden", 1, 1)], so)
        assert st.matches[74].winner == "Germany"

    def test_drawn_without_shootout_stays_pending(self):
        st = state_for([ko_row("2026-06-29", "Germany", "Sweden", 1, 1)])
        assert st.matches[74].winner is None
        assert st.drawn_pending() == {74}
        assert 74 not in st.winners()

    def test_non_participant_shootout_winner_ignored(self, capsys):
        so = make_shootouts_df(
            [{"date": "2026-06-29", "home_team": "Germany", "away_team": "Sweden",
              "winner": "Brazil"}]
        )
        st = state_for([ko_row("2026-06-29", "Germany", "Sweden", 1, 1)], so)
        assert st.matches[74].winner is None
        assert "not a participant" in capsys.readouterr().out


class TestFixpoint:
    R32_ROWS = [
        ko_row("2026-06-29", "Germany", "Sweden", 2, 0),    # 74
        ko_row("2026-06-30", "France", "Haiti", 1, 0),      # 77 (Haiti 3rd of C, eligible)
    ]

    def test_r16_row_maps_via_feeder_winners(self):
        st = state_for(self.R32_ROWS + [ko_row("2026-07-04", "Germany", "France", 0, 1)])
        km = st.matches[89]
        assert (km.round, km.winner) == ("R16", "France")

    def test_fixture_row_reveals_drawn_feeder_winner(self):
        rows = [
            ko_row("2026-06-29", "Germany", "Sweden", 1, 1),   # 74 drawn, pens lagging
            ko_row("2026-06-30", "France", "Haiti", 1, 0),     # 77 decided
            ko_row("2026-07-04", "France", "Germany"),          # R16 fixture names Germany
        ]
        st = state_for(rows)
        km74 = st.matches[74]
        assert (km74.winner, km74.pens) == ("Germany", True)
        assert st.matches[89].played is False
        assert not st.unmapped

    def test_duplicate_row_for_same_match_is_unmapped(self):
        st = state_for([
            ko_row("2026-06-29", "Germany", "Sweden", 2, 0),
            ko_row("2026-06-30", "Germany", "Sweden", 0, 2),
        ])
        assert st.matches[74].winner == "Germany"          # first by date wins
        assert len(st.unmapped) == 1

    def test_known_pairings_derive_from_feeder_winners(self):
        st = state_for(self.R32_ROWS)                       # no R16 row listed
        assert st.known_pairings()[89] == ("Germany", "France")


class TestStateMethods:
    def _km(self, m, home, away, winner):
        return KOMatch(match_no=m, round=B.ROUND_OF[m], home=home, away=away,
                       date="2026-07-18", city="", country="", neutral=True,
                       played=True, home_score=1, away_score=0, winner=winner)

    def test_third_place_match_never_conditions_the_sim(self):
        st = KnockoutState(matches={103: self._km(103, "Brazil", "France", "Brazil")})
        assert st.winners() == {}
        assert st.drawn_pending() == set()
        assert 103 in st.matches

    def test_validate_flags_bad_state(self):
        st = KnockoutState(
            slot_occupants={"1E": "Germany", "2C": "Germany"},
            matches={74: self._km(74, "Germany", "Sweden", "Brazil")},
        )
        warns = st.validate()
        assert any("occupies both" in w for w in warns)
        assert any("not a participant" in w for w in warns)