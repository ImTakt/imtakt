"""Shared helpers for ImTakt analytics scripts (stdlib only).

Domain today: transit (journey / live / train). Helpers stay generic so
future logistics domains can add detect_input kinds without rewriting pipes.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

BERLIN = ZoneInfo("Europe/Berlin")
LONG_DISTANCE = re.compile(r"^(ICE|IC|EC|ECE|TGV|FlixTrain)\b", re.I)


def read_input() -> Any:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    return json.loads(raw)


def write_json(data: Any) -> None:
    json.dump(data, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")


def write_text(text: str) -> None:
    sys.stdout.write(text)
    if not text.endswith("\n"):
        sys.stdout.write("\n")


def berlin_hm(iso: str) -> str:
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return dt.astimezone(BERLIN).strftime("%H:%M")


def is_walk(leg: dict) -> bool:
    line = leg.get("line")
    if line == "Fußweg":
        return True
    if isinstance(line, str):
        return line == "Fußweg"
    if isinstance(line, dict):
        return line.get("name") == "Fußweg"
    return False


def line_name(leg: dict) -> str:
    line = leg.get("line")
    if isinstance(line, str):
        return line
    if isinstance(line, dict):
        return line.get("name") or ""
    return ""


def rail_legs(journey: dict) -> list[dict]:
    legs = journey.get("legs") or []
    return [l for l in legs if not is_walk(l)]


def is_long_distance(name: str) -> bool:
    return bool(LONG_DISTANCE.match(name or ""))


def detect_input(data: dict) -> str:
    """Return source kind for catalog routing (extensible beyond transit)."""
    if not isinstance(data, dict):
        return "unknown"
    if "searches" in data:
        return "multi"
    if "journeys" in data:
        return "journey"
    if "departures" in data and ("station" in data or "stopId" in data):
        return "live"
    if "runId" in data and ("stops" in data or "status" in data or "progress" in data):
        return "train"
    return "unknown"


def transfer_gaps(journey: dict) -> list[dict]:
    if journey.get("transferGaps") is not None:
        return list(journey["transferGaps"])
    legs = rail_legs(journey)
    gaps = []
    for i in range(len(legs) - 1):
        cur, nxt = legs[i], legs[i + 1]
        arr = cur.get("arr") or cur.get("arrival")
        dep = nxt.get("dep") or nxt.get("departure")
        if not arr or not dep:
            continue
        try:
            minutes = int(
                (
                    datetime.fromisoformat(dep.replace("Z", "+00:00"))
                    - datetime.fromisoformat(arr.replace("Z", "+00:00"))
                ).total_seconds()
                // 60
            )
        except ValueError:
            continue
        at = cur.get("to") or (cur.get("destination") or {}).get("name") or ""
        gaps.append({"at": at, "minutes": minutes})
    return gaps


def risk_level(cancelled: int, gaps: list[dict], total_delay: int) -> str:
    min_gap = min((g["minutes"] for g in gaps), default=10**9)
    if cancelled > 0 or min_gap < 5:
        return "high"
    if min_gap <= 7 or total_delay >= 10:
        return "medium"
    return "low"


def facet_from_journey(journey: dict) -> dict:
    """Prefer precomputed compact facets; fall back from legs."""
    legs = rail_legs(journey)
    if journey.get("totalDelayMinutes") is not None and journey.get("riskLevel"):
        return {
            "option": journey.get("option"),
            "tags": journey.get("tags") or [],
            "durationMinutes": journey.get("durationMinutes"),
            "transfers": journey.get("transfers"),
            "depart": journey.get("depart"),
            "arrive": journey.get("arrive"),
            "totalDelayMinutes": journey.get("totalDelayMinutes", 0),
            "cancelledLegs": journey.get("cancelledLegs", 0),
            "riskLevel": journey.get("riskLevel"),
            "transferGaps": journey.get("transferGaps") or [],
            "lines": journey.get("lines")
            or [line_name(l) for l in legs],
        }

    total_delay = sum(int(l.get("delayMinutes") or 0) for l in legs)
    cancelled = sum(1 for l in legs if l.get("cancelled"))
    gaps = transfer_gaps(journey)
    return {
        "option": journey.get("option"),
        "tags": journey.get("tags") or [],
        "durationMinutes": journey.get("durationMinutes"),
        "transfers": journey.get("transfers"),
        "depart": journey.get("depart")
        or (legs[0].get("dep") or legs[0].get("departure") if legs else None),
        "arrive": journey.get("arrive")
        or (legs[-1].get("arr") or legs[-1].get("arrival") if legs else None),
        "totalDelayMinutes": total_delay,
        "cancelledLegs": cancelled,
        "riskLevel": risk_level(cancelled, gaps, total_delay),
        "transferGaps": gaps,
        "lines": [line_name(l) for l in legs],
    }
