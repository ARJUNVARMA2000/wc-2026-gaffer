"""ratings.elo — expected score, margin-of-victory weighting, rating updates."""

import math

import pytest

from wc_model.config import GOAL_DIFF_LOG_FACTOR, K_WEIGHTS, MAX_GOAL_DIFF_MULTIPLIER
from wc_model.ratings.elo import (
    expected_score,
    k_factor,
    mov_multiplier,
    update_ratings,
    win_draw_loss,
)


class TestExpectedScore:
    def test_even_matchup_is_half(self):
        assert expected_score(1500.0, 1500.0) == pytest.approx(0.5)

    def test_complementary(self):
        for a, b in [(1600, 1450), (2000, 1300), (1500, 1500)]:
            assert expected_score(a, b) + expected_score(b, a) == pytest.approx(1.0)

    def test_400_point_rule(self):
        # +400 Elo => 10:1 expected-score odds.
        assert expected_score(1900.0, 1500.0) == pytest.approx(10 / 11)

    def test_monotonic_in_rating_gap(self):
        probs = [expected_score(1500 + d, 1500) for d in (0, 50, 100, 200, 400)]
        assert probs == sorted(probs)
        assert all(0.0 < p < 1.0 for p in probs)


class TestMovMultiplier:
    def test_narrow_margins_are_neutral(self):
        assert mov_multiplier(0) == 1.0
        assert mov_multiplier(1) == 1.0
        assert mov_multiplier(-1) == 1.0

    def test_log_dampened_growth(self):
        assert mov_multiplier(2) == pytest.approx(math.log(3) * GOAL_DIFF_LOG_FACTOR + 1.0)
        assert mov_multiplier(3) == pytest.approx(math.log(4) * GOAL_DIFF_LOG_FACTOR + 1.0)
        assert mov_multiplier(2) < mov_multiplier(3) < mov_multiplier(4)

    def test_capped_for_blowouts(self):
        assert mov_multiplier(10) == MAX_GOAL_DIFF_MULTIPLIER
        assert mov_multiplier(50) == MAX_GOAL_DIFF_MULTIPLIER

    def test_sign_independent(self):
        for gd in (2, 3, 7):
            assert mov_multiplier(gd) == mov_multiplier(-gd)


class TestKFactor:
    def test_known_tiers(self):
        assert k_factor("world_cup") == K_WEIGHTS["world_cup"]
        assert k_factor("friendly") == K_WEIGHTS["friendly"]

    def test_unknown_tier_falls_back_to_minor(self):
        assert k_factor("no-such-tier") == K_WEIGHTS["minor_tournament"]


class TestUpdateRatings:
    def test_zero_sum(self):
        for neutral in (True, False):
            h, a = update_ratings(1600.0, 1450.0, 2, 1, tier="world_cup", neutral=neutral)
            assert (h - 1600.0) + (a - 1450.0) == pytest.approx(0.0)

    def test_winner_gains_loser_drops(self):
        h, a = update_ratings(1500.0, 1500.0, 1, 0, neutral=True)
        assert h > 1500.0 > a

    def test_upset_swings_more_than_expected_win(self):
        # Weak side beating the strong side moves ratings further than the reverse.
        _, weak_after_upset = update_ratings(1800.0, 1400.0, 0, 1, neutral=True)
        strong_after_norm, _ = update_ratings(1800.0, 1400.0, 1, 0, neutral=True)
        assert (weak_after_upset - 1400.0) > (strong_after_norm - 1800.0)

    def test_home_draw_costs_the_home_side(self):
        # Non-neutral venue: the home side was expected to do better than 0.5.
        h, a = update_ratings(1500.0, 1500.0, 1, 1, neutral=False)
        assert h < 1500.0 < a

    def test_neutral_draw_between_equals_changes_nothing(self):
        h, a = update_ratings(1500.0, 1500.0, 0, 0, neutral=True)
        assert h == pytest.approx(1500.0)
        assert a == pytest.approx(1500.0)


class TestWinDrawLoss:
    def test_probabilities_sum_to_one(self):
        for ra, rb in [(1500, 1500), (1700, 1450), (1300, 1900)]:
            w, d, ls = win_draw_loss(ra, rb)
            assert w + d + ls == pytest.approx(1.0)
            assert all(0.0 <= p <= 1.0 for p in (w, d, ls))

    def test_stronger_side_favoured(self):
        w, _, ls = win_draw_loss(1800.0, 1500.0)
        assert w > ls
