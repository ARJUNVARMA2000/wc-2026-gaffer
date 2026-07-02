"""goals.strength — time-weighted Poisson attack/defense fit."""

import numpy as np
import pytest

from wc_model.goals.strength import GoalStrength, fit_goal_strength


@pytest.fixture(scope="module")
def league_df():
    """Deterministic 3-team league: Strong > Mid > Weak, repeated over 2023-24."""
    from conftest import make_results_df

    fixtures = [
        ("Strong", "Weak", 3, 0),
        ("Strong", "Mid", 2, 1),
        ("Mid", "Weak", 2, 1),
        ("Weak", "Strong", 0, 2),
        ("Mid", "Strong", 1, 1),
        ("Weak", "Mid", 1, 2),
    ]
    rows = []
    d = 0
    for month in range(1, 13):
        for h, a, hg, ag in fixtures:
            rows.append(
                {
                    "date": f"{2023 + (month > 6):d}-{((month - 1) % 12) + 1:02d}-{(d % 27) + 1:02d}",
                    "home_team": h,
                    "away_team": a,
                    "home_score": hg,
                    "away_score": ag,
                    "neutral": d % 3 == 0,
                }
            )
            d += 1
    return make_results_df(rows)


@pytest.fixture(scope="module")
def fitted(league_df) -> GoalStrength:
    return fit_goal_strength(league_df, since="2022-01-01", n_iter=60)


class TestFit:
    def test_covers_all_teams(self, fitted):
        assert set(fitted.teams) == {"Strong", "Mid", "Weak"}

    def test_attack_normalised_to_mean_one(self, fitted):
        assert np.mean(list(fitted.atk.values())) == pytest.approx(1.0, abs=1e-6)

    def test_orders_teams_correctly(self, fitted):
        assert fitted.atk["Strong"] > fitted.atk["Mid"] > fitted.atk["Weak"]
        # dfn is goals conceded per average attack: lower = better defense.
        assert fitted.dfn["Strong"] < fitted.dfn["Mid"] < fitted.dfn["Weak"]

    def test_home_advantage_at_least_one(self, fitted):
        assert fitted.home_adv >= 1.0

    def test_avg_goals_positive(self, fitted):
        assert fitted.avg_goals > 0


class TestExpectedGoals:
    def test_neutral_has_no_venue_boost(self, fitted):
        ln = fitted.expected_goals("Strong", "Weak", neutral=True)
        lh = fitted.expected_goals("Strong", "Weak", neutral=False)
        assert lh[0] == pytest.approx(fitted.home_adv * ln[0])
        assert lh[1] == pytest.approx(ln[1])

    def test_stronger_side_expects_more_goals(self, fitted):
        lh, la = fitted.expected_goals("Strong", "Weak", neutral=True)
        assert lh > la

    def test_unknown_team_gets_average_defaults(self, fitted):
        lh, la = fitted.expected_goals("Strong", "Nobody", neutral=True)
        assert lh == pytest.approx(fitted.atk["Strong"] * fitted.avg_goals)
        assert la == pytest.approx(1.0 * fitted.dfn["Strong"])


class TestStrengthVsField:
    def test_positive_and_ordered(self, fitted):
        field = list(fitted.teams)
        atk_s, dfn_s = fitted.strength_vs_field("Strong", field)
        atk_w, dfn_w = fitted.strength_vs_field("Weak", field)
        assert atk_s > 0 and dfn_s > 0
        assert atk_s > atk_w
        assert dfn_s < dfn_w
