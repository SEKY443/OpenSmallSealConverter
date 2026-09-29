import "./style.css";
import {
  createIndex,
  createS2T,
  formatCodePoint,
  parseSubstitutions,
  tokenize,
  toSealText,
  ziToolsUrl,
  type SealExtraData,
  type SealIndex,
  type SealMapData,
  type S2T,
  type S2TData,
  type Substitution,
  type Token,
} from "./convert.ts";
import { renderCanvas, type Glyph } from "./export.ts";
import { isLocale, LOCALE_NAMES, LOCALES, matchLocale, MESSAGES, type Locale, type Messages } from "./i18n.ts";

type SealToken = Extract<Token, { kind: "seal" }>;

const LOCALE_KEY = "seal-converter.locale";
const SUBSTITUTE_KEY = "seal-converter.substitute";
const LAYOUT_KEY = "seal-converter.layout";
const SCRIPT_KEY = "seal-converter.script";
const EXPORT_KEY = "seal-converter.export";
const PREVIEW_FONT = "SealPreview";
const base = import.meta.env.BASE_URL;

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const input = $<HTMLTextAreaElement>("input");
const preview = $<HTMLDivElement>("preview");
const output = $<HTMLTextAreaElement>("output");
const stats = $<HTMLParagraphElement>("stats");
const copyButton = $<HTMLButtonElement>("copy");
const localeSelect = $<HTMLSelectElement>("locale");
const substituteToggle = $<HTMLInputElement>("substitute");
const detailPanel = $<HTMLDivElement>("detail-panel");
const detailTitle = $<HTMLParagraphElement>("detail-title");
const variantOptions = $<HTMLDivElement>("variant-options");
const variantNote = $<HTMLParagraphElement>("variant-note");
const detailLinks = $<HTMLParagraphElement>("detail-links");
const detailNote = $<HTMLParagraphElement>("detail-note");
const legend = $<HTMLUListElement>("legend");
const exportButton = $<HTMLButtonElement>("export-png");
const exportInk = $<HTMLInputElement>("export-ink");
const exportPaper = $<HTMLInputElement>("export-paper");
const exportTransparent = $<HTMLInputElement>("export-transparent");
const scriptButtons = {
  auto: $<HTMLButtonElement>("script-auto"),
  traditional: $<HTMLButtonElement>("script-traditional"),
  simplified: $<HTMLButtonElement>("script-simplified"),
};

/** How to read the input: detect simplified text, or treat it as one or the other. */
type ScriptMode = keyof typeof scriptButtons;
const isScriptMode = (value: string | null): value is ScriptMode => value !== null && value in scriptButtons;
let scriptMode: ScriptMode = isScriptMode(readStored(SCRIPT_KEY)) ? (readStored(SCRIPT_KEY) as ScriptMode) : "auto";
/** Phrase-level simplified -> traditional table, loaded on first need. */
let s2t: S2T | null = null;
let s2tRequested = false;
const fontStatus = $<HTMLParagraphElement>("font-status");
const aboutBody = $<HTMLDivElement>("about-body");
const layoutButtons = {
  horizontal: $<HTMLButtonElement>("layout-horizontal"),
  vertical: $<HTMLButtonElement>("layout-vertical"),
};
const source = $<HTMLParagraphElement>("source");
const fontWarning = $<HTMLParagraphElement>("font-warning");

/** Looked-up code point -> seal variant chosen by the user. */
const preferences = new Map<number, number>();
let index: SealIndex | null = null;
let substitutions = new Map<number, Substitution>();
/** Modern characters the preview font lacks; null when coverage data is unavailable. */
let missingGlyphs: Set<number> | null = null;
let fontFailed = false;
let tokens: Token[] = [];
/** Index into `tokens` of the character shown in the detail panel. */
let activeToken: number | null = null;
let locale: Locale = initialLocale();
let t: Messages = MESSAGES[locale];

function initialLocale(): Locale {
  // ?lang=zh-Hant|zh-Hans|en selects the interface language for this visit.
  const param = new URLSearchParams(location.search).get("lang");
  if (isLocale(param)) return param;
  const stored = readStored(LOCALE_KEY);
  if (isLocale(stored)) return stored;
  return matchLocale(navigator.languages ?? [navigator.language]);
}

