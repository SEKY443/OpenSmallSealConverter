#!/usr/bin/env python3
"""Build original-forms.json: characters without a seal form -> Shuowen headwords.

Source: the shuowen.org data (https://github.com/shuowenjiezi/shuowen,
Apache-2.0). Each headword lists search aliases in "indexes", which include
later characters (後起字, e.g. 洲 under 州) and simplified forms (e.g. 诛 under
誅). For every alias that has no seal form of its own (neither kSEAL_MCJK nor
seal-variants.json), this maps the alias to its headword(s).

Aliases that have a distinct traditional form in Unihan (kTraditionalVariant)
are classified as "simplified"; the rest as "original". The source does not
say whether an "original" alias is a later character (後起字, 洲 -> 州) or a
variant spelling of the headword (擾 -> 𢹎), so both land there. Characters
that already have a seal form are never remapped.

Simplified -> traditional pairs from the Shanggu fonts' table
(data/Shanggu-stoneo.dt, OFL-1.1) fill in simplified characters the
shuowen.org aliases miss.

Curated entries in data/original-forms.manual.tsv (each with a source
citation) take precedence.

Standard library only. Clone the shuowen repository first:
    git clone --depth 1 https://github.com/shuowenjiezi/shuowen.git <dir>
"""

import argparse
import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MAP = ROOT / "public" / "data" / "seal-map.json"
DEFAULT_VARIANTS = ROOT / "public" / "data" / "seal-variants.json"
DEFAULT_UNIHAN = ROOT / "data" / "Unihan_Variants.txt"
DEFAULT_MANUAL = ROOT / "data" / "original-forms.manual.tsv"
DEFAULT_OLD_FORMS = ROOT / "data" / "Shanggu-stoneo.dt"
DEFAULT_NOTES = ROOT / "data" / "original-forms.notes.tsv"
DEFAULT_OUTPUT = ROOT / "public" / "data" / "original-forms.json"


def read_variant_keys(path: Path) -> set[str]:
    """Characters that seal-variants.json (scripts/build_variants.py) maps to a seal."""
    with path.open(encoding="utf-8") as f:
        return set(json.load(f)["map"])


def read_traditional(path: Path) -> dict[str, set[str]]:
    trad: dict[str, set[str]] = collections.defaultdict(set)
    with path.open(encoding="utf-8") as f:
        for line in f:
            if line.startswith("#") or "\tkTraditionalVariant\t" not in line:
                continue
            cp, _, values = line.rstrip("\n").split("\t")
            for v in values.split():
                trad[chr(int(cp[2:], 16))].add(chr(int(v[2:], 16)))
    return trad


def read_manual(path: Path) -> dict[str, tuple[str, str, str]]:
    """later character -> (headword, kind, citation), from a curated TSV."""
    entries: dict[str, tuple[str, str, str]] = {}
    if not path.exists():
        return entries
    with path.open(encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            if line.startswith("#") or not line.strip():
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) != 4 or len(parts[0]) != 1 or len(parts[1]) != 1 \
                    or parts[2] not in ("original", "simplified", "exclude") or not parts[3].strip():
                raise ValueError(f"{path}:{lineno}: expected later, headword, kind, source")
            entries[parts[0]] = (parts[1], parts[2], parts[3].strip())
    return entries


