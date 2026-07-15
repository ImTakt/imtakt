#!/usr/bin/env python3
"""Drop journeys containing long-distance legs (ICE/IC/EC)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _imtakt import read_input, write_json, is_long_distance, is_walk  # noqa: E402


def journey_is_regio(j: dict) -> bool:
    for leg in j.get("legs") or []:
        line = leg.get("line")
        name = line if isinstance(line, str) else (line or {}).get("name", "")
        if is_walk({"line": name}):
            continue
        if is_long_distance(name):
            return False
    return True


def main() -> None:
    data = read_input()
    before = data.get("journeys") or []
    kept = [j for j in before if journey_is_regio(j)]
    write_json(
        {
            **data,
            "journeys": kept,
            "filter": {"regioOnly": True, "before": len(before), "after": len(kept)},
        }
    )


if __name__ == "__main__":
    main()
