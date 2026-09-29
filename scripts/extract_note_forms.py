#!/usr/bin/env python3
"""Extract later-character -> Shuowen headword pairs from commentary notes.

Reads the shuowen.org data (Apache-2.0) and looks for statements that a
headword is now written with a later character:

- Xu Xuan (徐鉉, 大徐本): 「今俗作X，非是」「今俗別作X」「今別作X」
- Duan Yucai (段玉裁注): 「俗作X」「俗字作X」「今字作X」「俗乃別製X字」
  「今之X字」「後人作X」「今人作X」

Duan's 「各本作X」「今本作X」 (textual variants between editions) are not
matched. Only pairs where X has no seal form of its own are kept, so a
character that Shuowen does record is never replaced.

Writes a TSV (later, headword, commentator, entry, quote) for build_original_forms.py.
Standard library only.
"""

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MAP = ROOT / "public" / "data" / "seal-map.json"
DEFAULT_VARIANTS = ROOT / "public" / "data" / "seal-variants.json"
DEFAULT_OUTPUT = ROOT / "data" / "original-forms.notes.tsv"

HAN = r"[㐀-鿿\U00020000-\U0003134f]"
# X must be a single character followed by punctuation, 非, or 字 (「今之X字」).
END = r"(?=[，。；、：！？」』）\s]|非|字|$)"
XUAN = re.compile(rf"今(?:俗)?(?:別|别)?作({HAN}){END}")
DUAN = [
    re.compile(rf"(?<![各本諸])俗(?:字)?(?:別|别)?作({HAN}){END}"),
    re.compile(rf"今字(?:作)?({HAN}){END}"),
    re.compile(rf"俗乃?(?:別|别)製({HAN})字"),
    re.compile(rf"今之({HAN})字"),
    re.compile(rf"後人(?:乃)?(?:作|加.旁作)({HAN}){END}"),
    re.compile(rf"今人(?:作|用)({HAN}){END}"),
]


SUBJECT_SKIP = "卽即者乃又亦、"
# Function words that can precede a pattern without naming a character.
NOT_SUBJECT = set("皆此是乃則故而按亦也其今凡蓋葢謂曰云以爲為之字所者或與及卽即又則尤")
HAN_RE = re.compile(HAN)
AMBIGUOUS = object()


def note_subject(text: str, start: int, pattern_text: str):
    """What a Duan note at `start` is about.

    Returns a character when the note names one (「瑳俗作磋」, 「盡之字俗作儩」),
    None when it is about the headword (「其字俗作店」, or 「俗作罥」 opening a
    sentence), and AMBIGUOUS when it cannot tell (「皆今之妙字」, or 「今之X字」
    with no subject, which often refers back to another character).
    """
    i = start
    while i > 0 and text[i - 1] in SUBJECT_SKIP:
        i -= 1
    if text[max(0, i - 2):i] == "其字":
        return None
    if text[max(0, i - 2):i] == "之字":
        i -= 2
    if i == 0 or not HAN_RE.fullmatch(text[i - 1]):
        return None if pattern_text.startswith("俗") else AMBIGUOUS
    subject = text[i - 1]
    return AMBIGUOUS if subject in NOT_SUBJECT else subject


def quote_around(text: str, start: int, end: int, width: int = 18) -> str:
    """The sentence (or a window) around a match, for citation."""
    left = max(text.rfind("。", 0, start) + 1, start - width)
    right_stop = text.find("。", end)
    right = min(right_stop + 1 if right_stop >= 0 else len(text), end + width)
    return text[left:right].strip()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("shuowen", type=Path, help="clone of github.com/shuowenjiezi/shuowen")
    parser.add_argument("--map", type=Path, default=DEFAULT_MAP)
    parser.add_argument("--variants", type=Path, default=DEFAULT_VARIANTS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    with args.map.open(encoding="utf-8") as f:
        mcjk = {chr(cp) for cp in json.load(f)["mcjk"] if cp}
    with args.variants.open(encoding="utf-8") as f:
        variants = set(json.load(f)["map"])

    def has_seal(ch: str) -> bool:
        return ch in mcjk or ch in variants

    found: dict[str, tuple[str, str, str, str]] = {}
    for path in sorted((args.shuowen / "data").glob("*.json"), key=lambda p: int(re.sub(r"\D", "", p.stem) or 0)):
        entry = json.loads(path.read_text(encoding="utf-8"))
        head = entry.get("wordhead", "")
        if len(head) != 1 or not has_seal(head):
            continue
        sources = [("徐鉉", entry.get("xuan_note") or "", [XUAN])]
        sources += [("段注", n.get("note") or "", DUAN) for n in entry.get("duan_notes") or []]
        for who, text, patterns in sources:
            for pattern in patterns:
                for m in pattern.finditer(text):
                    later = m.group(1)
                    target = head
                    if who == "段注":
                        subject = note_subject(text, m.start(), m.group(0))
                        if subject is AMBIGUOUS:
                            continue
                        if subject is not None:
                            # Only trust a named subject that is itself a seal character.
                            if not has_seal(subject):
                                continue
                            target = subject
                    if later == target or has_seal(later) or later in found:
                        continue
                    # 「今俗作必駕切」 is about pronunciation, not a character.
                    if text[m.end(1):m.end(1) + 1] in "切反":
                        continue
                    found[later] = (target, who, head, quote_around(text, m.start(), m.end()))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as f:
        f.write("# Generated by scripts/extract_note_forms.py from shuowen.org data (Apache-2.0).\n")
        f.write("# later<TAB>headword<TAB>commentator<TAB>entry the note is under<TAB>quote\n")
        for later, (target, who, entry_head, quote) in sorted(found.items()):
            f.write(f"{later}\t{target}\t{who}\t{entry_head}\t{quote}\n")
    by = {w: sum(1 for v in found.values() if v[1] == w) for w in ("徐鉉", "段注")}
    print(f"{len(found)} pairs ({by['徐鉉']} 徐鉉, {by['段注']} 段注) -> {args.output.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
