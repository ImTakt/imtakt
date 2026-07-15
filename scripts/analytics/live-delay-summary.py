#!/usr/bin/env python3
"""Summarize delays on a live board — all departures kept in lists; agent decides."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _imtakt import read_input, write_json  # noqa: E402


def main() -> None:
    data = read_input()
    deps = data.get("departures") or []
    delayed = [d for d in deps if int(d.get("delayMinutes") or 0) > 0]
    cancelled = [d for d in deps if d.get("cancelled")]
    write_json(
        {
            "station": data.get("station"),
            "stopId": data.get("stopId"),
            "realtime": data.get("realtime"),
            "asOf": data.get("asOf"),
            "summary": {
                "departures": len(deps),
                "delayed": len(delayed),
                "cancelled": len(cancelled),
                "maxDelayMinutes": max((int(d.get("delayMinutes") or 0) for d in deps), default=0),
            },
            "delayedDepartures": sorted(
                delayed, key=lambda d: -int(d.get("delayMinutes") or 0)
            )[:20],
            "cancelledDepartures": cancelled[:20],
        }
    )


if __name__ == "__main__":
    main()
