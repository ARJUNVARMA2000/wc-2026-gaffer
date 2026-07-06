"""data.results / data.confederations / data.flags — ingestion and classification."""

import pandas as pd
import pytest

from wc_model.data.confederations import MANUAL_OVERRIDES, derive_confederations
from wc_model.data.flags import TEAM_ISO, iso
from wc_model.data.results import (
    classify_tournament,
    load_results,
    load_shootouts,
    world_cup_2026,
)
from wc_model.sim.bracket_2026 import GROUPS


class TestClassifyTournament:
    @pytest.mark.parametrize(
        ("tournament", "tier"),
        [
            ("FIFA World Cup", "world_cup"),
            ("FIFA World Cup qualification", "world_cup_qual"),
            ("Confederations Cup", "confederations"),
            ("UEFA Nations League", "nations_league"),
            ("UEFA Euro", "continental_final"),
            ("UEFA Euro qualification", "continental_qual"),
            ("Copa América", "continental_final"),
            ("Gold Cup", "continental_final"),
            ("Friendly", "friendly"),
            # long-tail fallbacks
            ("CECAFA Cup qualification", "continental_qual"),
            ("King's Cup", "minor_tournament"),
        ],
    )
    def test_known_labels(self, tournament, tier):
        assert classify_tournament(tournament) == tier

    def test_case_insensitive(self):
        assert classify_tournament("fifa world cup") == "world_cup"
        assert classify_tournament("FRIENDLY") == "friendly"


CSV = """date,home_team,away_team,home_score,away_score,tournament,city,country,neutral
2026-06-11,Mexico,South Africa,2,1,FIFA World Cup,Mexico City,Mexico,FALSE
2022-11-20,Qatar,Ecuador,0,2,FIFA World Cup,Al Khor,Qatar,FALSE
2026-06-18,Mexico,South Korea,,,FIFA World Cup,Guadalajara,Mexico,FALSE
2024-03-26,France,Chile,3,2,Friendly,Marseille,France,FALSE
2024-06-15,Spain,Croatia,3,0,UEFA Euro,Berlin,Germany,TRUE
"""


@pytest.fixture
def results_csv(tmp_path):
    p = tmp_path / "results.csv"
    p.write_text(CSV, encoding="utf-8")
    return p


class TestLoadResults:
    def test_types_and_derived_columns(self, results_csv):
        df = load_results(results_csv)
        assert pd.api.types.is_datetime64_any_dtype(df["date"])
        assert df["neutral"].dtype == bool
        assert len(df) == 5
        assert int(df["played"].sum()) == 4
        assert set(df["tier"]) == {"world_cup", "friendly", "continental_final"}

    def test_sorted_by_date(self, results_csv):
        df = load_results(results_csv)
        assert df["date"].is_monotonic_increasing

    def test_unplayed_matches_have_nan_scores(self, results_csv):
        df = load_results(results_csv)
        unplayed = df[~df["played"]]
        assert len(unplayed) == 1
        assert unplayed.iloc[0]["home_team"] == "Mexico"
        assert pd.isna(unplayed.iloc[0]["home_score"])

    def test_played_only_filters(self, results_csv):
        df = load_results(results_csv, played_only=True)
        assert df["played"].all()
        assert len(df) == 4

    def test_neutral_parsing(self, results_csv):
        df = load_results(results_csv)
        assert df.loc[df["home_team"] == "Spain", "neutral"].iloc[0]
        assert not df.loc[df["home_team"] == "France", "neutral"].iloc[0]


