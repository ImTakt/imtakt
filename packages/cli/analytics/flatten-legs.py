#!/usr/bin/env python3
"""Flatten journeys to analytics rows (pandas-friendly list of dicts)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _imtakt import read_input, write_json, berlin_hm, is_walk  # noqa: E402


def main() -> None:
    data = read_input()
    rows = []
    for j in data.get("journeys") or []:
        for leg in j.get("legs") or []:
            line = leg.get("line")
            line_name = line if isinstance(line, str) else (line or {}).get("name")
            if is_walk({"line": line_name}):
                continue
            dep = leg.get("dep") or leg.get("departure")
            arr = leg.get("arr") or leg.get("arrival")
            rows.append(
                {
                    "option": j.get("option"),
                    "durationMinutes": j.get("durationMinutes"),
                    "transfers": j.get("transfers"),
                    "tags": ",".join(j.get("tags") or []),
                    "line": line_name,
                    "from": leg.get("from") or (leg.get("origin") or {}).get("name"),
                    "to": leg.get("to") or (leg.get("destination") or {}).get("name"),
                    "depUtc": dep,
                    "arrUtc": arr,
                    "depBerlin": berlin_hm(dep) if dep else None,
                    "arrBerlin": berlin_hm(arr) if arr else None,
                    "delayMinutes": leg.get("delayMinutes", 0),
                    "platform": leg.get("platform"),
                    "realTime": leg.get("realTime"),
                    "cancelled": leg.get("cancelled"),
                    "runId": leg.get("runId"),
                }
            )
    write_json({"rows": rows, "count": len(rows), "snap": data.get("snap")})


if __name__ == "__main__":
    main()
