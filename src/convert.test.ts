import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  createIndex,
  createS2T,
  formatCodePoint,
  parseSubstitutions,
  tokenize,
  toSealText,
  ziToolsUrl,
  type SealMapData,
} from "./convert.ts";

const data: SealMapData = JSON.parse(
  readFileSync(new URL("../public/data/seal-map.json", import.meta.url), "utf-8"),
);
const index = createIndex(data);

test("real data covers the full Small Seal block", () => {
  assert.equal(data.first, 0x3d000);
  assert.equal(data.first + data.mcjk.length - 1, 0x3fc3f);
  assert.ok(data.mcjk.every((cp) => cp > 0));
});

test("maps modern characters to seal code points from SealSources.txt", () => {
  // U+3D000 kSEAL_MCJK 4E00, U+3D001 kSEAL_MCJK 5F0C
  assert.equal(toSealText(tokenize("一弌", index)), "\u{3D000}\u{3D001}");
  assert.equal(index.modernOf(0x3d002), 0x5143);
});

test("keeps non-Han text and flags Han characters without a seal form", () => {
  const small = createIndex({ unicode: "test", first: 0x3d000, mcjk: [0x4e00] });
  const tokens = tokenize("一a 丁\n", small);
  assert.equal(toSealText(tokens), "\u{3D000}a 丁\n");
  assert.deepEqual(
    tokens.filter((t) => t.kind === "plain").map((t) => [t.text, t.kind === "plain" && t.unmatchedHan]),
    [["a", false], [" ", false], ["丁", true], ["\n", false]],
  );
});

test("defaults to the first variant and honors a valid preference", () => {
  const variants = createIndex({ unicode: "test", first: 0x3d000, mcjk: [0x4e00, 0x4e00, 0x4e01] });
  const [first] = tokenize("一", variants);
  assert.ok(first.kind === "seal");
  assert.deepEqual(first.options, [0x3d000, 0x3d001]);
  assert.equal(first.seal, 0x3d000);

  assert.equal(toSealText(tokenize("一", variants, new Map([[0x4e00, 0x3d001]]))), "\u{3D001}");
  // A preference that is not a variant of the character is ignored.
  assert.equal(toSealText(tokenize("一", variants, new Map([[0x4e00, 0x3d002]]))), "\u{3D000}");
});

test("passes existing seal characters through and keeps astral characters intact", () => {
  const tokens = tokenize("\u{3D002}𠀀😀", index);
  assert.equal(tokens.length, 3);
  assert.ok(tokens[0].kind === "seal" && tokens[0].modern === 0x5143);
  assert.equal(toSealText(tokens).endsWith("😀"), true);
});

test("normalizes CJK compatibility ideographs", () => {
  const small = createIndex({ unicode: "test", first: 0x3d000, mcjk: [0x8c48] });
  // U+F900 is canonically equivalent to U+8C48.
  const [token] = tokenize("豈", small);
  assert.ok(token.kind === "seal" && token.seal === 0x3d000 && token.text === "豈");
});

test("rejects malformed map data", () => {
  assert.throws(() => createIndex({ unicode: "x", first: 1.5, mcjk: [] }));
  assert.throws(() => createIndex({ unicode: "x", first: 0, mcjk: null as unknown as number[] }));
});

test("formats code points", () => {
  assert.equal(formatCodePoint(0x3d000), "U+3D000");
  assert.equal(formatCodePoint(0x41), "U+0041");
});

test("variants add characters that kSEAL_MCJK only lists in transcribed form", () => {
  const map: SealMapData = { unicode: "test", first: 0x3d000, mcjk: [0x21cff, 0x4e00, 0x6b6c] };
  const extended = createIndex(map, {
    variants: {
      map: {
        "之": [0x3d000],
        "前": [0x3d002],
        "一": [0x3d001, 0x3d000], // Already covered by kSEAL_MCJK: must not be overridden.
        "xy": [0x3d000], // Not a single character.
        "乙": [0x3e000, 1.5], // Out of range / not an integer.
      },
    },
  });
  assert.equal(toSealText(tokenize("之一前乙", extended)), "\u{3D000}\u{3D001}\u{3D002}乙");
  assert.deepEqual(extended.previewCandidates(0x3d000), [0x21cff, 0x4e4b, 0x4e00]);
  assert.deepEqual(extended.previewCandidates(0x40000), []);
  // Without the variants, 之 stays unconverted.
  assert.equal(toSealText(tokenize("之", createIndex(map))), "之");
});

