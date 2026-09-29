import assert from "node:assert/strict";
import { test } from "node:test";
import { isLocale, LOCALES, matchLocale, MESSAGES } from "./i18n.ts";

test("matches browser language tags to supported locales", () => {
  assert.equal(matchLocale(["zh-TW"]), "zh-Hant");
  assert.equal(matchLocale(["zh-HK"]), "zh-Hant");
  assert.equal(matchLocale(["zh-Hant-TW"]), "zh-Hant");
  assert.equal(matchLocale(["zh-CN"]), "zh-Hans");
  assert.equal(matchLocale(["zh-Hans"]), "zh-Hans");
  assert.equal(matchLocale(["zh-SG"]), "zh-Hans");
  assert.equal(matchLocale(["en-US", "zh-TW"]), "en");
  assert.equal(matchLocale(["ja-JP", "zh-CN"]), "zh-Hans");
  assert.equal(matchLocale(["fr-FR"]), "en");
  assert.equal(matchLocale([]), "en");
});

test("validates stored locale values", () => {
  assert.ok(isLocale("zh-Hans"));
  assert.ok(!isLocale("zh"));
  assert.ok(!isLocale(null));
});

test("every locale defines every message", () => {
  const keys = Object.keys(MESSAGES["zh-Hant"]).sort();
  for (const locale of LOCALES) {
    assert.deepEqual(Object.keys(MESSAGES[locale]).sort(), keys, locale);
  }
});
