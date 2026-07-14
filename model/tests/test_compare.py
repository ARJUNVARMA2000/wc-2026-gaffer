"""compare.py: scorecard join — knockout "advances" scoring + date-drift fallback."""

from __future__ import annotations

from wc_model.compare import build_scorecard

# One 3-way group market and one 2-way knockout "advances" market.
GROUP_KALSHI = {
    "Brazil | Chile": {
        "legs": {
            "Brazil": {"ask": 0.60, "bid": 0.58, "mid": 0.59},
            "Chile": {"ask": 0.25, "bid": 0.23, "mid": 0.24},
            "TIE": {"ask": 0.20, "bid": 0.18, "mid": 0.19},
        },
        "closeTime": "2026-06-20T22:00:00+00:00",
    },
}
ADV_KALSHI = {
    "Egypt | Ghana": {
        "legs": {
            "Ghana": {"ask": 0.55, "bid": 0.53, "mid": 0.54},
            "Egypt": {"ask": 0.50, "bid": 0.48, "mid": 0.49},
        },
        "closeTime": "2026-07-07T22:00:00+00:00",
    },
}


def _group_match():
    return {
        "date": "2026-06-20", "group": "A", "home": "Brazil", "away": "Chile",
        "homeIso": "br", "awayIso": "cl", "played": True, "homeScore": 2, "awayScore": 0,
    }


def _ko_match(date="2026-07-07"):
    # Ghana went through on penalties after a draw.
    return {
        "date": date, "round": "R16", "group": None, "home": "Egypt", "away": "Ghana",
        "homeIso": "eg", "awayIso": "gh", "played": True, "homeScore": 1, "awayScore": 1,
        "pens": True, "penWinner": "Ghana",
    }


def _pred(date, home, away, ph, pd, pa):
    return {date + "|" + home + "|" + away:
            {"date": date, "home": home, "away": away,
             "pHome": ph, "pDraw": pd, "pAway": pa}}


class TestKnockoutScoring:
    def test_ko_tie_folds_into_advances_row(self):
        m = _ko_match()
        log = _pred("2026-07-07", "Egypt", "Ghana", 0.40, 0.30, 0.30)
        sc = build_scorecard([m], log, {}, ADV_KALSHI)
        assert sc["meta"]["nKnockout"] == 1
        row = sc["ledger"][0]
        assert row["round"] == "R16"
        # advance prob = P(win) + ½·P(draw); draw leg zeroed
        assert row["gaffer"]["HOME"] == 0.55   # Egypt: 0.40 + 0.15
        assert row["gaffer"]["AWAY"] == 0.45   # Ghana: 0.30 + 0.15
        assert row["gaffer"]["DRAW"] == 0.0
        assert row["outcome"] == 2             # Ghana (away) advanced on pens

    def test_group_stays_three_way(self):
        m = _group_match()
        log = _pred("2026-06-20", "Brazil", "Chile", 0.62, 0.20, 0.18)
        sc = build_scorecard([m], log, GROUP_KALSHI, {})
        assert sc["meta"]["nGroup"] == 1 and sc["meta"]["nKnockout"] == 0
        assert sc["ledger"][0]["outcome"] == 0  # Brazil won 2-0


class TestDateDriftFallback:
    def test_prediction_logged_under_scheduled_date_still_joins(self):
        # Logged as the scheduled 07-06; the tie actually kicked off 07-07.
        m = _ko_match(date="2026-07-07")
        log = _pred("2026-07-06", "Egypt", "Ghana", 0.40, 0.30, 0.30)
        sc = build_scorecard([m], log, {}, ADV_KALSHI)
        assert sc["meta"]["nKnockout"] == 1
        assert sc["meta"]["skipped"]["noPrediction"] == 0

    def test_reversed_orientation_flips_probs(self):
        # Logged with the teams the other way round (Ghana at home).
        m = _ko_match(date="2026-07-07")
        log = _pred("2026-07-06", "Ghana", "Egypt", 0.30, 0.30, 0.40)  # pHome=Ghana
        sc = build_scorecard([m], log, {}, ADV_KALSHI)
        row = sc["ledger"][0]
        assert row["gaffer"]["HOME"] == 0.55   # Egypt re-oriented: 0.40 + 0.15
        assert row["gaffer"]["AWAY"] == 0.45   # Ghana: 0.30 + 0.15

    def test_beyond_tolerance_is_not_matched(self):
        m = _ko_match(date="2026-07-07")
        log = _pred("2026-06-25", "Egypt", "Ghana", 0.40, 0.30, 0.30)  # 12 days off
        sc = build_scorecard([m], log, {}, ADV_KALSHI)
        assert sc["meta"]["nKnockout"] == 0
        assert sc["meta"]["skipped"]["noPrediction"] == 1
