#!/usr/bin/env python3
"""Build the Small Seal lookup table used by the web app.

Reads the Unicode SealSources.txt file and writes a compact JSON file where
index i of "mcjk" holds the modern CJK code point (kSEAL_MCJK) of the Small
Seal character at code point FIRST + i.

Standard library only.
"""

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = ROOT / "data" / "SealSources.txt"
DEFAULT_OUTPUT = ROOT / "public" / "data" / "seal-map.json"

SEAL_FIRST = 0x3D000
SEAL_LAST = 0x3FC3F
LINE_RE = re.compile(r"^U\+([0-9A-F]{4,6})\t(kSEAL_\w+)\t(.+)$")
VERSION_RE = re.compile(r"^# SealSources-([\d.]+)\.txt")


def parse(path: Path) -> tuple[str, dict[int, int]]:
    version = "unknown"
    mcjk: dict[int, int] = {}
    with path.open(encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            line = line.rstrip("\n")
            if line.startswith("#"):
                m = VERSION_RE.match(line)
                if m:
                    version = m.group(1)
                continue
            if not line.strip():
                continue
            m = LINE_RE.match(line)
            if not m:
                raise ValueError(f"{path}:{lineno}: unexpected line: {line!r}")
            cp, field, value = int(m.group(1), 16), m.group(2), m.group(3)
            if field != "kSEAL_MCJK":
                continue
            if not SEAL_FIRST <= cp <= SEAL_LAST:
                raise ValueError(f"{path}:{lineno}: U+{cp:X} is outside the Small Seal block")
            if not re.fullmatch(r"[0-9A-F]{4,5}", value):
                raise ValueError(f"{path}:{lineno}: unsupported kSEAL_MCJK value {value!r}")
            if cp in mcjk:
                raise ValueError(f"{path}:{lineno}: duplicate kSEAL_MCJK for U+{cp:X}")
            mcjk[cp] = int(value, 16)
    return version, mcjk


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    version, mcjk = parse(args.source)
    last = max(mcjk)
    missing = [cp for cp in range(SEAL_FIRST, last + 1) if cp not in mcjk]
    if missing:
        # The web app indexes by offset, so gaps must be explicit.
        print(f"warning: {len(missing)} code points without kSEAL_MCJK", file=sys.stderr)

    table = [mcjk.get(cp, 0) for cp in range(SEAL_FIRST, last + 1)]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as f:
        json.dump({"unicode": version, "first": SEAL_FIRST, "mcjk": table}, f, separators=(",", ":"))

    print(f"Unicode {version}: {len(mcjk)} seal characters, "
          f"{len(set(mcjk.values()))} distinct modern characters -> {args.output.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
