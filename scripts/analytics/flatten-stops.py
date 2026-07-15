#!/usr/bin/env python3
"""Flatten train stops to rows (pandas-friendly)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _imtakt import berlin_hm, read_input, write_json  # noqa: E402


def main() -> None:
    data = read_input()
    line = data.get("line")
    if isinstance(line, dict):
        line = line.get("name")
    rows = []
    for i, s in enumerate(data.get("stops") or []):
        name = s.get("name") or (s.get("stop") or {}).get("name")
        arr = s.get("arrival") or s.get("plannedArrival")
        dep = s.get("departure") or s.get("plannedDeparture")
        rows.append(
            {
                "index": i,
                "runId": data.get("runId"),
                "line": line,
                "stop": name,
                "arrivalUtc": arr,
                "departureUtc": dep,
                "arrivalBerlin": berlin_hm(arr) if arr else None,
                "departureBerlin": berlin_hm(dep) if dep else None,
                "delayMinutes": s.get("delayMinutes", 0),
                "platform": s.get("platform"),
                "cancelled": s.get("cancelled"),
                "realTime": s.get("realTime"),
            }
        )
    write_json({"rows": rows, "count": len(rows)})


if __name__ == "__main__":
    main()
