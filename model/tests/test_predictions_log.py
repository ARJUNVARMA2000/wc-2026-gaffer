"""predictions_log.py: R32 reconstruction math + host-advantage rule."""

from __future__ import annotations

from wc_model.predictions_log import _host_adv, _predict_from_params

# Minimal model.json-shaped params: two evenly matched teams, one confederation.
PARAMS = {
    "homeAdv": 1.25, "rho": -0.05, "wSame": 0.15, "wCross": 0.45,
    "teams": {
        "Mexico": {"atk": 1.30, "dfn": 1.00, "gap": 0.0, "confederation": "CONCACAF"},
        "Ecuador": {"atk": 1.20, "dfn": 1.05, "gap": 0.0, "confederation": "CONMEBOL"},
    },
}


class TestPredictFromParams:
    def test_probabilities_form_a_distribution(self):
        ph, pd_, pa, lh, la = _predict_from_params(PARAMS, "Mexico", "Ecuador", None)
        assert abs((ph + pd_ + pa) - 1.0) < 1e-9
        assert lh > 0 and la > 0

    def test_host_advantage_lifts_the_host(self):
        neutral = _predict_from_params(PARAMS, "Mexico", "Ecuador", None)
        hosted = _predict_from_params(PARAMS, "Mexico", "Ecuador", "Mexico")
        assert hosted[0] > neutral[0]      # Mexico's win prob rises when at home
        assert hosted[3] > neutral[3]      # ...driven by its own expected goals rising
        assert hosted[4] == neutral[4]     # opponent's expected goals are unchanged


class TestHostAdv:
    def test_host_in_own_country(self):
        assert _host_adv("Mexico", "Ecuador", "Mexico") == "Mexico"
        assert _host_adv("United States", "Bosnia", "United States") == "United States"

    def test_host_at_a_neutral_venue_gets_nothing(self):
        # Canada is a host but the tie is played in the USA.
        assert _host_adv("South Africa", "Canada", "United States") is None

    def test_no_host_in_the_tie(self):
        assert _host_adv("Spain", "Austria", "United States") is None
