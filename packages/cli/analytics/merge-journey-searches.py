#!/usr/bin/env python3
"""Merge N journey searches into a facet matrix. All options preserved; agent decides."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _imtakt import facet_from_journey, read_input, write_json  # noqa: E402


def main() -> None:
    data = read_input()
    searches_in = data.get("searches") or []
    out = []
    for s in searches_in:
        result = s.get("result") or s
        journeys = result.get("journeys") or []
        options = [facet_from_journey(j) for j in journeys]
        out.append(
            {
                "label": s.get("label"),
                "when": s.get("when") or result.get("when"),
                "optionCount": len(options),
                "options": options,
                "realtime": result.get("realtime"),
                "snap": result.get("snap"),
                "warnings": result.get("warnings"),
            }
        )
    write_json(
        {
            "searchCount": len(out),
            "searches": out,
            "principle": "All options preserved. Agent decides.",
        }
    )


if __name__ == "__main__":
    main()
