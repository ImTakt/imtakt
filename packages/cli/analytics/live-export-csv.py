#!/usr/bin/env python3
"""Export live board departures as CSV."""
from __future__ import annotations

import csv
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _imtakt import berlin_hm, read_input  # noqa: E402


def main() -> None:
    data = read_input()
    buf = io.StringIO()
    fields = ["time", "timeBerlin", "line", "direction", "delayMinutes", "platform", "cancelled", "realTime", "runId"]
    w = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    for d in data.get("departures") or []:
        t = d.get("time") or d.get("predictedTime") or d.get("plannedTime")
        w.writerow(
            {
                "time": t or "",
                "timeBerlin": berlin_hm(t) if t else "",
                "line": d.get("line") if not isinstance(d.get("line"), dict) else d["line"].get("name", ""),
                "direction": d.get("direction", ""),
                "delayMinutes": d.get("delayMinutes", 0),
                "platform": d.get("platform", ""),
                "cancelled": d.get("cancelled", ""),
                "realTime": d.get("realTime", ""),
                "runId": d.get("runId", ""),
            }
        )
    sys.stdout.write(buf.getvalue())


if __name__ == "__main__":
    main()
