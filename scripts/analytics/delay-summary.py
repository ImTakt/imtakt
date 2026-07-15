#!/usr/bin/env python3
"""Summarize delays across compact journey payloads."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _imtakt import read_input, write_json, rail_legs, is_walk  # noqa: E402


def main() -> None:
    data = read_input()
    journeys = data.get("journeys") or []
    rows = []
    for j in journeys:
        opt = j.get("option", 0)
        tags = j.get("tags") or []
        for leg in j.get("legs") or []:
            if is_walk({"line": leg.get("line")}):
                continue
            delay = int(leg.get("delayMinutes") or 0)
            rows.append(
                {
                    "option": opt,
                    "tags": tags,
                    "line": leg.get("line"),
                    "from": leg.get("from"),
                    "to": leg.get("to"),
                    "delayMinutes": delay,
                    "realTime": leg.get("realTime"),
                    "cancelled": leg.get("cancelled"),
                }
            )

    delayed = [r for r in rows if r["delayMinutes"] > 0]
    cancelled = [r for r in rows if r.get("cancelled")]

    write_json(
        {
            "summary": {
                "journeys": len(journeys),
                "legs": len(rows),
                "delayedLegs": len(delayed),
                "maxDelayMinutes": max((r["delayMinutes"] for r in rows), default=0),
                "avgDelayMinutes": round(
                    sum(r["delayMinutes"] for r in rows) / len(rows), 1
                )
                if rows
                else 0,
                "cancelledLegs": len(cancelled),
                "realtime": data.get("realtime"),
            },
            "delayedLegs": sorted(delayed, key=lambda r: -r["delayMinutes"])[:20],
            "snap": data.get("snap"),
        }
    )


if __name__ == "__main__":
    main()
