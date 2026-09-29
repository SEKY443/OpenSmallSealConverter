#!/usr/bin/env python3
"""Build seal-variants.json from OpenCC's SealVariants.txt.

SealVariants.txt (OpenCC, Apache-2.0) maps a modern standard character to the
Shuowen transcription (隸定字) that kSEAL_MCJK uses for the same character,
e.g. 年 -> 秊. Resolving those transcriptions through kSEAL_MCJK gives the seal
code points for characters that kSEAL_MCJK does not list directly.

With --shuowen, headwords from the shuowen.org data (Apache-2.0) are also
aligned with kSEAL_CCZSrc order (see align_shuowen); OpenCC entries win.

Characters in their modern form (新字形) are resolved through the inherited
form (舊字形) from the Shanggu fonts' data/Shanggu-stoneo.dt (OFL-1.1).
Simplified characters in that table are left to build_original_forms.py so
they stay flagged as simplified.

Curated entries in data/seal-variants.manual.tsv (each with a source
citation) take precedence.

Output: {"source": ..., "map": {char: [seal, ...]}}.
Standard library only.
"""

import argparse
import collections
import difflib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_VARIANTS = ROOT / "data" / "SealVariants.txt"
DEFAULT_MANUAL = ROOT / "data" / "seal-variants.manual.tsv"
DEFAULT_MAP = ROOT / "public" / "data" / "seal-map.json"
DEFAULT_SOURCES = ROOT / "data" / "SealSources.txt"
DEFAULT_OLD_FORMS = ROOT / "data" / "Shanggu-stoneo.dt"
DEFAULT_UNIHAN = ROOT / "data" / "Unihan_Variants.txt"
DEFAULT_OUTPUT = ROOT / "public" / "data" / "seal-variants.json"


def align_shuowen(shuowen: Path, sources: Path) -> dict[str, set[int]]:
    """Map shuowen.org headwords and 重文 to seal code points by sequence alignment.

    The shuowen.org entries (headword, then its 重文) follow the Chen Changzhi
    edition, as does kSEAL_CCZSrc numbering. Aligning the headword sequence with
    the kSEAL_MCJK sequence in CCZ order pairs identical characters directly;
    mismatched runs are paired position by position only when both sides have
    the same length, otherwise skipped.
    """
    ccz: list[tuple[int, int, str]] = []
    fields: dict[int, dict[str, str]] = collections.defaultdict(dict)
    with sources.open(encoding="utf-8") as f:
        for line in f:
            if not line.startswith("#") and line.strip():
                cp, key, value = line.rstrip("\n").split("\t")
                fields[int(cp[2:], 16)][key] = value
    for cp, fd in fields.items():
        if "kSEAL_CCZSrc" in fd:
            ccz.append((int(fd["kSEAL_CCZSrc"][2:]), cp, chr(int(fd["kSEAL_MCJK"], 16))))
    ccz.sort()

    entries = [json.loads(p.read_text(encoding="utf-8")) for p in (shuowen / "data").glob("*.json")]
    entries.sort(key=lambda e: e["id"])
    heads = [w for e in entries for w in [e["wordhead"], *(v["wordhead"] for v in e.get("variants") or [])]]

    matcher = difflib.SequenceMatcher(None, heads, [m for _, _, m in ccz], autojunk=False)
    aligned: dict[str, set[int]] = collections.defaultdict(set)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                if len(heads[i1 + k]) == 1:
                    aligned[heads[i1 + k]].add(ccz[j1 + k][1])
    return aligned


