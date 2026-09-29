# OpenSmallSealConverter

**Try it: https://seky443.github.io/OpenSmallSealConverter/**

A client-side converter from Chinese text to Unicode Small Seal characters
(Unicode 18.0, block U+3D000–U+3FC3F). The UI is available in Traditional
Chinese, Simplified Chinese, and English.

- **Output** is real Small Seal code points, ready to copy.
- **Preview** renders each seal character's modern equivalent (`kSEAL_MCJK`)
  in a seal-style font, because few devices have a native Small Seal font yet.

Input can be Traditional or Simplified Chinese. The preview is shown as an ink
rubbing, horizontally or in vertical columns (直排); clicking a character shows
its code point, any substitution with its source text, seal variants, and a
link to zi.tools. The preview can be exported as a PNG in the current layout,
with a chosen text colour and a transparent (default) or solid background.

URL parameters, handy for sharing a conversion:

| Parameter | Example | Effect |
|---|---|---|
| `q` | `?q=關關雎鳩` | prefills the input |
| `lang` | `?lang=zh-Hans` | interface language: `zh-Hant`, `zh-Hans` or `en` |
| `layout` | `?layout=horizontal` | preview layout: `vertical` (default) or `horizontal` |

## Development

Requirements: Node.js 22.18+ (runs TypeScript tests natively), Python 3.

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (node --test)
npm run typecheck
npm run build        # outputs dist/
```

### Data

`public/data/seal-map.json` is generated from the Unicode
[`SealSources.txt`](https://www.unicode.org/Public/18.0.0/ucd/SealSources.txt)
kept in `data/`:

```sh
npm run data
```

### Variants and original-form substitution

`kSEAL_MCJK` often lists a seal under its Shuowen transcription (隸定字)
rather than the character people type (the seal of 之 is listed as U+21CFF).
Three more data files close that gap:

| File | Built by | Source | Purpose |
|---|---|---|---|
| `public/data/seal-variants.json` | `npm run variants -- <shuowen clone>` | OpenCC `SealVariants.txt` (Apache-2.0), alignment of the shuowen.org headword sequence with `kSEAL_CCZSrc` order, `data/seal-variants.manual.tsv` | same character, transcribed form (之 → U+3E195, 其 → U+3DDAF) |
| `public/data/original-forms.json` | `npm run original-forms -- <shuowen clone>` | [shuowenjiezi/shuowen](https://github.com/shuowenjiezi/shuowen) (Apache-2.0) + `data/original-forms.manual.tsv` | characters with no seal form → Shuowen headword: later characters (洲 → 州) and simplified forms (诛 → 誅) |

Clone the shuowen.org data first:
`git clone --depth 1 https://github.com/shuowenjiezi/shuowen.git <dir>`.
The alignment agrees with OpenCC on 100% of overlapping characters.

`original-forms.json` draws on four sources, in this order of precedence:

1. `data/original-forms.manual.tsv`: curated entries with citations. The
   `exclude` kind blocks a wrong automatic substitution.
2. `data/original-forms.notes.tsv`: statements by Xu Xuan (徐鉉, e.g.
   「今別作洲，非是」) and Duan Yucai (段注, e.g. 「說者、今之悅字」),
   extracted by `npm run notes -- <shuowen clone>` and reviewed by hand.
3. shuowen.org headword search aliases (`indexes`).
4. Simplified → traditional pairs from the Shanggu table.

Every substitution carries its citation, which the detail panel shows.

Both `*.manual.tsv` files hold curated entries, each with a source citation
(Shuowen text, cross-checked on zi.tools), and take precedence over automatic
data. `data/review/unmatched-common.txt` lists frequent characters that still
have no seal form, as a review queue.

