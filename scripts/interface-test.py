#!/usr/bin/env python3
"""Full interface test report for api.imtakt.dev — run before launch."""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any

API = sys.argv[1] if len(sys.argv) > 1 else "https://api.imtakt.dev"
TIMEOUT = 25


@dataclass
class Result:
    name: str
    method: str
    path: str
    status: str  # PASS | FAIL | SKIP | WARN
    http: int | None = None
    elapsed_ms: int | None = None
    detail: str = ""
    notes: list[str] = field(default_factory=list)


results: list[Result] = []


def request(method: str, path: str, body: dict | None = None) -> tuple[int, Any, int]:
    url = f"{API.rstrip('/')}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"content-type": "application/json", "accept": "application/json"},
    )
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            raw = resp.read().decode()
            elapsed = int((time.perf_counter() - start) * 1000)
            return resp.status, json.loads(raw) if raw else {}, elapsed
    except urllib.error.HTTPError as e:
        elapsed = int((time.perf_counter() - start) * 1000)
        raw = e.read().decode()
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"raw": raw[:200]}
        return e.code, payload, elapsed


def add(r: Result) -> None:
    results.append(r)


def test(name: str, method: str, path: str, body: dict | None, expect: int, check=None) -> Any:
    http, payload, ms = request(method, path, body)
    notes: list[str] = []
    status = "PASS" if http == expect else "FAIL"
    detail = ""

    if check and http == expect:
        try:
            detail = check(payload) or ""
        except AssertionError as e:
            status = "FAIL"
            detail = str(e)

    add(
        Result(
            name=name,
            method=method,
            path=path,
            status=status,
            http=http,
            elapsed_ms=ms,
            detail=detail,
            notes=notes,
        )
    )
    return payload if http == expect else None


