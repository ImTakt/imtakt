#!/usr/bin/env python3
"""Export flattened legs as CSV (stdout text; harness uses parseJson: false)."""
from __future__ import annotations

import csv
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _imtakt import read_input, berlin_hm, is_walk  # noqa: E402


def main() -> None:
    data = read_input()
    buf = io.StringIO()
    fields = [
        "option",
        "line",
        "from",
        "to",
        "depBerlin",
        "arrBerlin",
        "delayMinutes",
        "platform",
        "realTime",
        "cancelled",
    ]
    w = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    for j in data.get("journeys") or []:
        for leg in j.get("legs") or []:
            line = leg.get("line")
            name = line if isinstance(line, str) else (line or {}).get("name")
            if is_walk({"line": name}):
                continue
            dep = leg.get("dep") or leg.get("departure")
            arr = leg.get("arr") or leg.get("arrival")
            w.writerow(
                {
                    "option": j.get("option"),
                    "line": name,
                    "from": leg.get("from"),
                    "to": leg.get("to"),
                    "depBerlin": berlin_hm(dep) if dep else "",
                    "arrBerlin": berlin_hm(arr) if arr else "",
                    "delayMinutes": leg.get("delayMinutes", 0),
                    "platform": leg.get("platform", ""),
                    "realTime": leg.get("realTime", ""),
                    "cancelled": leg.get("cancelled", ""),
                }
            )
    sys.stdout.write(buf.getvalue())


if __name__ == "__main__":
    main()