def read_notes(path: Path) -> dict[str, tuple[str, str]]:
    """later character -> (headword, citation), from extract_note_forms.py output."""
    notes: dict[str, tuple[str, str]] = {}
    if not path.exists():
        return notes
    with path.open(encoding="utf-8") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            later, head, who, entry, quote = line.rstrip("\n").split("\t")
            notes[later] = (head, f"{who}（「{entry}」字下）：「{quote}」")
    return notes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("shuowen", type=Path, help="clone of github.com/shuowenjiezi/shuowen")
    parser.add_argument("--map", type=Path, default=DEFAULT_MAP)
    parser.add_argument("--variants", type=Path, default=DEFAULT_VARIANTS)
    parser.add_argument("--unihan", type=Path, default=DEFAULT_UNIHAN)
    parser.add_argument("--manual", type=Path, default=DEFAULT_MANUAL)
    parser.add_argument("--old-forms", type=Path, default=DEFAULT_OLD_FORMS,
                        help="Shanggu table; its simplified -> traditional pairs are added (OFL-1.1)")
    parser.add_argument("--notes", type=Path, default=DEFAULT_NOTES,
                        help="commentary pairs from scripts/extract_note_forms.py; skipped if absent")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    with args.map.open(encoding="utf-8") as f:
        mcjk = {cp for cp in json.load(f)["mcjk"] if cp}
    variant_keys = read_variant_keys(args.variants)
    traditional = read_traditional(args.unihan)

    def has_seal(ch: str) -> bool:
        return ord(ch) in mcjk or ch in variant_keys

    files = sorted((args.shuowen / "data").glob("*.json"), key=lambda p: int(re.sub(r"\D", "", p.stem) or 0))
    if not files:
        print(f"{args.shuowen}/data: no entries found", file=sys.stderr)
        return 1

    targets: dict[str, list[str]] = collections.defaultdict(list)
    for path in files:
        with path.open(encoding="utf-8") as f:
            entry = json.load(f)
        head = entry.get("wordhead", "")
        if len(head) != 1:
            continue
        for alias in entry.get("indexes") or []:
            if len(alias) == 1 and alias != head and not has_seal(alias) and head not in targets[alias]:
                targets[alias].append(head)

    # Precedence: curated manual entries, then commentary (徐鉉/段注) statements,
    # then shuowen.org search aliases, then Shanggu simplified pairs.
    result: dict[str, dict[str, list[str]]] = {"original": {}, "simplified": {}}
    citations: dict[str, str] = {}

    def kind_of(alias: str) -> str:
        # Any character with a distinct traditional form is a simplified character,
        # even when its headword is a Shuowen form of that traditional character.
        return "simplified" if traditional.get(alias, set()) - {alias} else "original"

    manual = read_manual(args.manual)
    for alias, (head, kind, citation) in manual.items():
        if kind == "exclude":
            targets.pop(alias, None)
            continue
        if has_seal(alias):
            print(f"warning: manual entry {alias} already has a seal form; skipped", file=sys.stderr)
            continue
        result[kind][alias] = [head] + [h for h in targets.pop(alias, []) if h != head]
        citations[alias] = citation

    notes = read_notes(args.notes)
    for alias, (head, citation) in notes.items():
        if alias in manual or has_seal(alias) or not has_seal(head):
            continue
        result[kind_of(alias)][alias] = [head] + [h for h in targets.pop(alias, []) if h != head]
        citations[alias] = citation

    for alias, heads in sorted(targets.items()):
        result[kind_of(alias)][alias] = heads
        citations[alias] = f"《說文》「{heads[0]}」字頭之檢索字（shuowen.org）"

    # Simplified -> traditional pairs from the Shanggu table fill gaps (e.g. 则 -> 則).
    if args.old_forms.exists():
        with args.old_forms.open(encoding="utf-8") as f:
            for line in f:
                parts = line.rstrip("\n").split("-")
                if line.startswith("#") or len(parts) != 2 or len(parts[0]) != 1 or len(parts[1]) != 1:
                    continue
                simp, trad = parts
                if kind_of(simp) == "simplified" and not has_seal(simp) and has_seal(trad) \
                        and simp not in result["simplified"] and simp not in result["original"] and simp not in manual:
                    result["simplified"][simp] = [trad]
                    citations[simp] = "簡繁對應（尚古字型 stoneo.dt）"

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as f:
        json.dump({"source": "shuowen.org data, github.com/shuowenjiezi/shuowen (Apache-2.0)", **result,
                   "notes": dict(sorted(citations.items()))},
                  f, ensure_ascii=False, separators=(",", ":"))
    ambiguous = sum(1 for heads in targets.values() if len(heads) > 1)
    print(f"{len(files)} entries + {len(manual)} manual + {len(notes)} commentary: {len(result['original'])} original, {len(result['simplified'])} simplified "
          f"({ambiguous} with several headwords) -> {args.output.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
