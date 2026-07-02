"""goals.blend — confederation-aware squad-value adjustment."""

import pytest

from wc_model.config import VALUE_GAP_CLIP, VALUE_WEIGHT_CROSS, VALUE_WEIGHT_SAME
from wc_model.goals.blend import build_blend
from wc_model.goals.strength import GoalStrength

TEAMS = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"]
CONFED = {
    "Alpha": "UEFA",
    "Beta": "UEFA",
    "Gamma": "CONMEBOL",
    "Delta": "CONMEBOL",
    "Epsilon": "AFC",
    "Zeta": "AFC",
}


@pytest.fixture
def gs() -> GoalStrength:
    return GoalStrength(
        atk={"Alpha": 1.4, "Beta": 1.1, "Gamma": 1.0, "Delta": 0.9, "Epsilon": 0.85, "Zeta": 0.75},
        dfn={"Alpha": 0.9, "Beta": 1.1, "Gamma": 1.2, "Delta": 1.3, "Epsilon": 1.4, "Zeta": 1.5},
        home_adv=1.25,
        avg_goals=1.3,
        teams=list(TEAMS),
    )


@pytest.fixture
def values() -> dict:
    # Market values loosely tracking strength (EUR).
    return {
        "Alpha": 1.2e9,
        "Beta": 6.0e8,
        "Gamma": 4.0e8,
        "Delta": 2.5e8,
        "Epsilon": 1.0e8,
        "Zeta": 4.0e7,
    }


class TestNoValues:
    def test_empty_values_is_a_no_op(self, gs):
        model = build_blend(gs, CONFED, {})
        assert model.gap == {}
        assert model.reg == (0.0, 0.0)
        for h, a in [("Alpha", "Zeta"), ("Gamma", "Beta")]:
            assert model.expected_goals(h, a) == pytest.approx(gs.expected_goals(h, a))

    def test_fewer_than_five_values_disables_regression(self, gs):
        model = build_blend(gs, CONFED, {"Alpha": 1e9, "Beta": 5e8})
        assert model.reg == (0.0, 0.0)


class TestWeights:
    def test_same_vs_cross_confederation(self, gs, values):
        model = build_blend(gs, CONFED, values)
        assert model._weight("Alpha", "Beta") == VALUE_WEIGHT_SAME
        assert model._weight("Alpha", "Gamma") == VALUE_WEIGHT_CROSS
        assert model._weight("Nowhere", "Alpha") == VALUE_WEIGHT_CROSS  # UNK != UEFA


class TestGap:
    def test_gap_is_clipped(self, gs, values):
        model = build_blend(gs, CONFED, values)
        assert set(model.gap) == set(values)
        for d in model.gap.values():
            assert -VALUE_GAP_CLIP <= d <= VALUE_GAP_CLIP

    def test_adjustment_preserves_total_goals(self, gs, values):
        """The value nudge is supremacy-only: atk*f, dfn/f keeps lh*la invariant."""
        blended = build_blend(gs, CONFED, values)
        plain = build_blend(gs, CONFED, {})
        for h, a in [("Alpha", "Gamma"), ("Beta", "Zeta"), ("Delta", "Epsilon")]:
            lb = blended.lambdas(h, a)
            lp = plain.lambdas(h, a)
            assert lb[0] * lb[1] == pytest.approx(lp[0] * lp[1])


class TestLambdas:
    def test_adv_team_multiplies_only_that_side(self, gs, values):
        model = build_blend(gs, CONFED, values)
        base = model.lambdas("Alpha", "Gamma", adv_team=None)
        home = model.lambdas("Alpha", "Gamma", adv_team="Alpha")
        away = model.lambdas("Alpha", "Gamma", adv_team="Gamma")
        assert home[0] == pytest.approx(model.home_adv * base[0])
        assert home[1] == pytest.approx(base[1])
        assert away[1] == pytest.approx(model.home_adv * base[1])
        assert away[0] == pytest.approx(base[0])

    def test_expected_goals_neutral_matches_lambdas(self, gs, values):
        model = build_blend(gs, CONFED, values)
        assert model.expected_goals("Alpha", "Gamma", neutral=True) == model.lambdas(
            "Alpha", "Gamma", adv_team=None
        )

    def test_properties_pass_through(self, gs, values):
        model = build_blend(gs, CONFED, values)
        assert model.home_adv == gs.home_adv
        assert model.avg_goals == gs.avg_goals