test("real data: 之 maps to U+3E195 through the variants", () => {
  const variants = JSON.parse(readFileSync(new URL("../public/data/seal-variants.json", import.meta.url), "utf-8"));
  const [token] = tokenize("之", createIndex(data, { variants }));
  assert.ok(token.kind === "seal" && token.seal === 0x3e195);
});

test("substitutes a Shuowen headword only when the input has no seal", () => {
  // U+3D000 = 州, U+3D001 = 爾, U+3D002 = 莫, U+3D003 = 誅
  const small = createIndex({ unicode: "test", first: 0x3d000, mcjk: [0x5dde, 0x723e, 0x83ab, 0x8a85] });
  const subs = parseSubstitutions({
    original: { "洲": ["州"], "你": ["伱", "爾"], "莫": ["x"], "暮": ["無"] },
    simplified: { "诛": ["誅"] },
    notes: { "洲": "徐鉉：今別作洲，非是。", "你": 42 },
  });
  const tokens = tokenize("洲你莫暮诛", small, new Map(), subs);
  assert.equal(toSealText(tokens), "\u{3D000}\u{3D001}\u{3D002}暮\u{3D003}");
  const [zhou, ni, mo, mu, zhu] = tokens;
  assert.ok(zhou.kind === "seal" && zhou.text === "洲" && zhou.modern === 0x5dde);
  assert.deepEqual(zhou.substitute, { char: 0x5dde, kind: "original", note: "徐鉉：今別作洲，非是。" });
  // Non-string notes are ignored.
  assert.ok(ni.kind === "seal" && ni.substitute?.note === undefined);
  // The first candidate without a seal is skipped.
  assert.ok(ni.kind === "seal" && ni.substitute?.char === 0x723e);
  // A character with its own seal is never replaced.
  assert.ok(mo.kind === "seal" && mo.substitute === undefined);
  // No candidate has a seal: stays unmatched.
  assert.ok(mu.kind === "plain" && mu.unmatchedHan);
  assert.ok(zhu.kind === "seal" && zhu.substitute?.kind === "simplified");
});

test("parses substitution data defensively", () => {
  const parsed = parseSubstitutions({
    original: { "洲": ["州"], "ab": ["州"], "你": "爾", "們": [], "他": ["他", "它", 3, "xy"] },
    simplified: { "洲": ["x"], "诛": ["誅"] },
    other: { "a": ["b"] },
  });
  assert.deepEqual(
    [...parsed].map(([cp, s]) => [String.fromCodePoint(cp), s.kind, s.candidates.map((c) => String.fromCodePoint(c))]),
    [["洲", "original", ["州"]], ["他", "original", ["它"]], ["诛", "simplified", ["誅"]]],
  );
  assert.equal(parseSubstitutions(null).size, 0);
  assert.equal(parseSubstitutions({ original: "x" }).size, 0);
});

test("real data: 洲 falls back to 州, 诛 to 誅", { skip: !existsSync(new URL("../public/data/original-forms.json", import.meta.url)) }, () => {
  const subs = parseSubstitutions(
    JSON.parse(readFileSync(new URL("../public/data/original-forms.json", import.meta.url), "utf-8")),
  );
  const tokens = tokenize("洲诛", index, new Map(), subs);
  assert.ok(tokens.every((t) => t.kind === "seal"));
  assert.deepEqual(tokens.map((t) => t.kind === "seal" && String.fromCodePoint(t.substitute!.char)), ["州", "誅"]);
});

test("builds zi.tools links, including astral characters", () => {
  assert.equal(ziToolsUrl("之"), "https://zi.tools/zi/%E4%B9%8B");
  assert.equal(ziToolsUrl("𡳿"), "https://zi.tools/zi/%F0%A1%B3%BF");
});

