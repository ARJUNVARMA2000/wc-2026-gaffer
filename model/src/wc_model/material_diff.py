"""Decide whether a pipeline refresh actually changed the forecast.

Every run rewrites the data JSONs, but most hourly runs only bump volatile
timestamp fields (meta.lastUpdated, history.generatedAt, ...) while every
probability stays identical. Committing + rebuilding + deploying those runs
spams the git history and wastes CI minutes, so the update workflow gates its
commit/build/deploy steps on this module's verdict.

Usage (from the repo root, after the pipeline has run):

    PYTHONPATH=model/src python -m wc_model.material_diff

Compares the working tree against HEAD for the data paths the update workflow
commits. A changed JSON file counts as MATERIAL only if it still differs after
the known volatile timestamp fields are stripped from both sides; any non-JSON
change, new file, deletion or rename is material. Prints one line per changed
file and a final ``MATERIAL=true|false``; also appends ``material=true|false``
to ``$GITHUB_OUTPUT`` when that variable is set (for step gating). Exit code is
0 either way — the gate reads the output, not the exit code.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import PurePosixPath
from typing import Any, Iterable

# The paths the update workflow commits (kept in sync with update.yml's git add).
WATCH_PATHS = [
    "model/data/output",
    "web/public/data",
    "model/data/raw/transfermarkt_values.json",
    "model/data/raw/kalshi_wcgame.json",
]

# Volatile (run-timestamp) fields per output file, as tuples of path segments;
# "*" matches every key of a dict / element of a list at that level.
VOLATILE_FIELDS: dict[str, list[tuple[str, ...]]] = {
    "meta.json": [("lastUpdated",)],
    "history.json": [("generatedAt",), ("snapshots", "*", "ts")],
    "predictions_log.json": [("*", "snapshotAt")],
    "scorecard.json": [("meta", "generatedAt")],
}


def _strip(obj: Any, path: tuple[str, ...]) -> None:
    """Remove the field addressed by `path` from `obj`, in place."""
    if not path:
        return
    head, rest = path[0], path[1:]
    if head == "*":
        values: Iterable[Any]
        if isinstance(obj, dict):
            values = obj.values()
        elif isinstance(obj, list):
            values = obj
        else:
            return
        for v in values:
            _strip(v, rest)
    elif isinstance(obj, dict) and head in obj:
        if rest:
            _strip(obj[head], rest)
        else:
            del obj[head]


def strip_volatile(path: str, obj: Any) -> Any:
    """Strip the known volatile fields for this file name; returns `obj` (mutated)."""
    for field_path in VOLATILE_FIELDS.get(PurePosixPath(path).name, []):
        _strip(obj, field_path)
    return obj


def material_change(path: str, old_text: str, new_text: str) -> bool:
    """True if the two versions of `path` differ beyond volatile fields."""
    try:
        old = json.loads(old_text)
        new = json.loads(new_text)
    except (json.JSONDecodeError, TypeError):
        return True  # not JSON (or broken JSON): any change is material
    strip_volatile(path, old)
    strip_volatile(path, new)
    return json.dumps(old, sort_keys=True, ensure_ascii=False) != json.dumps(
        new, sort_keys=True, ensure_ascii=False
    )


def _git(args: list[str], cwd: str) -> str:
    out = subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, check=True
    )
    return out.stdout.decode("utf-8", errors="replace")


def changed_files(root: str) -> list[tuple[str, str]]:
    """(status, path) for every watched file that differs from HEAD.

    Status is git's one-letter code (M/A/D/R/...) plus '?' for untracked files.
    """
    changes: list[tuple[str, str]] = []
    diff = _git(["diff", "--name-status", "HEAD", "--", *WATCH_PATHS], cwd=root)
    for line in diff.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2:
            changes.append((parts[0][:1], parts[-1]))
    untracked = _git(
        ["ls-files", "--others", "--exclude-standard", "--", *WATCH_PATHS], cwd=root
    )
    changes.extend(("?", p) for p in untracked.splitlines() if p)
    return changes


def main() -> int:
    root = _git(["rev-parse", "--show-toplevel"], cwd=os.getcwd()).strip()
    material_paths: list[str] = []
    volatile_paths: list[str] = []

    for status, path in changed_files(root):
        if status != "M":
            # new / deleted / renamed files are always material
            material_paths.append(path)
            continue
        old_text = _git(["show", f"HEAD:{path}"], cwd=root)
        with open(os.path.join(root, path), encoding="utf-8") as f:
            new_text = f.read()
        (material_paths if material_change(path, old_text, new_text) else volatile_paths).append(path)

    for p in sorted(material_paths):
        print(f"  material:      {p}")
    for p in sorted(volatile_paths):
        print(f"  volatile-only: {p}")
    if not material_paths and not volatile_paths:
        print("  no watched files changed")

    material = bool(material_paths)
    verdict = "true" if material else "false"
    print(f"MATERIAL={verdict}")

    gh_output = os.environ.get("GITHUB_OUTPUT")
    if gh_output:
        with open(gh_output, "a", encoding="utf-8") as f:
            f.write(f"material={verdict}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
