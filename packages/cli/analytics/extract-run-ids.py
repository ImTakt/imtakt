#!/usr/bin/env python3
"""Extract runIds from journey or live compact JSON for imtakt train drill-down."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _imtakt import detect_input, line_name, read_input, write_json  # noqa: E402


def main() -> None:
    data = read_input()
    kind = detect_input(data)
    rows = []

    if kind == "journey":
        for j in data.get("journeys") or []:
            for leg in j.get("legs") or []:
                rid = leg.get("runId")
                if not rid:
                    continue
                rows.append(
                    {
                        "runId": rid,
                        "line": line_name(leg) or leg.get("line"),
                        "from": leg.get("from"),
                        "to": leg.get("to"),
                        "option": j.get("option"),
                    }
                )
    elif kind == "live":
        for d in data.get("departures") or []:
            rid = d.get("runId")
            if not rid:
                continue
            rows.append(
                {
                    "runId": rid,
                    "line": d.get("line"),
                    "direction": d.get("direction"),
                    "time": d.get("time"),
                }
            )
    else:
        write_json({"error": f"Expected journey or live input, got {kind}", "runIds": []})
        return

    # Dedupe by runId, keep first
    seen = set()
    unique = []
    for r in rows:
        if r["runId"] in seen:
            continue
        seen.add(r["runId"])
        unique.append(r)

    write_json({"count": len(unique), "runIds": unique, "source": kind})


if __name__ == "__main__":
    main()
