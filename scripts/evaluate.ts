/**
 * Measure conversion coverage and refresh the review lists in data/review/.
 *
 *   node scripts/evaluate.ts [path/to/tongjiazi/yuliao.jsonl]
 *
 * - Big5 frequent characters (A440-C67E), as a proxy for common characters.
 * - Pre-Qin sentences of the tongjiazi corpus
 *   (github.com/frederick-wang/tongjiazi-resources, MIT), if a path is given.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createIndex, parseSubstitutions, tokenize, type SealIndex, type Substitutions } from "../src/convert.ts";

const root = new URL("../", import.meta.url);
const readJson = (path: string) => JSON.parse(readFileSync(new URL(path, root), "utf-8"));

const map = readJson("public/data/seal-map.json");
const variants = readJson("public/data/seal-variants.json");
const subs: Substitutions = parseSubstitutions(readJson("public/data/original-forms.json"));
const standard = createIndex(map, { variants });

const PRE_QIN = new Set(["先秦", "商", "西周", "周", "春秋", "战国", "东周"]);

function measure(texts: Iterable<string>, index: SealIndex) {
  let total = 0;
  let converted = 0;
  let substituted = 0;
  const missing = new Map<string, number>();
  for (const text of texts) {
    for (const token of tokenize(text, index, new Map(), subs)) {
      if (token.kind === "plain" && !token.unmatchedHan) continue;
      total++;
      if (token.kind === "seal") {
        converted++;
        if (token.substitute) substituted++;
      } else {
        missing.set(token.text, (missing.get(token.text) ?? 0) + 1);
      }
    }
  }
  return { total, converted, substituted, missing: [...missing].sort((a, b) => b[1] - a[1]) };
}

function report(label: string, texts: string[]): ReturnType<typeof measure> {
  const std = measure(texts, standard);
  const pct = (n: number, d: number) => ((n / d) * 100).toFixed(2) + "%";
  const line = `${label}: standard ${std.converted}/${std.total} (${pct(std.converted, std.total)}), substituted ${std.substituted}`;
  console.log(`${line}; ${std.missing.length} kinds missing`);
  return std;
}

// Big5 frequent characters.
const big5: string[] = [];
const decoder = new TextDecoder("big5");
for (let hi = 0xa4; hi <= 0xc6; hi++) {
  for (const lo of [...Array.from({ length: 63 }, (_, i) => 0x40 + i), ...Array.from({ length: 94 }, (_, i) => 0xa1 + i)]) {
    if (hi === 0xc6 && lo > 0x7e) break;
    const ch = decoder.decode(new Uint8Array([hi, lo]));
    if (ch !== "�" && /^\p{Script=Han}$/u.test(ch)) big5.push(ch);
  }
}
const common = report("Big5 frequent", big5);
writeFileSync(
  new URL("data/review/unmatched-common.txt", root),
  "# Big5 frequent characters (A440-C67E) with no seal form (standard mode).\n" +
    "# Review candidates for data/seal-variants.manual.tsv or data/original-forms.manual.tsv.\n" +
    common.missing.map(([c]) => c).join("") +
    "\n",
);

const corpus = process.argv[2];
if (corpus) {
  const rows = readFileSync(corpus, "utf-8").trim().split("\n").map((l) => JSON.parse(l));
  const texts = rows.filter((r) => PRE_QIN.has(r["时代"])).map((r) => String(r["语料"]));
  const preQin = report(`Pre-Qin corpus (${texts.length} sentences)`, texts);
  writeFileSync(
    new URL("data/review/unmatched-preqin.txt", root),
    "# Characters with no seal form (standard mode) in the pre-Qin sentences of the\n" +
      "# tongjiazi corpus (github.com/frederick-wang/tongjiazi-resources), by frequency.\n" +
      preQin.missing.map(([c, n]) => `${c}\t${n}`).join("\n") +
      "\n",
  );
  console.log("Top missing:", preQin.missing.slice(0, 60).map(([c, n]) => c + n).join(" "));
}
