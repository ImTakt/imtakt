#!/usr/bin/env python3
"""Facts for a train run (compact or full ViewTrain). Agent decides next action."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _imtakt import read_input, write_json  # noqa: E402


def main() -> None:
    data = read_input()
    progress = data.get("progress") or {}
    stops = data.get("stops") or []
    delays = [int(s.get("delayMinutes") or 0) for s in stops]
    cancelled_stops = [s for s in stops if s.get("cancelled")]
    line = data.get("line")
    if isinstance(line, dict):
        line = line.get("name")

    write_json(
        {
            "runId": data.get("runId"),
            "line": line,
            "direction": data.get("direction"),
            "status": data.get("status") or progress.get("status"),
            "currentDelayMinutes": data.get("currentDelayMinutes", 0),
            "cancelled": data.get("cancelled", False),
            "realTime": data.get("realTime"),
            "asOf": data.get("asOf"),
            "currentStop": data.get("currentStop")
            or (progress.get("currentStop") or {}).get("name"),
            "nextStop": data.get("nextStop") or (progress.get("nextStop") or {}).get("name"),
            "stopCount": len(stops),
            "maxStopDelayMinutes": max(delays, default=0),
            "cancelledStops": len(cancelled_stops),
        }
    )


if __name__ == "__main__":
    main()
