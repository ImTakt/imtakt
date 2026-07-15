#!/usr/bin/env python3
"""Rich markdown analytics report from compact journey JSON."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _imtakt import read_input, berlin_hm, is_walk  # noqa: E402


def main() -> None:
    data = read_input()
    lines: list[str] = []
    snap = data.get("snap") or {}
    if snap.get("from"):
        f = snap["from"]
        lines.append(f"**From:** {f.get('requested')} → {f.get('stop')}")
    if snap.get("to"):
        t = snap["to"]
        lines.append(f"**To:** {t.get('requested')} → {t.get('stop')}")
    rt = data.get("realtime") or {}
    if rt:
        status = "live GTFS-RT" if rt.get("available") else "schedule"
        lines.append(f"_Data: {status}_\n")

    for j in data.get("journeys") or []:
        tags = ", ".join(j.get("tags") or [])
        tag_s = f" · _{tags}_" if tags else ""
        lines.append(
            f"## Option {j.get('option', '?')} · {j.get('durationMinutes')} min · "
            f"{j.get('transfers')} transfers{tag_s}"
        )
        total_delay = 0
        for leg in j.get("legs") or []:
            line = leg.get("line")
            name = line if isinstance(line, str) else (line or {}).get("name")
            if is_walk({"line": name}):
                continue
            delay = int(leg.get("delayMinutes") or 0)
            total_delay += delay
            d = f" +{delay}" if delay > 0 else ""
            cancel = " **X**" if leg.get("cancelled") else ""
            dep = leg.get("dep") or leg.get("departure")
            hm = berlin_hm(dep) if dep else "—"
            plat = f" Gl.{leg['platform']}" if leg.get("platform") else ""
            dest = leg.get("to") or (leg.get("destination") or {}).get("name", "")
            lines.append(f"- **{hm}** {name} → {dest}{plat}{d}{cancel}")
        lines.append(f"_Total delay: {total_delay} min_\n")

    out = "\n".join(lines).strip() + "\n"
    json.dump({"markdown": out, "journeys": len(data.get("journeys") or [])}, sys.stdout)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
