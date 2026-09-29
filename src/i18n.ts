export const LOCALES = ["zh-Hant", "zh-Hans", "en"] as const;
export type Locale = (typeof LOCALES)[number];

const zhHant = {
  title: "小篆轉換器",
  lede: "把楷書轉成 Unicode 小篆字元（U+3D000–U+3FC3F）。",
  ledeNote: "因目前並無原生支援小篆的字型，預覽以篆體字型顯示對應的現代字；下方「Unicode 小篆輸出」複製出去的，才是真正的小篆碼位。",
  language: "語言",
  inputLabel: "輸入（正體或簡體）",
  inputPlaceholder: "在此輸入文字，例如：天地玄黃",
  sample: "天地玄黃",
  previewHeading: "預覽",
  legendVariant: "有多個小篆異體",
  legendOriginal: "改用《說文》字頭（本字或異體）",
  legendSimplified: "簡體轉為《說文》字頭",
  clickHint: "點擊任一字可查看詳情、選擇異體，或到 zi.tools 查字。",
  substituteMode: "本字轉換",
  substituteHint: "沒有小篆的字（多為漢代以後的後起字或簡體字），依《說文》資料改用對應的字頭，例如「洲」→「州」。本身有小篆的字不會被替換。",
  originalTitle: (from: string, to: string) => `「${from}」改用《說文》字頭「${to}」`,
  simplifiedTitle: (from: string, to: string) => `簡體「${from}」→「${to}」`,
  statsOriginal: (n: number) => `${n} 字改用本字`,
  statsSimplified: (n: number) => `${n} 字由簡體轉換`,
  detailNoSeal: (char: string) => `「${char}」在 Unicode 小篆中沒有對應字，也找不到可替換的《說文》字頭。`,
  openZiTools: (char: string) => `在 zi.tools 查「${char}」↗`,
  legendNoGlyph: "預覽字型缺字（仍可正常輸出）",
  legendNoSeal: "沒有對應小篆，原樣保留",
  variantNote: "這個字有多個小篆異體，預覽字形相同；需安裝原生小篆字型才能看出差別。",
  outputLabel: "Unicode 小篆輸出",
  copy: "複製",
  copied: "已複製",
  copyManually: "請按 Ctrl/⌘ + C",
  outputNote: "沒有安裝小篆字型的裝置會顯示成方塊，這是正常的：資料本身正確。",
  noteLabel: "依據：",
  scriptLabel: "輸入字體",
  scriptAuto: "自動",
  scriptTraditional: "正體",
  scriptSimplified: "簡體",
  scriptHint: "簡體會先以 OpenCC 依詞組轉為正體再轉換，但一簡對多繁時仍可能判斷錯誤；為求準確，建議直接輸入正體。",
  statsS2T: "已依詞組簡轉繁",
  exportPng: "匯出 PNG",
  exportInk: "文字",
  exportPaper: "背景",
  exportTransparent: "透明背景",
  horizontal: "橫排",
  previewEmpty: "在輸入框中輸入文字，這裡會顯示小篆。",
  vertical: "直排",
  fontLoading: "篆體字型載入中…",
  aboutTitle: "關於 Unicode 小篆與本工具",
  about: [
    [
      "什麼是 Unicode 小篆",
      "2026 年發布的 Unicode 18.0 收錄了 11,328 個小篆字元（U+3D000–U+3FC3F），依據《說文解字》的藤花榭本、陳昌治本、小徐本（祁寯藻刻本）與段玉裁注本四種版本，由臺灣與中國的學者共同提案。小篆是秦代整理規範的字體，東漢許慎據以編成《說文解字》，收正篆 9,353 字、重文 1,163 字。",
    ],
    [
      "為什麼有些字轉不出來",
      "Unicode 小篆只收錄《說文》所載的字。許慎並未收盡當時所有用字，漢代以後新造的字（如「你」「們」）更不在其中。先秦古書原本也不是用小篆書寫：戰國各國文字不同，今本古籍多經漢代以隸書轉寫。因此本工具呈現的是「以《說文》小篆書寫」的樣貌，找不到的字會原樣保留並以灰色標示。",
    ],
    [
      "本字與異寫",
      "官方對照常以隸定字記錄小篆（如「之」記作「𡳿」），本工具另外整合 OpenCC、shuowen.org 說文資料、尚古字型舊字形表與人工校訂，找回同一個字的碼位。沒有小篆的後起字，則依徐鉉、段玉裁等注語改用《說文》字頭（如「洲」→「州」），並以綠色標示；點擊該字可查看出處原文。",
    ],
    [
      "預覽與複製",
      "輸出框中是真正的 Unicode 小篆字元，可以複製到任何地方；但目前多數裝置沒有支援這些碼位的字型，會顯示為方框。預覽區以崇羲篆體顯示對應字形，僅供參考；同一字有多個小篆異體時，可點擊該字選擇。",
    ],
    [
      "資料來源",
      "Unicode 字元資料庫（SealSources.txt、Unihan）、OpenCC（Apache-2.0）、shuowen.org 說文解字資料（Apache-2.0）、尚古字型（OFL-1.1）、中研院小學堂崇羲篆體。另以北京師範大學通假字資源庫的先秦語料測試，並以 zi.tools 查證個別字例。",
    ],
  ] as [string, string][],
  fontCredit: "本轉換器採用由王心怡與季旭昇製作、中研院小學堂釋出之『崇羲篆體』。",
  source: (version: string) => `對照資料：Unicode ${version} SealSources.txt（kSEAL_MCJK）。`,
  statsConverted: (n: number) => `${n} 字已轉換`,
  statsUnmatched: (n: number) => `${n} 字無對應小篆`,
  statsNoGlyph: (n: number) => `${n} 字預覽缺字`,
  noSealTitle: "沒有對應小篆",
  noGlyphTitle: "（預覽字型缺字）",
  loadError: "無法載入對照資料，請重新整理頁面。",
  fontMissing: "篆體字型載入失敗，預覽改以系統字型顯示。",
};

