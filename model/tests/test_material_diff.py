"""material_diff — volatile-field stripping and the material/volatile verdict."""

import json

from wc_model.material_diff import (
    VOLATILE_FIELDS,
    WATCH_PATHS,
    material_change,
    strip_volatile,
)


def _j(obj) -> str:
    return json.dumps(obj)


class TestStripVolatile:
    def test_meta_last_updated(self):
        obj = {"lastUpdated": "2026-06-28T17:31:15Z", "nSims": 50000}
        assert strip_volatile("web/public/data/meta.json", obj) == {"nSims": 50000}

    def test_history_generated_at_and_snapshot_ts(self):
        obj = {
            "generatedAt": "t0",
            "snapshots": [
                {"ts": "t1", "date": "2026-06-18", "teams": {"Spain": {"c": 0.11}}},
                {"ts": "t2", "date": "2026-06-19", "teams": {"Spain": {"c": 0.12}}},
            ],
            "movers": {},
        }
        out = strip_volatile("model/data/output/history.json", obj)
        assert "generatedAt" not in out
        assert all("ts" not in s for s in out["snapshots"])
        assert out["snapshots"][1]["teams"]["Spain"]["c"] == 0.12  # payload kept

    def test_predictions_log_snapshot_at(self):
        obj = {
            "2026-06-20|Spain|Uruguay": {"pHome": 0.5, "snapshotAt": "t1"},
            "2026-06-21|France|Norway": {"pHome": 0.6, "snapshotAt": "t2"},
        }
        out = strip_volatile("web/public/data/predictions_log.json", obj)
        assert all("snapshotAt" not in v for v in out.values())
        assert out["2026-06-20|Spain|Uruguay"]["pHome"] == 0.5

    def test_scorecard_meta_generated_at(self):
        obj = {"meta": {"generatedAt": "t", "nScored": 44}, "pnl": {}}
        out = strip_volatile("web/public/data/scorecard.json", obj)
        assert out["meta"] == {"nScored": 44}

    def test_unknown_file_untouched(self):
        obj = {"lastUpdated": "t", "champion": 0.15}
        assert strip_volatile("web/public/data/teams.json", dict(obj)) == obj

    def test_missing_fields_are_fine(self):
        assert strip_volatile("meta.json", {"nSims": 1}) == {"nSims": 1}
        assert strip_volatile("history.json", {"snapshots": []}) == {"snapshots": []}


class TestMaterialChange:
    def test_timestamp_only_change_is_not_material(self):
        old = _j({"lastUpdated": "t1", "nSims": 50000, "homeAdv": 1.259})
        new = _j({"lastUpdated": "t2", "nSims": 50000, "homeAdv": 1.259})
        assert material_change("web/public/data/meta.json", old, new) is False

    def test_real_meta_change_is_material(self):
        old = _j({"lastUpdated": "t1", "groupMatchesPlayed": 70})
        new = _j({"lastUpdated": "t2", "groupMatchesPlayed": 72})
        assert material_change("web/public/data/meta.json", old, new) is True

    def test_probability_change_in_teams_is_material(self):
        old = _j([{"name": "Spain", "champion": 0.1131}])
        new = _j([{"name": "Spain", "champion": 0.1198}])
        assert material_change("web/public/data/teams.json", old, new) is True

    def test_identical_teams_not_material(self):
        body = _j([{"name": "Spain", "champion": 0.1131}])
        assert material_change("web/public/data/teams.json", body, body) is False

    def test_key_order_and_whitespace_ignored(self):
        old = '{"a": 1, "b": 2}'
        new = '{\n  "b": 2,\n  "a": 1\n}'
        assert material_change("web/public/data/groups.json", old, new) is False

    def test_snapshot_at_only_change_not_material(self):
        old = _j({"k": {"pHome": 0.5, "snapshotAt": "t1"}})
        new = _j({"k": {"pHome": 0.5, "snapshotAt": "t2"}})
        assert material_change("predictions_log.json", old, new) is False

    def test_non_json_change_is_material(self):
        assert material_change("some/file.csv", "a,b\n1,2\n", "a,b\n1,3\n") is True

    def test_broken_json_is_material(self):
        assert material_change("web/public/data/meta.json", "{", "{}") is True


class TestConfig:
    def test_watch_paths_cover_the_committed_data(self):
        assert "model/data/output" in WATCH_PATHS
        assert "web/public/data" in WATCH_PATHS

    def test_every_volatile_spec_is_wellformed(self):
        for name, paths in VOLATILE_FIELDS.items():
            assert name.endswith(".json")
            for p in paths:
                assert isinstance(p, tuple) and all(isinstance(seg, str) for seg in p)