class TestWorldCup2026:
    def test_filters_to_2026_finals_only(self, results_csv):
        wc = world_cup_2026(load_results(results_csv))
        assert len(wc) == 2
        assert (wc["tournament"] == "FIFA World Cup").all()
        assert (wc["date"].dt.year == 2026).all()

    def test_stage_split(self, results_factory, capsys):
        df = results_factory(
            [
                # group game inside the window
                {"home_team": "Mexico", "away_team": "South Africa", "home_score": 2,
                 "away_score": 1, "tournament": "FIFA World Cup", "date": "2026-06-11"},
                # cross-group knockout after the window
                {"home_team": "Germany", "away_team": "Paraguay", "home_score": 1,
                 "away_score": 1, "tournament": "FIFA World Cup", "date": "2026-06-29"},
                # SAME-group pairing after the window = knockout rematch (e.g. a final)
                {"home_team": "Spain", "away_team": "Uruguay",
                 "tournament": "FIFA World Cup", "date": "2026-07-19"},
                # cross-group row INSIDE the group window: anomalous, in neither
                {"home_team": "Brazil", "away_team": "France", "home_score": 1,
                 "away_score": 0, "tournament": "FIFA World Cup", "date": "2026-06-15"},
            ]
        )
        assert len(world_cup_2026(df, "all")) == 4
        group = world_cup_2026(df, "group")
        assert list(group["home_team"]) == ["Mexico"]
        ko = world_cup_2026(df, "ko")
        assert set(ko["home_team"]) == {"Germany", "Spain"}
        assert "WARN" in capsys.readouterr().out  # the anomalous Brazil-France row

    def test_stage_rejects_unknown_value(self, results_factory):
        df = results_factory([{"home_team": "Mexico", "away_team": "South Africa",
                               "tournament": "FIFA World Cup", "date": "2026-06-11"}])
        with pytest.raises(ValueError):
            world_cup_2026(df, stage="knockout")


class TestLoadShootouts:
    def test_missing_file_yields_empty_typed_frame(self, tmp_path):
        df = load_shootouts(tmp_path / "nope.csv")
        assert list(df.columns) == ["date", "home_team", "away_team", "winner", "first_shooter"]
        assert len(df) == 0
        assert pd.api.types.is_datetime64_any_dtype(df["date"])

    def test_parses_dates(self, tmp_path):
        p = tmp_path / "shootouts.csv"
        p.write_text(
            "date,home_team,away_team,winner,first_shooter\n"
            "2026-06-29,Germany,Paraguay,Paraguay,Germany\n",
            encoding="utf-8",
        )
        df = load_shootouts(p)
        assert len(df) == 1
        assert df.iloc[0]["winner"] == "Paraguay"
        assert df.iloc[0]["date"].year == 2026


class TestDeriveConfederations:
    def test_inferred_from_tournaments_and_overrides(self, results_factory):
        df = results_factory(
            [
                {"home_team": "Chile", "away_team": "Peru", "home_score": 1, "away_score": 0,
                 "tournament": "Copa América"},
                {"home_team": "Japan", "away_team": "Qatar", "home_score": 2, "away_score": 2,
                 "tournament": "AFC Asian Cup"},
                {"home_team": "Elbonia", "away_team": "Ruritania", "home_score": 1, "away_score": 1,
                 "tournament": "Friendly"},
                # Australia's data history is ambiguous -> manual override wins.
                {"home_team": "Australia", "away_team": "Brazil", "home_score": 0, "away_score": 1,
                 "tournament": "Copa América"},
                {"home_team": "United States", "away_team": "Canada", "home_score": 1, "away_score": 0,
                 "tournament": "Friendly"},
            ]
        )
        confed = derive_confederations(df)
        assert confed["Chile"] == "CONMEBOL"
        assert confed["Peru"] == "CONMEBOL"
        assert confed["Japan"] == "AFC"
        assert confed["Elbonia"] == "UNK"
        assert confed["Australia"] == MANUAL_OVERRIDES["Australia"] == "AFC"
        assert confed["United States"] == "CONCACAF"

    def test_majority_vote(self, results_factory):
        rows = [
            {"home_team": "Wanderers", "away_team": "Chile", "home_score": 1, "away_score": 1,
             "tournament": "Copa América"},
        ]
        rows += [
            {"home_team": "Wanderers", "away_team": "Japan", "home_score": 0, "away_score": 0,
             "tournament": "AFC Asian Cup", "date": f"2024-0{i}-01"}
            for i in range(1, 4)
        ]
        confed = derive_confederations(results_factory(rows))
        assert confed["Wanderers"] == "AFC"


class TestFlags:
    def test_known_isos(self):
        assert iso("Brazil") == "br"
        assert iso("Scotland") == "gb-sct"
        assert iso("England") == "gb-eng"

    def test_unknown_team_gets_un(self):
        assert iso("Atlantis") == "un"

    def test_every_2026_team_has_a_flag(self):
        wc_teams = {t for ts in GROUPS.values() for t in ts}
        assert wc_teams <= set(TEAM_ISO)
