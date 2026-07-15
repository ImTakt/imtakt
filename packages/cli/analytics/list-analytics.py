#!/usr/bin/env python3
"""Print paths to bundled analytics scripts (for shell pipes)."""
from __future__ import annotations

import sys
from pathlib import Path

SCRIPTS = [
    "delay-summary",
    "filter-regio",
    "flatten-legs",
    "rank-by-delay",
    "to-markdown-report",
    "export-csv",
]

def main() -> None:
    root = Path(__file__).resolve().parent
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print("Usage: list-analytics.py <script-name>")
        print("Scripts:", ", ".join(SCRIPTS))
        for name in SCRIPTS:
            print(root / f"{name}.py")
        return
    name = sys.argv[1].replace(".py", "")
    path = root / f"{name}.py"
    if not path.is_file():
        print(f"Unknown script: {name}", file=sys.stderr)
        print("Available:", ", ".join(SCRIPTS), file=sys.stderr)
        sys.exit(1)
    print(path)


if __name__ == "__main__":
    main()
