#!/usr/bin/env python3
"""Build public/data/s2t.json, a compact simplified -> traditional table.

Source: OpenCC's STCharacters.txt and STPhrases.txt (Apache-2.0), kept in
data/. The web app uses it only when the input contains characters that exist
only in simplified Chinese (e.g. 们), converting phrase by phrase so that
characters merged by simplification resolve correctly (以后 -> 以後, 皇后
stays 皇后, 头发 -> 頭髮, 发展 -> 發展).

The full phrase table is kept, so that longest-match conversion in the app
gives exactly OpenCC's result: dropping phrases that merely equal the
character-by-character result would change phrase boundaries (e.g. whether 里
becomes 裏) and diverge from OpenCC. Every OpenCC phrase keeps its length, which
the app relies on to align output with input characters; the build checks it.
Standard library only.
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CHARS = ROOT / "data" / "OpenCC-STCharacters.txt"
DEFAULT_PHRASES = ROOT / "data" / "OpenCC-STPhrases.txt"
DEFAULT_OUTPUT = ROOT / "public" / "data" / "s2t.json"
DEFAULT_MAP = ROOT / "public" / "data" / "seal-map.json"
DEFAULT_VARIANTS = ROOT / "public" / "data" / "seal-variants.json"


def read_table(path: Path) -> dict[str, list[str]]:
    table: dict[str, list[str]] = {}
    with path.open(encoding="utf-8") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            key, values = line.rstrip("\n").split("\t")
            table[key] = values.split()
    return table


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--chars", type=Path, default=DEFAULT_CHARS)
    parser.add_argument("--phrases", type=Path, default=DEFAULT_PHRASES)
    parser.add_argument("--map", type=Path, default=DEFAULT_MAP)
    parser.add_argument("--variants", type=Path, default=DEFAULT_VARIANTS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    chars = read_table(args.chars)
    default = {k: v[0] for k, v in chars.items() if len(k) == 1 and v and v[0] != k}
    with args.map.open(encoding="utf-8") as f:
        seal_chars = {chr(cp) for cp in json.load(f)["mcjk"] if cp}
    with args.variants.open(encoding="utf-8") as f:
        seal_chars |= set(json.load(f)["map"])
    # Characters that never appear in traditional text: a reliable sign the input is simplified.
    # Characters with a seal form of their own are left out: classical texts and
    # new-form (新字形) printing use them (无 in the Yijing, 黄 for 黃), so they prove nothing.
    simplified_only = sorted(k for k, v in chars.items() if len(k) == 1 and k not in v and k not in seal_chars)

    phrases = {}
    for key, values in read_table(args.phrases).items():
        value = values[0]
        if len(key) != len(value):
            raise ValueError(f"{args.phrases}: {key} -> {value} changes length; output alignment would break")
        phrases[key] = value

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as f:
        json.dump({"source": "OpenCC STCharacters.txt, STPhrases.txt (Apache-2.0)",
                   "chars": default, "phrases": dict(sorted(phrases.items())),
                   "simplifiedOnly": "".join(simplified_only)},
                  f, ensure_ascii=False, separators=(",", ":"))
    size = args.output.stat().st_size
    print(f"{len(default)} characters, {len(phrases)} phrases, {len(simplified_only)} simplified-only; "
          f"{size / 1024:.0f} KB -> {args.output.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