function applyLocale(next: Locale): void {
  locale = next;
  t = MESSAGES[locale];
  document.documentElement.lang = locale;
  document.title = t.title;
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const value = t[el.dataset.i18n as keyof Messages];
    if (typeof value === "string") el.textContent = value;
  }
  input.placeholder = t.inputPlaceholder;
  renderAbout();
  if (!fontStatus.hidden) fontStatus.textContent = t.fontLoading;
  localeSelect.value = locale;
  if (fontFailed) fontWarning.textContent = t.fontMissing;
  if (index) {
    source.textContent = t.source(index.unicode);
    render();
  }
}

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(base + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

/** Fetch optional data; resolves to undefined when it is absent. */
function fetchOptional<T>(path: string): Promise<T | undefined> {
  return (fetchJson(path) as Promise<T>).catch(() => undefined);
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not persisting the choice is fine.
  }
}

/**
 * Load the Chong Xi Small Seal font (served unmodified, as its license requires)
 * and the list of characters it lacks, which the preview flags.
 */
async function loadPreviewFont(): Promise<void> {
  try {
    // The font is large, so say that it is loading.
    fontStatus.textContent = t.fontLoading;
    fontStatus.hidden = false;
    document.fonts.add(await new FontFace(PREVIEW_FONT, `url(${base}fonts/chongxi.otf)`).load());
  } catch {
    fontFailed = true;
    fontWarning.textContent = t.fontMissing;
    fontWarning.hidden = false;
    return;
  } finally {
    fontStatus.hidden = true;
  }
  document.documentElement.style.setProperty("--preview-font", `"${PREVIEW_FONT}", serif`);
  const coverage = (await fetchOptional<{ missing?: unknown }>("fonts/chongxi.coverage.json")) ?? {};
  if (Array.isArray(coverage.missing)) {
    missingGlyphs = new Set(coverage.missing.filter((cp): cp is number => Number.isInteger(cp)));
  }
  render();
}


const char = String.fromCodePoint;
const CLOSING_PUNCTUATION = /^[，。、；：！？」』）〕】》〉…,.;:!?)\]]$/u;

function render(): void {
  if (!index) return;
  const subs = substituteToggle.checked ? substitutions : new Map();
  tokens = tokenize(input.value, index, preferences, subs);
  // Load the simplified -> traditional table only when simplified input is possible:
  // chosen explicitly, or a character without a seal of its own appears.
  const mayBeSimplified = tokens.some(
    (tk) => (tk.kind === "plain" && tk.unmatchedHan) || (tk.kind === "seal" && tk.substitute?.kind === "simplified"),
  );
  if (!s2t && (scriptMode === "simplified" || (scriptMode === "auto" && mayBeSimplified))) void loadS2T();
  const useS2T = s2t !== null && (scriptMode === "simplified" || (scriptMode === "auto" && s2t.isSimplified(input.value)));
  if (useS2T) tokens = tokenize(input.value, index, preferences, subs, s2t!);
  output.value = toSealText(tokens);

  const fragment = document.createDocumentFragment();
  const counts = { converted: 0, unmatched: 0, noGlyph: 0, original: 0, simplified: 0, variant: 0 };

  // Each character sits in a nowrap cell; closing punctuation joins the cell of
  // the character before it, so a line never starts with 「，」 or 「。」.
  let lastCell: HTMLSpanElement | null = null;
  const place = (el: HTMLElement): void => {
    lastCell = document.createElement("span");
    lastCell.className = "cell";
    lastCell.append(el);
    fragment.append(lastCell);
  };

  tokens.forEach((token, i) => {
    if (token.kind === "plain" && !token.unmatchedHan) {
      if (lastCell && CLOSING_PUNCTUATION.test(token.text)) lastCell.append(token.text);
      else {
        fragment.append(token.text);
        lastCell = null;
      }
      return;
    }
    const el = document.createElement("button");
    el.type = "button";
    el.dataset.token = String(i);
    if (i === activeToken) el.classList.add("active");

    if (token.kind === "plain") {
      counts.unmatched++;
      el.className = "char no-seal";
      el.title = t.noSealTitle;
      el.textContent = token.text;
      place(el);
      return;
    }

    counts.converted++;
    el.className = "char seal";
    const glyph = previewChar(token);
    el.textContent = char(glyph);
    const titles = [`${token.text} → ${formatCodePoint(token.seal)}`];
    if (token.substitute) {
      counts[token.substitute.kind]++;
      el.classList.add(token.substitute.kind);
      titles.push(
        token.substitute.kind === "original"
          ? t.originalTitle(token.text, char(token.substitute.char))
          : t.simplifiedTitle(token.text, char(token.substitute.char)),
      );
    }
    if (token.options.length > 1) {
      counts.variant++;
      el.classList.add("variant");
    }
    if (missingGlyphs?.has(glyph)) {
      counts.noGlyph++;
      el.classList.add("no-glyph");
      titles.push(t.noGlyphTitle);
    }
    el.title = titles.join("\n");
    place(el);
  });

  if (tokens.length === 0) {
    const empty = document.createElement("span");
    empty.className = "empty";
    empty.textContent = t.previewEmpty;
    fragment.append(empty);
  }
  preview.replaceChildren(fragment);
  // The legend only lists the marks that appear in the current text.
  for (const item of legend.querySelectorAll<HTMLElement>("li[data-kind]")) {
    item.hidden = !counts[item.dataset.kind as keyof typeof counts];
  }
  const parts = [t.statsConverted(counts.converted)];
  if (useS2T) parts.push(t.statsS2T);
  if (counts.original) parts.push(t.statsOriginal(counts.original));
  if (counts.simplified) parts.push(t.statsSimplified(counts.simplified));
  if (counts.unmatched) parts.push(t.statsUnmatched(counts.unmatched));
  if (counts.noGlyph) parts.push(t.statsNoGlyph(counts.noGlyph));
  stats.textContent = parts.join(" · ");

  renderDetailPanel();
}