Substitution only applies to characters with no seal form of their own and is
flagged in the preview. Add curated entries, each with a source citation, to
`data/original-forms.manual.tsv`. Clicking a character opens a detail panel
with a link to its [zi.tools](https://zi.tools) page.

### Simplified input

Simplification merged several characters into one (後/后, 裏/里, 乾/幹/干, 穀/谷,
髮/發/发), and some simplified characters are ancient characters with a seal of
their own. Converting simplified text character by character would therefore
pick the wrong seal (以后 would become the 后 of 皇后). When the input is
simplified, it is first converted to traditional phrase by phrase with OpenCC's
dictionaries (Apache-2.0), then converted to seal script:

- `npm run s2t` builds `public/data/s2t.json` from
  `data/OpenCC-STCharacters.txt` and `data/OpenCC-STPhrases.txt`, keeping
  OpenCC's full phrase table (≈1.2 MB, ≈430 KB gzipped). The page loads it
  only when needed. Its longest-match conversion reproduces OpenCC exactly:
  on 13,449 test sentences (258k characters) the output is identical.
- If the traditional form has no seal, the character is left unconverted
  rather than using the simplified character's own seal, because simplification
  often reused an unrelated ancient character (厂 for 廠, 蜡 for 蠟). Where the
  simplified character really is the original form (佔 → 占, 餚 → 肴), a cited
  entry in `data/original-forms.manual.tsv` maps the traditional form back.
- Detection is automatic: a text counts as simplified when at least 10% of its
  Han characters occur only in simplified Chinese. Characters that also have a
  seal of their own (于, 无, 黄) do not count, so classical texts are not
  misread. The input panel also offers explicit "Traditional" and "Simplified"
  choices for texts that detection cannot decide.

### Preview font

The preview uses the Chong Xi Small Seal font (崇羲篆體) by 王心怡 and 季旭昇,
released by Academia Sinica's Xiaoxuetang. It may be redistributed
**unmodified** with attribution, so `public/fonts/chongxi.otf` is the original
file (no subsetting or WOFF2 conversion) and the page shows the credit. The
site icons are rendered from its 篆 glyph with `npm run icons` (requires
Pillow).

`npm run build` strips any other font file from `dist/fonts/`. After changing
the data, regenerate the list of characters the font lacks (requires
[fontTools](https://github.com/fonttools/fonttools)):

```sh
npm run font:coverage
```

### Testing with pre-Qin texts

The [通假字資源庫](https://github.com/frederick-wang/tongjiazi-resources)
(MIT, Wang et al., CCL 2023) contains 3,295 pre-Qin sentences in their
original orthography. `npm run evaluate -- <path to yuliao.jsonl>` reports
coverage on it and on Big5 frequent characters, and refreshes the lists in
`data/review/`. Tongjia (通假) characters are
kept as written, since they are the original text.

## Sources and links 資料來源與相關連結

### Unicode Small Seal 小篆編碼

- [Unicode 18.0 Small Seal code chart (U+3D000–U+3FC3F)](https://www.unicode.org/charts/PDF/Unicode-18.0/U180-3D000.pdf)
- [SealSources.txt](https://www.unicode.org/Public/18.0.0/ucd/SealSources.txt): the official source and modern-character data (`kSEAL_MCJK`) this tool is built on
- [WG2 N5318R: Proposal to encode Four-Column Small Seal Script in UCS](https://www.unicode.org/wg2/docs/n5318R-Proposal%20to%20encode%20Four-Column%20Small%20Seal%20Script%20in%20UCS.pdf) (TCA and China): editions, unification and modern-character principles
- [WG2 N5344R: final Small Seal proposal](http://www.unicode.org/wg2/docs/n5344R-SmallSealProposal.pdf) and [UTC #185 minutes](https://www.unicode.org/L2/L2025/25226.htm), where the encoding was approved
- [UAX #38: Unicode Han Database (Unihan)](https://www.unicode.org/reports/tr38/): variant relations used to verify mappings

### Conversion data 轉換資料

- [OpenCC](https://github.com/BYVoid/OpenCC): Small Seal variant table and simplified-to-traditional dictionaries (Apache-2.0)
- [說文解字 shuowen.org](https://www.shuowen.org/) and its data on GitHub, [shuowenjiezi/shuowen](https://github.com/shuowenjiezi/shuowen): headwords, variants, and the notes of Xu Xuan (徐鉉) and Duan Yucai (段玉裁) (Apache-2.0)
- [尚古字型 Shanggu fonts](https://github.com/GuiWonder/Shanggu): new-form to inherited-form (新舊字形) table (OFL-1.1)

### Font 字型

- [崇羲篆體 Chong Xi Small Seal](https://xiaoxue.iis.sinica.edu.tw/chongxi/) by 王心怡 and 季旭昇, released by [中央研究院 小學堂](https://xiaoxue.iis.sinica.edu.tw/)

### Testing and verification 測試與查證

- [通假字資源庫 tongjiazi-resources](https://github.com/frederick-wang/tongjiazi-resources) (MIT): pre-Qin sentences used to measure coverage; Wang et al., [古汉语通假字资源库的构建及应用研究](https://aclanthology.org/2023.ccl-1.47), CCL 2023
- [zi.tools 字統网](https://zi.tools/): used to check individual variant relations by hand, and linked from each character's detail panel

## License

The source code and the project's own curated data (`data/*.manual.tsv`,
`data/review/`) are released under the [MIT License](LICENSE).

Third-party material keeps its own license; see [NOTICE](NOTICE):

- Unicode Character Database files: Unicode License v3
- OpenCC dictionaries and the shuowen.org data, and the files derived from
  them (`public/data/`, `data/original-forms.notes.tsv`): Apache-2.0
- Shanggu fonts table: SIL Open Font License 1.1
- Chong Xi Small Seal font (`public/fonts/chongxi.otf`): free to use and
  redistribute **unmodified** with attribution; not covered by the MIT License
