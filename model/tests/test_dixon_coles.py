"""goals.dixon_coles — scoreline matrix, outcome probabilities, sampling."""

import math

import numpy as np
import pytest

from wc_model.config import MAX_GOALS_GRID
from wc_model.goals.dixon_coles import (
    expected_points,
    most_likely_score,
    outcome_probs,
    sample_scoreline,
    scoreline_matrix,
)


def _poisson(lmbda: float, kmax: int) -> np.ndarray:
    return np.array([math.exp(-lmbda) * lmbda**k / math.factorial(k) for k in range(kmax + 1)])


class TestScorelineMatrix:
    def test_shape_and_normalisation(self):
        mat = scoreline_matrix(1.4, 1.1)
        assert mat.shape == (MAX_GOALS_GRID + 1, MAX_GOALS_GRID + 1)
        assert mat.sum() == pytest.approx(1.0)
        assert (mat >= 0).all()

    def test_rho_zero_reduces_to_independent_poisson(self):
        lh, la = 1.4, 1.1
        mat = scoreline_matrix(lh, la, rho=0.0)
        indep = np.outer(_poisson(lh, MAX_GOALS_GRID), _poisson(la, MAX_GOALS_GRID))
        indep /= indep.sum()
        np.testing.assert_allclose(mat, indep, atol=1e-12)

    def test_negative_rho_boosts_low_draws(self):
        # Dixon-Coles with rho < 0 inflates 0-0 (and 1-1) relative to independence.
        dc = scoreline_matrix(1.3, 1.1, rho=-0.05)
        indep = scoreline_matrix(1.3, 1.1, rho=0.0)
        assert dc[0, 0] > indep[0, 0]
        assert dc[1, 1] > indep[1, 1]

    def test_tiny_lambda_is_safe(self):
        mat = scoreline_matrix(0.0, 0.0)
        assert np.isfinite(mat).all()
        assert mat.sum() == pytest.approx(1.0)


class TestOutcomeProbs:
    def test_sums_to_one(self):
        h, d, a = outcome_probs(scoreline_matrix(1.5, 1.0))
        assert h + d + a == pytest.approx(1.0)

    def test_equal_lambdas_symmetric(self):
        h, _, a = outcome_probs(scoreline_matrix(1.2, 1.2))
        assert h == pytest.approx(a, abs=1e-9)

    def test_bigger_lambda_wins_more(self):
        h, _, a = outcome_probs(scoreline_matrix(2.2, 0.8))
        assert h > a


class TestMostLikelyScore:
    def test_is_the_matrix_argmax(self):
        mat = scoreline_matrix(0.5, 2.4)
        h, a, p = most_likely_score(mat)
        assert p == pytest.approx(float(mat.max()))
        assert mat[h, a] == pytest.approx(p)

    def test_lopsided_match_favours_away_goals(self):
        h, a, _ = most_likely_score(scoreline_matrix(0.4, 2.6))
        assert a > h


class TestExpectedPoints:
    def test_consistent_with_outcomes(self):
        mat = scoreline_matrix(1.6, 1.0)
        h, d, a = outcome_probs(mat)
        eh, ea = expected_points(mat)
        assert eh == pytest.approx(3 * h + d)
        assert ea == pytest.approx(3 * a + d)
        assert 0.0 <= eh <= 3.0 and 0.0 <= ea <= 3.0


class TestSampleScoreline:
    def test_within_grid_and_deterministic(self):
        mat = scoreline_matrix(1.4, 1.1)
        a = [sample_scoreline(mat, np.random.default_rng(7)) for _ in range(20)]
        b = [sample_scoreline(mat, np.random.default_rng(7)) for _ in range(20)]
        assert a == b
        for h, g in a:
            assert 0 <= h <= MAX_GOALS_GRID
            assert 0 <= g <= MAX_GOALS_GRID

    def test_empirical_mean_tracks_lambda(self):
        lh, la = 1.8, 0.9
        mat = scoreline_matrix(lh, la)
        rng = np.random.default_rng(42)
        draws = np.array([sample_scoreline(mat, rng) for _ in range(4000)], dtype=float)
        assert draws[:, 0].mean() == pytest.approx(lh, abs=0.15)
        assert draws[:, 1].mean() == pytest.approx(la, abs=0.15)
