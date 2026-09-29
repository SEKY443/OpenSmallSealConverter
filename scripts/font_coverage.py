#!/usr/bin/env python3
"""Report which modern characters needed for the seal preview a font lacks.

The web app previews each Small Seal character by rendering its modern CJK
equivalent (kSEAL_MCJK) in a seal-style font. This script writes the list of
those characters, plus the ones other data files may render (variants and
substitution headwords), missing from that font, so the app can flag them
instead of silently falling back to a regular system font.

Requires fontTools.
"""

import argparse
import json
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MAP = ROOT / "public" / "data" / "seal-map.json"
# Characters that may be rendered in the preview besides kSEAL_MCJK values.
EXTRA_FILES = ("seal-variants.json", "original-forms.json")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("font", type=Path, help="seal-style preview font (.ttf/.otf/.woff2)")
    parser.add_argument("--map", type=Path, default=DEFAULT_MAP)
    parser.add_argument("--output", type=Path, help="default: <font>.coverage.json next to the font")
    args = parser.parse_args()

    with args.map.open(encoding="utf-8") as f:
        seal_map = json.load(f)
    needed = {cp for cp in seal_map["mcjk"] if cp}
    for name in EXTRA_FILES:
        path = args.map.parent / name
        if not path.exists():
            continue
        with path.open(encoding="utf-8") as f:
            extra = json.load(f)
        chars = set(extra.get("map", {}))  # variants: keys are rendered
        for kind in ("original", "simplified"):  # substitutions: headwords are rendered
            chars |= {h for heads in extra.get(kind, {}).values() for h in heads}
        needed |= {ord(ch) for ch in chars if len(ch) == 1}

    cmap = TTFont(args.font, lazy=True).getBestCmap()
    missing = sorted(cp for cp in needed if cp not in cmap)
    covered_seals = sum(1 for cp in seal_map["mcjk"] if cp and cp in cmap)

    output = args.output or args.font.with_name(args.font.stem + ".coverage.json")
    with output.open("w", encoding="utf-8") as f:
        json.dump({"missing": missing}, f, separators=(",", ":"))

    print(f"{args.font.name}: previews {covered_seals}/{len(seal_map['mcjk'])} seal characters, "
          f"{len(missing)} modern characters missing -> {output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
