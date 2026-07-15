#!/usr/bin/env python3
"""Cartesian out×return facet pairs from merge-journey-searches output. Agent picks."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _imtakt import facet_from_journey, read_input, write_json  # noqa: E402


def options_of(search: dict) -> list:
    if search.get("options") is not None:
        return list(search["options"])
    result = search.get("result") or {}
    return [facet_from_journey(j) for j in result.get("journeys") or []]


def pick_two(searches: list) -> tuple[dict, dict]:
    by_label = {s.get("label"): s for s in searches if s.get("label")}
    if "out" in by_label and "return" in by_label:
        return by_label["out"], by_label["return"]
    if len(searches) < 2:
        raise ValueError("Need ≥2 searches (labels out/return or positional)")
    return searches[0], searches[1]


def main() -> None:
    data = read_input()
    searches = data.get("searches") or []
    try:
        a, b = pick_two(searches)
    except ValueError as e:
        write_json({"error": str(e), "pairCount": 0, "pairs": []})
        return

    outs = options_of(a)
    rets = options_of(b)
    out_label = a.get("label") or "out"
    ret_label = b.get("label") or "return"

    pairs = []
    for o in outs:
        for r in rets:
            pairs.append(
                {
                    "out": {
                        "label": out_label,
                        "option": o.get("option"),
                        "durationMinutes": o.get("durationMinutes"),
                        "totalDelayMinutes": o.get("totalDelayMinutes"),
                        "riskLevel": o.get("riskLevel"),
                        "tags": o.get("tags"),
                    },
                    "return": {
                        "label": ret_label,
                        "option": r.get("option"),
                        "durationMinutes": r.get("durationMinutes"),
                        "totalDelayMinutes": r.get("totalDelayMinutes"),
                        "riskLevel": r.get("riskLevel"),
                        "tags": r.get("tags"),
                    },
                    "combinedDurationMinutes": int(o.get("durationMinutes") or 0)
                    + int(r.get("durationMinutes") or 0),
                    "combinedDelayMinutes": int(o.get("totalDelayMinutes") or 0)
                    + int(r.get("totalDelayMinutes") or 0),
                }
            )

    write_json(
        {
            "pairCount": len(pairs),
            "pairs": pairs,
            "principle": "All pairs listed. Agent decides.",
        }
    )


if __name__ == "__main__":
    main()