export type Messages = typeof zhHant;

const zhHans: Messages = {
  title: "小篆转换器",
  lede: "把楷书转成 Unicode 小篆字符（U+3D000–U+3FC3F）。",
  ledeNote: "因目前并无原生支持小篆的字体，预览以篆体字体显示对应的现代字；下方“Unicode 小篆输出”复制出去的，才是真正的小篆码位。",
  language: "语言",
  inputLabel: "输入（繁体或简体）",
  inputPlaceholder: "在此输入文字，例如：天地玄黄",
  sample: "天地玄黃",
  previewHeading: "预览",
  legendVariant: "有多个小篆异体",
  legendOriginal: "改用《说文》字头（本字或异体）",
  legendSimplified: "简体转为《说文》字头",
  clickHint: "点击任一字可查看详情、选择异体，或到 zi.tools 查字。",
  substituteMode: "本字转换",
  substituteHint: "没有小篆的字（多为汉代以后的后起字或简体字），依《说文》数据改用对应的字头，例如“洲”→“州”。本身有小篆的字不会被替换。",
  originalTitle: (from, to) => `“${from}”改用《说文》字头“${to}”`,
  simplifiedTitle: (from, to) => `简体“${from}”→“${to}”`,
  statsOriginal: (n) => `${n} 字改用本字`,
  statsSimplified: (n) => `${n} 字由简体转换`,
  detailNoSeal: (char) => `“${char}”在 Unicode 小篆中没有对应字，也找不到可替换的《说文》字头。`,
  openZiTools: (char) => `在 zi.tools 查“${char}”↗`,
  legendNoGlyph: "预览字体缺字（仍可正常输出）",
  legendNoSeal: "没有对应小篆，原样保留",
  variantNote: "这个字有多个小篆异体，预览字形相同；需安装原生小篆字体才能看出差别。",
  outputLabel: "Unicode 小篆输出",
  copy: "复制",
  copied: "已复制",
  copyManually: "请按 Ctrl/⌘ + C",
  outputNote: "没有安装小篆字体的设备会显示成方块，这是正常的：数据本身正确。",
  noteLabel: "依据：",
  scriptLabel: "输入字体",
  scriptAuto: "自动",
  scriptTraditional: "繁体",
  scriptSimplified: "简体",
  scriptHint: "简体会先用 OpenCC 按词组转为繁体再转换，但一简对多繁时仍可能判断错误；为求准确，建议直接输入繁体。",
  statsS2T: "已按词组简转繁",
  exportPng: "导出 PNG",
  exportInk: "文字",
  exportPaper: "背景",
  exportTransparent: "透明背景",
  horizontal: "横排",
  previewEmpty: "在输入框中输入文字，这里会显示小篆。",
  vertical: "竖排",
  fontLoading: "篆体字体加载中…",
  aboutTitle: "关于 Unicode 小篆与本工具",
  about: [
    [
      "什么是 Unicode 小篆",
      "2026 年发布的 Unicode 18.0 收录了 11,328 个小篆字符（U+3D000–U+3FC3F），依据《说文解字》的藤花榭本、陈昌治本、小徐本（祁寯藻刻本）与段玉裁注本四种版本，由台湾与中国的学者共同提案。小篆是秦代整理规范的字体，东汉许慎据以编成《说文解字》，收正篆 9,353 字、重文 1,163 字。",
    ],
    [
      "为什么有些字转不出来",
      "Unicode 小篆只收录《说文》所载的字。许慎并未收尽当时所有用字，汉代以后新造的字（如“你”“们”）更不在其中。先秦古书原本也不是用小篆书写：战国各国文字不同，今本古籍多经汉代以隶书转写。因此本工具呈现的是“以《说文》小篆书写”的样貌，找不到的字会原样保留并以灰色标示。",
    ],
    [
      "本字与异写",
      "官方对照常以隶定字记录小篆（如“之”记作“𡳿”），本工具另外整合 OpenCC、shuowen.org 说文数据、尚古字体旧字形表与人工校订，找回同一个字的码位。没有小篆的后起字，则依徐铉、段玉裁等注语改用《说文》字头（如“洲”→“州”），并以绿色标示；点击该字可查看出处原文。",
    ],
    [
      "预览与复制",
      "输出框中是真正的 Unicode 小篆字符，可以复制到任何地方；但目前多数设备没有支持这些码位的字体，会显示为方框。预览区以崇羲篆体显示对应字形，仅供参考；同一字有多个小篆异体时，可点击该字选择。",
    ],
    [
      "数据来源",
      "Unicode 字符数据库（SealSources.txt、Unihan）、OpenCC（Apache-2.0）、shuowen.org 说文解字数据（Apache-2.0）、尚古字体（OFL-1.1）、中研院小学堂崇羲篆体。另以北京师范大学通假字资源库的先秦语料测试，并以 zi.tools 查证个别字例。",
    ],
  ],
  fontCredit: "本转换器采用由王心怡与季旭昇制作、中研院小学堂释出之『崇羲篆体』。",
  source: (version) => `对照数据：Unicode ${version} SealSources.txt（kSEAL_MCJK）。`,
  statsConverted: (n) => `${n} 字已转换`,
  statsUnmatched: (n) => `${n} 字无对应小篆`,
  statsNoGlyph: (n) => `${n} 字预览缺字`,
  noSealTitle: "没有对应小篆",
  noGlyphTitle: "（预览字体缺字）",
  loadError: "无法加载对照数据，请刷新页面。",
  fontMissing: "篆体字体加载失败，预览改以系统字体显示。",
};