def read_simplified(path: Path) -> set[str]:
    """Characters with a distinct traditional form (kTraditionalVariant)."""
    result = set()
    with path.open(encoding="utf-8") as f:
        for line in f:
            if "\tkTraditionalVariant\t" in line:
                cp, _, values = line.rstrip("\n").split("\t")
                ch = chr(int(cp[2:], 16))
                if any(chr(int(v[2:], 16)) != ch for v in values.split()):
                    result.add(ch)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--variants", type=Path, default=DEFAULT_VARIANTS)
    parser.add_argument("--manual", type=Path, default=DEFAULT_MANUAL)
    parser.add_argument("--shuowen", type=Path, help="optional clone of github.com/shuowenjiezi/shuowen to align")
    parser.add_argument("--sources", type=Path, default=DEFAULT_SOURCES)
    parser.add_argument("--old-forms", type=Path, default=DEFAULT_OLD_FORMS,
                        help="Shanggu new-form -> inherited-form table (OFL-1.1); skipped if absent")
    parser.add_argument("--unihan", type=Path, default=DEFAULT_UNIHAN,
                        help="Unihan_Variants.txt, to leave simplified characters to build_original_forms.py")
    parser.add_argument("--map", type=Path, default=DEFAULT_MAP)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    with args.map.open(encoding="utf-8") as f:
        seal_map = json.load(f)
    seals_of: dict[int, list[int]] = collections.defaultdict(list)
    for i, cp in enumerate(seal_map["mcjk"]):
        if cp:
            seals_of[cp].append(seal_map["first"] + i)

    entries: dict[str, list[int]] = {}
    unresolved = 0
    with args.variants.open(encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            if line.startswith("#") or not line.strip():
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) != 2 or len(parts[0]) != 1:
                raise ValueError(f"{args.variants}:{lineno}: unexpected line: {line!r}")
            key, values = parts[0], parts[1].split()
            if ord(key) in seals_of or values == [key]:
                continue  # Already covered by kSEAL_MCJK, or a self-mapping.
            seals = sorted({s for v in values if len(v) == 1 for s in seals_of.get(ord(v), [])})
            if seals:
                entries[key] = seals
            else:
                unresolved += 1

    aligned = 0
    simplified = read_simplified(args.unihan)
    if args.shuowen:
        for key, seals in align_shuowen(args.shuowen, args.sources).items():
            # A Shuowen headword is never a simplified character; one that looks like
            # it is a mis-encoded headword in the data (e.g. 膺 stored as 钋).
            if key in simplified:
                continue
            if ord(key) not in seals_of and key not in entries:
                entries[key] = sorted(seals)
                aligned += 1

    # Same character in its inherited (舊字形) form, e.g. 并 -> 幷, 黄 -> 黃.
    old_forms = 0
    if args.old_forms.exists():
        with args.old_forms.open(encoding="utf-8") as f:
            for line in f:
                parts = line.rstrip("\n").split("-")
                if line.startswith("#") or len(parts) != 2 or len(parts[0]) != 1 or len(parts[1]) != 1:
                    continue
                new, old = parts
                if new in simplified or ord(new) in seals_of or new in entries:
                    continue
                seals = seals_of.get(ord(old)) or entries.get(old)
                if seals:
                    entries[new] = sorted(seals)
                    old_forms += 1

    first, last = seal_map["first"], seal_map["first"] + len(seal_map["mcjk"]) - 1
    manual = 0
    if args.manual.exists():
        with args.manual.open(encoding="utf-8") as f:
            for lineno, line in enumerate(f, 1):
                if line.startswith("#") or not line.strip():
                    continue
                parts = line.rstrip("\n").split("\t")
                codes = parts[1].split() if len(parts) == 3 else []
                if len(parts[0]) != 1 or not codes or not all(c.startswith("U+") for c in codes) or not parts[2].strip():
                    raise ValueError(f"{args.manual}:{lineno}: expected character, U+XXXXX [U+XXXXX ...], source")
                seals = [int(c[2:], 16) for c in codes]
                if not all(first <= seal <= last for seal in seals):
                    raise ValueError(f"{args.manual}:{lineno}: code point outside the Small Seal block")
                # Guard against mistyped code points: the citation must name either the
                # character itself or the kSEAL_MCJK form of every seal it maps to.
                for seal in seals:
                    mcjk_form = chr(seal_map["mcjk"][seal - first])
                    if parts[0] not in parts[2] and mcjk_form not in parts[2]:
                        raise ValueError(f"{args.manual}:{lineno}: U+{seal:X} is {mcjk_form}, "
                                         f"which the citation does not mention; check the code point")
                if ord(parts[0]) in seals_of:
                    print(f"warning: manual entry {parts[0]} is already in kSEAL_MCJK; skipped", file=sys.stderr)
                    continue
                entries[parts[0]] = seals  # Listed order: the first is the default.
                manual += 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as f:
        json.dump({"source": "OpenCC SealVariants.txt (Apache-2.0) + shuowen.org data alignment (Apache-2.0)"
               " + Shanggu inherited forms (OFL-1.1) + data/seal-variants.manual.tsv", "map": dict(sorted(entries.items()))},
                  f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(entries)} characters mapped ({aligned} aligned, {old_forms} inherited forms, {manual} manual), {unresolved} unresolved -> {args.output.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
