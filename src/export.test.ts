import assert from "node:assert/strict";
import { test } from "node:test";
import { layoutGlyphs, type Glyph } from "./export.ts";

const glyphs = (text: string): Glyph[] => Array.from(text, (t) => ({ text: t, seal: t !== "，" && t !== "。" }));
const lines = (text: string, perLine: number) => {
  const { cells, lines: count } = layoutGlyphs(glyphs(text), perLine);
  return Array.from({ length: count }, (_, i) => cells.filter((c) => c.line === i).map((c) => c.text).join(""));
};

test("wraps lines at the given length", () => {
  assert.deepEqual(lines("天地玄黃宇宙洪荒", 3), ["天地玄", "黃宇宙", "洪荒"]);
});

test("starts a new line at each newline", () => {
  assert.deepEqual(lines("關關雎鳩\n在河之洲", 10), ["關關雎鳩", "在河之洲"]);
});

test("closing punctuation never starts a line", () => {
  assert.deepEqual(lines("關關雎鳩，在河之洲。", 4), ["關關雎鳩，", "在河之洲。"]);
});

test("reports size and handles empty input", () => {
  const layout = layoutGlyphs(glyphs("天地，玄"), 2);
  assert.equal(layout.lines, 2);
  assert.equal(layout.length, 3); // 「天地，」 overflows by the punctuation mark
  assert.deepEqual(layoutGlyphs([], 5), { cells: [], lines: 0, length: 0 });
});