/** The character to render for a seal token: the first one the preview font has. */
function previewChar(token: SealToken): number {
  if (!missingGlyphs || !missingGlyphs.has(token.modern)) return token.modern;
  const candidates = index?.previewCandidates(token.seal) ?? [];
  return candidates.find((cp) => !missingGlyphs!.has(cp)) ?? token.modern;
}

async function loadS2T(): Promise<void> {
  if (s2tRequested) return;
  s2tRequested = true;
  const data = await fetchOptional<S2TData>("data/s2t.json");
  if (data) {
    s2t = createS2T(data);
    render();
  }
}

function setScriptMode(mode: ScriptMode, persist = true): void {
  scriptMode = mode;
  for (const [name, button] of Object.entries(scriptButtons)) {
    button.setAttribute("aria-pressed", String(name === mode));
  }
  if (persist) store(SCRIPT_KEY, mode);
  render();
}

for (const [name, button] of Object.entries(scriptButtons)) {
  button.addEventListener("click", () => setScriptMode(name as ScriptMode));
}

/** The glyphs the preview shows, for export: seal characters in the seal font. */
function previewGlyphs(): Glyph[] {
  return tokens.map((token) =>
    token.kind === "seal" ? { text: char(previewChar(token)), seal: true } : { text: token.text, seal: false },
  );
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function restoreExportSettings(): void {
  try {
    const saved = JSON.parse(readStored(EXPORT_KEY) ?? "{}") as Record<string, unknown>;
    if (typeof saved.ink === "string" && HEX_COLOR.test(saved.ink)) exportInk.value = saved.ink;
    if (typeof saved.paper === "string" && HEX_COLOR.test(saved.paper)) exportPaper.value = saved.paper;
    if (typeof saved.transparent === "boolean") exportTransparent.checked = saved.transparent;
  } catch {
    // Ignore malformed saved settings; the defaults are black text on transparent.
  }
  exportPaper.disabled = exportTransparent.checked;
}

function saveExportSettings(): void {
  exportPaper.disabled = exportTransparent.checked;
  store(EXPORT_KEY, JSON.stringify({ ink: exportInk.value, paper: exportPaper.value, transparent: exportTransparent.checked }));
}

for (const el of [exportInk, exportPaper, exportTransparent]) el.addEventListener("change", saveExportSettings);

exportButton.addEventListener("click", async () => {
  const glyphs = previewGlyphs();
  if (glyphs.every((g) => !g.text.trim())) return;
  await document.fonts.load(`96px "${PREVIEW_FONT}"`).catch(() => undefined);
  const canvas = renderCanvas(glyphs, {
    vertical: preview.classList.contains("vertical"),
    sealFont: `"${PREVIEW_FONT}"`,
    ink: exportInk.value,
    paper: exportTransparent.checked ? null : exportPaper.value,
  });
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "small-seal.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
});

function renderAbout(): void {
  aboutBody.replaceChildren(
    ...t.about.map(([heading, body]) => {
      const section = document.createElement("section");
      const h = document.createElement("h3");
      h.textContent = heading;
      const p = document.createElement("p");
      p.textContent = body;
      section.append(h, p);
      return section;
    }),
  );
}

type Layout = "horizontal" | "vertical";

function setLayout(layout: Layout, persist = true): void {
  preview.classList.toggle("vertical", layout === "vertical");
  for (const [name, button] of Object.entries(layoutButtons)) {
    button.setAttribute("aria-pressed", String(name === layout));
  }
  if (persist) store(LAYOUT_KEY, layout);
}

for (const [name, button] of Object.entries(layoutButtons)) {
  button.addEventListener("click", () => setLayout(name as Layout));
}

function ziToolsLink(text: string): HTMLAnchorElement {
  const a = document.createElement("a");
  a.href = ziToolsUrl(text);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = t.openZiTools(text);
  return a;
}

function renderDetailPanel(): void {
  const token = activeToken === null ? undefined : tokens[activeToken];
  if (!token || (token.kind === "plain" && !token.unmatchedHan)) {
    activeToken = null;
    detailPanel.hidden = true;
    return;
  }

  const linkChars = [token.text];
  const note = token.kind === "seal" ? token.substitute?.note : undefined;
  detailNote.textContent = note ? t.noteLabel + note : "";
  detailNote.hidden = !note;
  if (token.kind === "plain") {
    detailTitle.textContent = t.detailNoSeal(token.text);
    variantOptions.replaceChildren();
    variantNote.hidden = true;
  } else {
    const parts: string[] = [];
    if (token.substitute) {
      const to = char(token.substitute.char);
      parts.push(token.substitute.kind === "original" ? t.originalTitle(token.text, to) : t.simplifiedTitle(token.text, to));
      linkChars.push(to);
    }
    parts.push(`${token.substitute ? char(token.modern) : token.text} → ${formatCodePoint(token.seal)}`);
    detailTitle.textContent = parts.join(" · ");

    const hasVariants = token.options.length > 1;
    variantNote.hidden = !hasVariants;
    variantOptions.replaceChildren(
      ...(hasVariants
        ? token.options.map((seal) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "variant-option";
            button.setAttribute("aria-pressed", String(seal === token.seal));
            const glyph = document.createElement("span");
            glyph.className = "native";
            glyph.textContent = char(seal);
            const label = document.createElement("span");
            label.textContent = formatCodePoint(seal);
            button.append(glyph, label);
            button.addEventListener("click", () => {
              preferences.set(token.modern, seal);
              render();
            });
            return button;
          })
        : []),
    );
  }

  detailLinks.replaceChildren(
    ...linkChars.flatMap((text, i) => (i ? [document.createTextNode(" · "), ziToolsLink(text)] : [ziToolsLink(text)])),
  );
  detailPanel.hidden = false;
}