const en: Messages = {
  title: "Open Small Seal Converter",
  lede: "Convert Chinese text to Unicode Small Seal characters (U+3D000–U+3FC3F).",
  ledeNote: "No font supports these code points natively yet, so the preview shows the matching modern characters in a seal-style font; what you copy from the Unicode output below is the real Small Seal code points.",
  language: "Language",
  inputLabel: "Input (Traditional or Simplified Chinese)",
  inputPlaceholder: "Type Chinese here, e.g. 天地玄黃",
  sample: "天地玄黃",
  previewHeading: "Preview",
  legendVariant: "Several seal variants",
  legendOriginal: "Replaced by its Shuowen headword (original or variant form)",
  legendSimplified: "Simplified character mapped to its Shuowen headword",
  clickHint: "Click any character for details, to pick a variant, or to look it up on zi.tools.",
  substituteMode: "Original-form substitution",
  substituteHint: "Characters with no seal form (mostly post-Han characters or simplified forms) are replaced by their Shuowen headword, e.g. 洲 → 州. Characters that have a seal form are never replaced.",
  originalTitle: (from, to) => `${from} replaced by Shuowen headword ${to}`,
  simplifiedTitle: (from, to) => `Simplified ${from} → ${to}`,
  statsOriginal: (n) => `${n} replaced by original forms`,
  statsSimplified: (n) => `${n} from simplified`,
  detailNoSeal: (char) => `${char} has no Unicode Small Seal equivalent and no Shuowen headword to substitute.`,
  openZiTools: (char) => `Look up ${char} on zi.tools ↗`,
  legendNoGlyph: "Missing from the preview font (output is still correct)",
  legendNoSeal: "No Small Seal form — kept as is",
  variantNote: "This character has several Small Seal variants; their previews look identical. A native Small Seal font is needed to tell them apart.",
  outputLabel: "Unicode Small Seal output",
  copy: "Copy",
  copied: "Copied",
  copyManually: "Press Ctrl/⌘ + C",
  outputNote: "Devices without a Small Seal font show boxes here. That is expected: the text itself is correct.",
  noteLabel: "Source: ",
  scriptLabel: "Input script",
  scriptAuto: "Auto",
  scriptTraditional: "Traditional",
  scriptSimplified: "Simplified",
  scriptHint: "Simplified text is first converted to Traditional phrase by phrase with OpenCC, which can still pick the wrong character where one simplified character stands for several; for accuracy, type Traditional Chinese.",
  statsS2T: "simplified converted by phrase",
  exportPng: "Export PNG",
  exportInk: "Text",
  exportPaper: "Background",
  exportTransparent: "Transparent",
  horizontal: "Horizontal",
  previewEmpty: "Type in the input box and the Small Seal text appears here.",
  vertical: "Vertical",
  fontLoading: "Loading the seal font…",
  aboutTitle: "About Unicode Small Seal and this tool",
  about: [
    [
      "What is Unicode Small Seal?",
      "Unicode 18.0 (2026) encodes 11,328 Small Seal characters (U+3D000–U+3FC3F), based on four editions of the Shuowen Jiezi: the Tenghuaxie, Chen Changzhi, Xiaoxu (Qi Junzao) and Duan Yucai editions. The proposal came from scholars in Taiwan and mainland China. Small Seal is the script standardised under the Qin; Xu Shen's Shuowen Jiezi (Eastern Han) records 9,353 headwords and 1,163 variant forms.",
    ],
    [
      "Why some characters cannot be converted",
      "Unicode Small Seal only covers characters recorded in the Shuowen. Xu Shen did not collect every character in use, and characters created after the Han (such as 你 or 們) are absent. Pre-Qin texts were not originally written in Small Seal either: the Warring States used different regional scripts, and received texts were mostly transcribed into clerical script in the Han. This tool shows the text as written in Shuowen Small Seal; characters without a seal form are kept and shown in grey.",
    ],
    [
      "Original forms and variant spellings",
      "The official data often records a seal under its transcribed form (the seal of 之 is listed as 𡳿). This tool also draws on OpenCC, the shuowen.org data, the Shanggu inherited-form table and manual review to find the code point for the same character. A later character with no seal form is replaced by its Shuowen headword on the authority of Xu Xuan or Duan Yucai (e.g. 洲 → 州), marked in green; click it to see the source text.",
    ],
    [
      "Preview and copying",
      "The output box holds real Unicode Small Seal characters that you can copy anywhere, but most devices do not yet have a font for them and will show boxes. The preview renders the matching glyphs with the Chong Xi Small Seal font for reference; click a character with several seal variants to choose one.",
    ],
    [
      "Sources",
      "Unicode Character Database (SealSources.txt, Unihan), OpenCC (Apache-2.0), shuowen.org Shuowen data (Apache-2.0), Shanggu fonts (OFL-1.1), and the Chong Xi Small Seal font from Academia Sinica's Xiaoxuetang. Tested on the pre-Qin sentences of the Beijing Normal University tongjiazi corpus; individual cases checked on zi.tools.",
    ],
  ],
  fontCredit: "This converter uses the Chong Xi Small Seal font (崇羲篆體) by 王心怡 and 季旭昇, released by Academia Sinica's Xiaoxuetang (小學堂).",
  source: (version) => `Data: Unicode ${version} SealSources.txt (kSEAL_MCJK).`,
  statsConverted: (n) => `${n} converted`,
  statsUnmatched: (n) => `${n} without a seal form`,
  statsNoGlyph: (n) => `${n} missing from preview font`,
  noSealTitle: "No Small Seal form",
  noGlyphTitle: " (missing from preview font)",
  loadError: "Could not load the conversion data. Please reload the page.",
  fontMissing: "The seal font failed to load; the preview uses a system font instead.",
};

export const MESSAGES: Record<Locale, Messages> = { "zh-Hant": zhHant, "zh-Hans": zhHans, en };

export const LOCALE_NAMES: Record<Locale, string> = {
  "zh-Hant": "正體中文",
  "zh-Hans": "简体中文",
  en: "English",
};

/** Pick a supported locale from BCP 47 tags such as navigator.languages. */
export function matchLocale(tags: readonly string[]): Locale {
  for (const raw of tags) {
    const tag = raw.toLowerCase();
    if (!tag.startsWith("zh")) {
      if (tag.startsWith("en")) return "en";
      continue;
    }
    if (tag.includes("hans") || /^zh-(cn|sg|my)\b/.test(tag)) return "zh-Hans";
    return "zh-Hant";
  }
  return "en";
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