def main() -> int:
    print("=" * 60)
    print("IMTAKT INTERFACE TEST REPORT")
    print(f"API: {API}")
    print(f"Time: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
    print("=" * 60)
    print()

    # --- Health ---
    http, health, ms = request("GET", "/health")
    stops_ok = health.get("capabilities", {}).get("stops", {}).get("ok")
    journeys_ok = health.get("capabilities", {}).get("journeys", {}).get("ok")
    board_ok = health.get("capabilities", {}).get("board", {}).get("ok")
    realtime_ok = health.get("capabilities", {}).get("realtime", {}).get("ok")
    indexed = health.get("capabilities", {}).get("stops", {}).get("indexed")
    health_status = "PASS" if http == 200 and stops_ok else "FAIL"
    if http == 200 and stops_ok and (not journeys_ok or not board_ok):
        health_status = "WARN"
    if http == 200 and stops_ok and journeys_ok and board_ok and not realtime_ok:
        health_status = "WARN"
    add(
        Result(
            name="Health",
            method="GET",
            path="/health",
            status=health_status,
            http=http,
            elapsed_ms=ms,
            detail=f"ok={health.get('ok')} stops={stops_ok} journeys={journeys_ok} board={board_ok} realtime={realtime_ok} indexed={indexed}",
            notes=(
                ["journeys capability unavailable — check GET /health"]
                if http == 200 and not journeys_ok
                else (
                    ["realtime capability unavailable — check GET /health"]
                    if http == 200 and stops_ok and not realtime_ok
                    else []
                )
            ),
        )
    )

    # --- Stops ---
    find_name = test(
        "Stops find (name)",
        "POST",
        "/v1/stops/find",
        {"place": "Alexanderplatz", "limit": 3},
        200,
        lambda p: f"{len(p['matches'])} matches, first={p['matches'][0]['name']}" if p.get("matches") else "no matches",
    )

    test(
        "Stops find (geo)",
        "POST",
        "/v1/stops/find",
        {"lat": 52.5215, "lng": 13.4110, "limit": 2},
        200,
        lambda p: f"{len(p['matches'])} matches",
    )

    # --- Journeys ---
    journey = test(
        "Journey plan (ICE)",
        "POST",
        "/v1/journeys/plan",
        {"from": "Berlin Hbf", "to": "München Hbf", "when": "2026-07-07T10:00:00.000Z"},
        200,
        lambda p: (
            f"{len(p['journeys'])} options, first={p['journeys'][0]['legs'][0]['line']['name']}"
            if p.get("journeys") and p["journeys"][0].get("legs")
            else "no journeys"
        ),
    )

    test(
        "Journey plan (multimodal)",
        "POST",
        "/v1/journeys/plan",
        {"from": "Alexanderplatz", "to": "Potsdam Hbf", "when": "2026-07-07T08:00:00.000Z"},
        200,
        lambda p: f"{len(p.get('journeys', []))} options",
    )

    # --- Board ---
    stop_id = None
    if find_name and find_name.get("matches"):
        http_b, board, ms_b = request(
            "GET",
            f"/v1/stops/{urllib.parse.quote(find_name['matches'][0]['id'])}/board",
        )
        dep_count = len(board.get("departures", []))
        first_dep = board.get("departures", [{}])[0] if dep_count else {}
        has_rt = any(d.get("realTime") for d in board.get("departures", []))
        board_status = "PASS" if http_b == 200 and dep_count > 0 else ("WARN" if http_b == 200 else "FAIL")
        board_notes: list[str] = []
        if http_b == 200 and dep_count == 0:
            board_notes.append("0 departures — board may be empty for this stop or time")
        elif http_b == 200 and dep_count > 0 and not has_rt:
            board_notes.append("No realTime on departures — realtime not active")
        add(
            Result(
                name="Station board",
                method="GET",
                path=f"/v1/stops/{find_name['matches'][0]['id']}/board",
                status=board_status,
                http=http_b,
                elapsed_ms=ms_b,
                detail=(
                    f"stop={board.get('stop',{}).get('name')} departures={dep_count} "
                    f"plannedTime={bool(first_dep.get('plannedTime'))} realTime={has_rt}"
                ),
                notes=board_notes,
            )
        )
        stop_id = find_name["matches"][0]["id"]

    # --- Train ---
    run_id = None
    if journey:
        for j in journey.get("journeys", []):
            for leg in j.get("legs", []):
                if leg.get("runId"):
                    run_id = leg["runId"]
                    break
            if run_id:
                break

    if run_id:
        test(
            "Train view",
            "GET",
            f"/v1/trains/{urllib.parse.quote(run_id, safe='')}",
            None,
            200,
            lambda p: f"line={p.get('line',{}).get('name')} stops={len(p.get('stops',[]))}",
        )
    else:
        add(
            Result(
                name="Train view",
                method="GET",
                path="/v1/trains/:runId",
                status="SKIP",
                detail="No runId on journey legs",
                notes=["imtakt_view_train needs runId from board or journey leg"],
            )
        )

    # --- Errors ---
    test(
        "Error: missing journey fields",
        "POST",
        "/v1/journeys/plan",
        {"from": "Berlin Hbf"},
        400,
        lambda p: p.get("error", "ok")[:60],
    )

    test(
        "Error: invalid runId",
        "GET",
        "/v1/trains/not-a-valid-run-id",
        None,
        404,
        lambda p: p.get("error", "ok")[:60],
    )

    # --- Print table ---
    print(f"{'STATUS':<6} {'HTTP':<5} {'ms':<6} {'ENDPOINT':<28} DETAIL")
    print("-" * 60)
    for r in results:
        http_s = str(r.http) if r.http is not None else "—"
        ms_s = str(r.elapsed_ms) if r.elapsed_ms is not None else "—"
        endpoint = f"{r.method} {r.path}"[:28]
        print(f"{r.status:<6} {http_s:<5} {ms_s:<6} {endpoint:<28} {r.detail[:40]}")
        for note in r.notes:
            print(f"       ↳ {note}")

    print()
    passed = sum(1 for r in results if r.status == "PASS")
    warned = sum(1 for r in results if r.status == "WARN")
    failed = sum(1 for r in results if r.status == "FAIL")
    skipped = sum(1 for r in results if r.status == "SKIP")
    print(f"Summary: {passed} PASS · {warned} WARN · {failed} FAIL · {skipped} SKIP")

    print()
    print("INTERFACE MAP (client → API → MCP tool)")
    print("-" * 60)
    print("imtakt_find_station  → POST /v1/stops/find     → CLI: imtakt find")
    print("imtakt_plan_journey  → POST /v1/journeys/plan  → CLI: imtakt journey")
    print("imtakt_station_live  → GET  /v1/stations/:id/live → CLI: imtakt live --stop-id")
    print("imtakt_view_train    → GET  /v1/trains/:runId  → CLI: imtakt train")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