preview.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("button[data-token]");
  if (!target) return;
  const i = Number(target.dataset.token);
  activeToken = activeToken === i ? null : i;
  render();
});

input.addEventListener("input", () => {
  // Token positions shift as the text changes.
  activeToken = null;
  render();
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(output.value);
    flash(t.copied);
  } catch {
    output.select();
    flash(t.copyManually);
  }
});

let flashTimer: number | undefined;
function flash(message: string): void {
  copyButton.textContent = message;
  window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => (copyButton.textContent = t.copy), 1500);
}

localeSelect.append(
  ...LOCALES.map((code) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = LOCALE_NAMES[code];
    return option;
  }),
);
localeSelect.addEventListener("change", () => {
  if (!isLocale(localeSelect.value)) return;
  store(LOCALE_KEY, localeSelect.value);
  applyLocale(localeSelect.value);
});

substituteToggle.addEventListener("change", () => {
  store(SUBSTITUTE_KEY, substituteToggle.checked ? "1" : "0");
  render();
});

async function init(): Promise<void> {
  const params = new URLSearchParams(location.search);
  // Vertical columns are the default; ?layout= or a saved choice overrides it.
  const layoutParam = params.get("layout");
  const savedLayout = readStored(LAYOUT_KEY);
  const isLayout = (value: string | null): value is Layout => value === "horizontal" || value === "vertical";
  setLayout(isLayout(layoutParam) ? layoutParam : isLayout(savedLayout) ? savedLayout : "vertical", false);
  setScriptMode(scriptMode, false);
  substituteToggle.checked = readStored(SUBSTITUTE_KEY) !== "0";
  restoreExportSettings();
  applyLocale(locale);
  // ?q=... prefills the input, so a conversion can be shared as a link.
  const shared = params.get("q");
  input.value = shared ? shared.slice(0, input.maxLength) : t.sample;
  try {
    const [map, variants, subs] = await Promise.all([
      fetchJson("data/seal-map.json") as Promise<SealMapData>,
      fetchOptional<SealExtraData>("data/seal-variants.json"),
      fetchOptional<unknown>("data/original-forms.json"),
    ]);
    index = createIndex(map, { variants });
    substitutions = parseSubstitutions(subs);
  } catch (err) {
    stats.textContent = t.loadError;
    console.error(err);
    return;
  }

  applyLocale(locale);
  void loadPreviewFont();
}

void init();
