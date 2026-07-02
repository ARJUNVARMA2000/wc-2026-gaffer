"""sim.simulate — vectorized Monte Carlo tournament simulation."""

import numpy as np
import pytest

from conftest import DummyModel, _wc2026_rows, make_results_df
from wc_model.sim import bracket_2026 as B
from wc_model.sim.simulate import SLOT_ORDER, build_thirds_lut, load_group_fixtures, simulate

N_SIMS = 2000
LETTERS = "ABCDEFGHIJKL"


@pytest.fixture(scope="module")
def wc_df():
    return make_results_df(_wc2026_rows())


@pytest.fixture(scope="module")
def model():
    # Mild strength spread so favourites are distinguishable but nothing is certain.
    return DummyModel(strengths={"Spain": 1.6, "Argentina": 1.4, "New Zealand": 0.7})


@pytest.fixture(scope="module")
def sim(model, wc_df):
    return simulate(model, n_sims=N_SIMS, seed=99, df=wc_df)


class TestThirdsLut:
    def test_populated_only_for_8_group_masks(self):
        lut = build_thirds_lut()
        assert lut.shape == (1 << 12, 8)
        assert (lut[0b000011111111] >= 0).all()          # ABCDEFGH qualifies
        assert (lut[0b000001111111] == -1).all()         # only 7 groups set
        assert (lut[0] == -1).all()

    def test_assignments_respect_eligibility(self):
        lut = build_thirds_lut()
        mask = 0b000011111111  # groups A-H
        for k, slot in enumerate(SLOT_ORDER):
            g = LETTERS[int(lut[mask][k])]
            assert g in B.THIRD_ELIGIBILITY[slot]


class TestLoadGroupFixtures:
    def test_six_fixtures_per_group_none_played(self, model, wc_df):
        fixtures, played = load_group_fixtures(model, wc_df)
        assert played == 0
        assert set(fixtures) == set(LETTERS)
        for g, fxs in fixtures.items():
            assert len(fxs) == 6
            for fx in fxs:
                assert not fx.played
                assert fx.dist is not None
                assert fx.dist.sum() == pytest.approx(1.0)

    def test_played_matches_are_fixed(self, model):
        rows = _wc2026_rows()
        rows[0]["home_score"], rows[0]["away_score"] = 3, 1
        fixtures, played = load_group_fixtures(model, make_results_df(rows))
        assert played == 1
        fx = next(f for fxs in fixtures.values() for f in fxs if f.played)
        assert (fx.hg, fx.ag) == (3, 1)
        assert fx.dist is None


class TestSimulate:
    def test_champion_probabilities_sum_to_one(self, sim):
        assert sim.champion.sum() == pytest.approx(1.0)
        assert (sim.champion >= 0).all()

    def test_round_totals_match_bracket_capacity(self, sim):
        expected = {"R32": 32, "R16": 16, "QF": 8, "SF": 4, "Final": 2}
        for r, total in expected.items():
            assert sim.rounds[r].sum() == pytest.approx(total)

    def test_rounds_monotonic_per_team(self, sim):
        seq = [sim.rounds[r] for r in ("R32", "R16", "QF", "SF", "Final")] + [sim.champion]
        for earlier, later in zip(seq, seq[1:]):
            assert (earlier >= later - 1e-12).all()

    def test_group_win_sums_to_one(self, sim):
        for g in LETTERS:
            assert sim.group_win[g].sum() == pytest.approx(1.0)

    def test_group_advance_between_two_and_three_per_group(self, sim):
        # 2 automatic qualifiers + at most 1 best-third per group.
        for g in LETTERS:
            adv = sim.group_advance[g]
            assert ((adv >= 0) & (adv <= 1)).all()
            assert 2.0 - 1e-9 <= adv.sum() <= 3.0 + 1e-9

    def test_match_win_distributions(self, sim):
        assert len(sim.match_win) == 31  # 16 + 8 + 4 + 2 + final
        for dist in sim.match_win.values():
            assert dist.sum() == pytest.approx(1.0)

    def test_slot_occupancy_counts(self, sim):
        assert len(sim.slots) == 32
        for counts in sim.slots.values():
            assert counts.sum() == pytest.approx(N_SIMS)

    def test_win_matrix_complementary(self, sim):
        w = sim.win
        off_diag = ~np.eye(len(sim.teams), dtype=bool)
        np.testing.assert_allclose((w + w.T)[off_diag], 1.0, atol=1e-9)

    def test_opponent_counts_consistent(self, sim):
        assert sim.opp["R32"].sum() == 32 * N_SIMS
        np.testing.assert_array_equal(sim.opp["R32"], sim.opp["R32"].T)

    def test_strong_team_beats_weak_team_odds(self, sim):
        t = {name: i for i, name in enumerate(sim.teams)}
        assert sim.champion[t["Spain"]] > sim.champion[t["New Zealand"]]
        assert sim.rounds["R32"][t["Spain"]] > 0.9

    def test_deterministic_for_a_seed(self, model, wc_df):
        a = simulate(model, n_sims=400, seed=7, df=wc_df)
        b = simulate(model, n_sims=400, seed=7, df=wc_df)
        np.testing.assert_array_equal(a.champion, b.champion)


class TestLiveConditioning:
    def test_played_group_is_frozen(self, model):
        rows = _wc2026_rows()
        group_a = set(B.GROUPS["A"])
        for r in rows:
            if r["home_team"] in group_a and r["away_team"] in group_a:
                if r["home_team"] == "Mexico":
                    r["home_score"], r["away_score"] = 2, 0
                elif r["away_team"] == "Mexico":
                    r["home_score"], r["away_score"] = 0, 2
                else:
                    r["home_score"], r["away_score"] = 1, 1
        sim = simulate(model, n_sims=500, seed=3, df=make_results_df(rows))
        # Mexico won group A in every simulation; 9 points is a certainty.
        assert sim.group_win["A"][0] == pytest.approx(1.0)
        assert sim.exp_points["A"][0] == pytest.approx(9.0)
        mex = sim.teams.index("Mexico")
        assert sim.rounds["R32"][mex] == pytest.approx(1.0)