test("real data: verified mappings from pre-Qin texts stay stable", () => {
  const read = (file: string) => JSON.parse(readFileSync(new URL(`../public/data/${file}`, import.meta.url), "utf-8"));
  const full = createIndex(data, { variants: read("seal-variants.json") });
  const subs = parseSubstitutions(read("original-forms.json"));
  const expected: Record<string, number> = {
    之: 0x3e195, 其: 0x3ddaf, 快: 0x3ee39, 平: 0x3ddf5, 于: 0x3ddf1, 於: 0x3db44,
    朋: 0x3dab5, 善: 0x3d7af, 徙: 0x3d503, 雍: 0x3da64, 槁: 0x3e07b, 原: 0x3f187,
    孰: 0x3d877, 難: 0x3dadb, 太: 0x3f13d, 衆: 0x3e79f, 鄉: 0x3e2f0, 狖: 0x3eb9b,
    樣: 0x3dff2, 柹: 0x3dfb0, 獎: 0x3ec78, 誼: 0x3d6e7,
  };
  for (const [ch, seal] of Object.entries(expected)) {
    const [token] = tokenize(ch, full, new Map(), subs);
    assert.ok(token.kind === "seal" && token.seal === seal && !token.substitute, ch);
  }
  const [bao] = tokenize("暴", full, new Map(), subs);
  assert.ok(bao.kind === "seal");
  assert.deepEqual(bao.options, [0x3edf4, 0x3e331]);
  for (const [ch, head] of [["洲", "州"], ["雎", "鴡"], ["亨", "亯"], ["熟", "孰"], ["懸", "縣"], ["嶄", "磛"], ["他", "佗"], ["住", "駐"]]) {
    const [token] = tokenize(ch, full, new Map(), subs);
    assert.ok(token.kind === "seal" && token.substitute?.kind === "original", ch);
    assert.equal(String.fromCodePoint(token.substitute!.char), head);
    assert.ok(token.substitute!.note, `${ch} has a citation`);
  }
  // Excluded or unsupported: 志 keeps its own seal (not the later 誌); 希 is not in Shuowen.
  const [zhi] = tokenize("志", full, new Map(), subs);
  assert.ok(zhi.kind === "seal" && zhi.seal === 0x3ee2e && !zhi.substitute);
  assert.equal(tokenize("希", full, new Map(), subs)[0].kind, "plain");
});

test("s2t converts by longest phrase and keeps characters aligned", () => {
  const s2t = createS2T({
    chars: { "后": "後", "发": "發", "们": "們", "头": "頭" },
    phrases: { "皇后": "皇后", "头发": "頭髮", "太长的句子": "太長", "x": "y" },
    simplifiedOnly: "们头",
  });
  const { chars, phrases } = s2t.convert(Array.from("皇后们以后头发"));
  assert.equal(chars.join(""), "皇后們以後頭髮");
  assert.deepEqual(phrases, ["皇后", "皇后", undefined, undefined, undefined, "头发", "头发"]);
  // A phrase whose length changes is ignored (output must stay aligned with input).
  assert.equal(s2t.convert(Array.from("太长的句子")).chars.length, 5);
});

test("s2t detection needs enough simplified-only characters", () => {
  const s2t = createS2T({ chars: {}, phrases: {}, simplifiedOnly: "们这说" });
  assert.ok(s2t.isSimplified("我们这样说"));
  assert.ok(!s2t.isSimplified("學而時習之，不亦說乎"));
  // One simplified-only character in a long traditional sentence is below the threshold.
  assert.ok(!s2t.isSimplified("子曰學而時習之不亦說乎有朋自遠方來不亦樂乎们"));
  assert.ok(!s2t.isSimplified(""));
});

test("real data: simplified input resolves merged characters by phrase", () => {
  const read = (file: string) => JSON.parse(readFileSync(new URL(`../public/data/${file}`, import.meta.url), "utf-8"));
  const full = createIndex(data, { variants: read("seal-variants.json") });
  const subs = parseSubstitutions(read("original-forms.json"));
  const s2t = createS2T(read("s2t.json"));
  const via = (text: string) =>
    tokenize(text, full, new Map(), subs, s2t).map((t) => (t.kind === "seal" ? String.fromCodePoint(t.modern) : t.text)).join("");
  assert.equal(via("头发"), "頭髮");
  assert.equal(via("发展"), "發展");
  assert.equal(via("以后"), "以後");
  assert.equal(via("皇后"), "皇后");
  assert.equal(via("山谷里的谷物"), "山谷裏的穀物");
  // The traditional form has no seal: stay unconverted rather than use the simplified
  // character's own seal, which is an unrelated ancient word (厂 cliff, 蜡, 蝎).
  for (const text of ["工厂", "蜡烛", "蝎子"]) {
    const token = tokenize(text, full, new Map(), subs, s2t).find((t) => "厂蜡蝎".includes(t.text));
    assert.ok(token?.kind === "plain" && token.unmatchedHan, text);
  }
  // 占 -> 佔 (OpenCC) -> 占 (佔 is the later form), with the citation chain.
  const [zhan] = tokenize("占领", full, new Map(), subs, s2t);
  assert.ok(zhan.kind === "seal" && String.fromCodePoint(zhan.modern) === "占" && zhan.substitute?.note?.includes("OpenCC"));
  assert.ok(s2t.isSimplified("我们以后再说"));
  // Classical text with characters that have their own seal (无, 于) is not taken as simplified.
  assert.ok(!s2t.isSimplified("九三：君子終日乾乾，夕惕若厲，无咎。王于興師"));
});
