"""Dixon-Coles bivariate-Poisson scoreline distribution.

Plain independent Poisson under-counts low-scoring draws (0-0, 1-1). Dixon &
Coles (1997) correct the four lowest scorelines with a dependence parameter rho.
Everything the simulation and the website need about a single match is derived
from the resulting scoreline-probability matrix.
"""

from __future__ import annotations

import numpy as np

from ..config import DIXON_COLES_RHO, MAX_GOALS_GRID

_FACT = np.array([1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800], dtype=float)


def _poisson_pmf(lmbda: float, kmax: int) -> np.ndarray:
    k = np.arange(kmax + 1)
    return np.exp(-lmbda) * np.power(lmbda, k) / _FACT[: kmax + 1]


def _dc_tau(lh: float, la: float, rho: float, kmax: int) -> np.ndarray:
    """Multiplicative correction matrix for the four lowest scorelines."""
    tau = np.ones((kmax + 1, kmax + 1))
    tau[0, 0] = 1.0 - lh * la * rho
    tau[0, 1] = 1.0 + lh * rho
    tau[1, 0] = 1.0 + la * rho
    tau[1, 1] = 1.0 - rho
    return tau


def scoreline_matrix(
    lambda_home: float,
    lambda_away: float,
    rho: float = DIXON_COLES_RHO,
    max_goals: int = MAX_GOALS_GRID,
) -> np.ndarray:
    """(max+1)x(max+1) matrix P[h, a] = P(home scores h, away scores a)."""
    ph = _poisson_pmf(max(lambda_home, 1e-6), max_goals)
    pa = _poisson_pmf(max(lambda_away, 1e-6), max_goals)
    mat = np.outer(ph, pa) * _dc_tau(lambda_home, lambda_away, rho, max_goals)
    mat = np.clip(mat, 0.0, None)
    return mat / mat.sum()


def outcome_probs(mat: np.ndarray) -> tuple[float, float, float]:
    """(home_win, draw, away_win) from a scoreline matrix."""
    home = float(np.tril(mat, -1).sum())   # h > a
    draw = float(np.trace(mat))
    away = float(np.triu(mat, 1).sum())    # a > h
    return home, draw, away


def most_likely_score(mat: np.ndarray) -> tuple[int, int, float]:
    h, a = np.unravel_index(int(np.argmax(mat)), mat.shape)
    return int(h), int(a), float(mat[h, a])


def expected_points(mat: np.ndarray) -> tuple[float, float]:
    """Expected league points (3/1/0) for (home, away)."""
    h, d, a = outcome_probs(mat)
    return 3 * h + d, 3 * a + d


def sample_scoreline(mat: np.ndarray, rng: np.random.Generator) -> tuple[int, int]:
    """Draw a single scoreline from the matrix."""
    flat = mat.ravel()
    i = rng.choice(flat.size, p=flat)
    return int(i // mat.shape[1]), int(i % mat.shape[1])
