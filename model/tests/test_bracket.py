"""sim.bracket_2026 — official structure invariants + third-place assignment."""

from itertools import combinations

from wc_model.sim.bracket_2026 import (
    FINAL,
    GROUPS,
    HOSTS,
    QF,
    R16,
    R32,
    ROUND_OF,
    SF,
    THIRD_ELIGIBILITY,
    THIRD_PLACE,
    assign_thirds,
)

LETTERS = "ABCDEFGHIJKL"


class TestGroups:
    def test_twelve_groups_of_four(self):
        assert sorted(GROUPS) == list(LETTERS)
        assert all(len(ts) == 4 for ts in GROUPS.values())

    def test_48_unique_teams(self):
        teams = [t for ts in GROUPS.values() for t in ts]
        assert len(teams) == 48
        assert len(set(teams)) == 48

    def test_hosts_seeded_in_their_groups(self):
        assert GROUPS["A"][0] == "Mexico"
        assert GROUPS["B"][0] == "Canada"
        assert GROUPS["D"][0] == "United States"
        assert set(HOSTS) == {"Mexico", "Canada", "United States"}


class TestRound32:
    def test_sixteen_matches_numbered_73_to_88(self):
        assert len(R32) == 16
        assert sorted(m for m, _, _ in R32) == list(range(73, 89))

    def test_every_winner_and_runner_up_slot_used_once(self):
        slots = [s for _, a, b in R32 for s in (a, b)]
        assert len(slots) == len(set(slots)) == 32
        assert {s for s in slots if s.startswith("1")} == {f"1{g}" for g in LETTERS}
        assert {s for s in slots if s.startswith("2")} == {f"2{g}" for g in LETTERS}

    def test_third_place_slots_match_eligibility_table(self):
        t_slots = {int(s[1:]) for _, a, b in R32 for s in (a, b) if s.startswith("T")}
        assert t_slots == set(THIRD_ELIGIBILITY)
        assert len(t_slots) == 8


class TestKnockoutTree:
    def test_feeders_reference_previous_round(self):
        r32_nums = {m for m, _, _ in R32}
        assert all(fa in r32_nums and fb in r32_nums for fa, fb in R16.values())
        assert all(fa in R16 and fb in R16 for fa, fb in QF.values())
        assert all(fa in QF and fb in QF for fa, fb in SF.values())
        assert set(SF) == {101, 102}

    def test_each_winner_advances_exactly_once(self):
        fed = [f for pairs in (R16, QF, SF) for fs in pairs.values() for f in fs]
        assert len(fed) == len(set(fed))  # no match feeds two ties

    def test_round_of_covers_every_match(self):
        assert len(ROUND_OF) == 32  # 16 + 8 + 4 + 2 + final + third place
        assert ROUND_OF[FINAL] == "Final"
        assert ROUND_OF[THIRD_PLACE] == "ThirdPlace"
        for m, _, _ in R32:
            assert ROUND_OF[m] == "R32"


class TestAssignThirds:
    def test_valid_assignment_for_simple_combo(self):
        combo = list("ABCDEFGH")
        assign = assign_thirds(combo)
        assert assign is not None
        assert set(assign) == set(THIRD_ELIGIBILITY)
        assert sorted(assign.values()) == combo
        for slot, g in assign.items():
            assert g in THIRD_ELIGIBILITY[slot]

    def test_all_495_combinations_are_solvable(self):
        # FIFA's eligibility table admits a perfect matching for every possible
        # set of 8 best-third groups (this is what the sim's LUT relies on).
        for combo in combinations(LETTERS, 8):
            assign = assign_thirds(list(combo))
            assert assign is not None, combo
            assert sorted(assign.values()) == sorted(combo)
            for slot, g in assign.items():
                assert g in THIRD_ELIGIBILITY[slot]

    def test_input_not_mutated(self):
        combo = list("ABCDEFGH")
        assign_thirds(combo)
        assert combo == list("ABCDEFGH")
