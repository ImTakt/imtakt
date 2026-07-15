#!/usr/bin/env python3
"""Reorder journeys by total delay (ascending) — best reliability first."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _imtakt import read_input, write_json, is_walk  # noqa: E402


def total_delay(j: dict) -> int:
    total = 0
    for leg in j.get("legs") or []:
        line = leg.get("line")
        name = line if isinstance(line, str) else (line or {}).get("name", "")
        if is_walk({"line": name}):
            continue
        total += int(leg.get("delayMinutes") or 0)
    return total


def main() -> None:
    data = read_input()
    journeys = list(data.get("journeys") or [])
    ranked = sorted(journeys, key=total_delay)
    for i, j in enumerate(ranked, 1):
        j["option"] = i
        j["totalDelayMinutes"] = total_delay(j)
    write_json({**data, "journeys": ranked, "rankedBy": "totalDelayMinutes"})


if __name__ == "__main__":
    main()
