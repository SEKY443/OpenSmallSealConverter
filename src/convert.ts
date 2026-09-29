/** Shape of public/data/seal-map.json, produced by scripts/build_data.py. */
export interface SealMapData {
  unicode: string;
  /** First code point of the Small Seal block. */
  first: number;
  /** mcjk[i] is the modern CJK equivalent of seal code point first + i (0 = none). */
  mcjk: number[];
}

/**
 * Extra modern characters (keys) mapped to seal code points, for characters
 * that kSEAL_MCJK only lists under a transcribed form (e.g. 之 -> U+3E195).
 * Shape of public/data/seal-variants.json (scripts/build_variants.py).
 */
export interface SealExtraData {
  map: Record<string, number[]>;
}

export interface IndexExtras {
  /** Same-character mappings: OpenCC, Shuowen alignment, inherited forms, manual review. */
  variants?: SealExtraData;
}

/**
 * Shape of public/data/original-forms.json (scripts/build_original_forms.py):
 * characters without a seal form mapped to Shuowen headwords, best first.
 */
export interface SubstitutionData {
  source?: string;
  /** Later characters or variant spellings -> Shuowen headword (e.g. 洲 -> 州). */
  original?: Record<string, string[]>;
  /** Simplified characters -> Shuowen headword (e.g. 诛 -> 誅). */
  simplified?: Record<string, string[]>;
  /** Citation for each entry, e.g. 洲: 「徐鉉（「州」字下）：今別作洲，非是。」 */
  notes?: Record<string, string>;
}

export type SubstitutionKind = "original" | "simplified";

export interface Substitution {
  kind: SubstitutionKind;
  candidates: readonly number[];
  /** Source citation, shown to the user. */
  note?: string;
}

const MAX_NOTE_LENGTH = 300;

export type Substitutions = ReadonlyMap<number, Substitution>;

export interface SealIndex {
  readonly unicode: string;
  isSeal(cp: number): boolean;
  /** Modern CJK equivalent (kSEAL_MCJK) of a seal code point. */
  modernOf(seal: number): number | undefined;
  /** Seal code points for the character `modern`, in code point order. */
  sealsOf(modern: number): readonly number[];
  /** Characters whose glyph in a seal-style font may depict `seal`, best first. */
  previewCandidates(seal: number): readonly number[];
}

export type Token =
  | {
      kind: "seal";
      /** The input character this token came from. */
      text: string;
      /** Candidate seal code points; more than one means the user may pick a variant. */
      options: readonly number[];
      /** The selected seal code point (one of `options`). */
      seal: number;
      /** The character looked up (normalized input or its substitute), used to render the preview. */
      modern: number;
      /** Set when the input had no seal form and a Shuowen headword was used instead. */
      substitute?: { char: number; kind: SubstitutionKind; note?: string };
    }
  | {
      kind: "plain";
      text: string;
      /** True for Han characters that have no Small Seal equivalent. */
      unmatchedHan: boolean;
    };

const HAN = /^\p{Script=Han}$/u;

function singleCodePoint(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const chars = Array.from(value);
  return chars.length === 1 ? chars[0].codePointAt(0) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createIndex(data: SealMapData, extras: IndexExtras = {}): SealIndex {
  if (!Number.isInteger(data.first) || !Array.isArray(data.mcjk)) {
    throw new Error("Invalid seal map data");
  }
  const { first, mcjk } = data;
  const last = first + mcjk.length - 1;
  const reverse = new Map<number, number[]>();
  mcjk.forEach((modern, i) => {
    if (!modern) return;
    const seals = reverse.get(modern);
    if (seals) seals.push(first + i);
    else reverse.set(modern, [first + i]);
  });

  /** Seal -> extra characters that also denote it, for preview fallbacks. */
  const extraChars = new Map<number, number[]>();

  const extra = extras.variants;
  if (extra && isRecord(extra.map)) {
    for (const [char, seals] of Object.entries(extra.map)) {
      const cp = singleCodePoint(char);
      if (cp === undefined || !Array.isArray(seals)) continue;
      const valid = seals.filter((s) => Number.isInteger(s) && s >= first && s <= last && mcjk[s - first]);
      if (valid.length === 0) continue;
      // kSEAL_MCJK stays authoritative when it already covers the character.
      if (!reverse.has(cp)) reverse.set(cp, valid);
      for (const seal of valid) {
        const list = extraChars.get(seal);
        if (!list) extraChars.set(seal, [cp]);
        else if (!list.includes(cp)) list.push(cp);
      }
    }
  }

  return {
    unicode: data.unicode,
    isSeal: (cp) => cp >= first && cp <= last,
    modernOf: (seal) => (seal >= first && seal <= last ? mcjk[seal - first] || undefined : undefined),
    sealsOf: (modern) => reverse.get(modern) ?? [],
    previewCandidates: (seal) => {
      const modern = seal >= first && seal <= last ? mcjk[seal - first] : 0;
      return [...(modern ? [modern] : []), ...(extraChars.get(seal) ?? [])];
    },
  };
}

/** Shape of public/data/s2t.json (scripts/build_s2t.py), from OpenCC. */
export interface S2TData {
  /** Default traditional form of each simplified character. */
  chars: Record<string, string>;
  /** OpenCC's phrase table (皇后 -> 皇后, 头发 -> 頭髮, 以后 -> 以後). */
  phrases: Record<string, string>;
  /** Characters that only occur in simplified text. */
  simplifiedOnly: string;
}

export interface S2TResult {
  /** The traditional character at each input position. */
  chars: string[];
  /** The phrase (simplified) that decided each position, if any. */
  phrases: (string | undefined)[];
}

export interface S2T {
  /**
   * True when the text looks simplified: at least SIMPLIFIED_RATIO of its Han
   * characters are used only in simplified Chinese (们, 这, 说). Characters that
   * also have a seal form of their own (于, 无, 黄) are excluded from that set when
   * the data is built, so classical or new-form (新字形) text is not caught.
   */
  isSimplified(text: string): boolean;
  /** Convert character by character, preferring the longest matching phrase. */
  convert(chars: readonly string[]): S2TResult;
}

/** Share of simplified-only characters from which a text is treated as simplified. */
const SIMPLIFIED_RATIO = 0.1;

export function createS2T(data: S2TData): S2T {
  const chars = new Map<string, string>();
  const phrases = new Map<string, string>();
  let longest = 1;
  if (isRecord(data?.chars)) {
    for (const [from, to] of Object.entries(data.chars)) {
      if (singleCodePoint(from) !== undefined && singleCodePoint(to) !== undefined) chars.set(from, to);
    }
  }
  if (isRecord(data?.phrases)) {
    for (const [from, to] of Object.entries(data.phrases)) {
      const length = Array.from(from).length;
      // Output characters are aligned with input characters, so lengths must match.
      if (typeof to !== "string" || length < 2 || Array.from(to).length !== length) continue;
      phrases.set(from, to);
      longest = Math.max(longest, length);
    }
  }
  const simplifiedOnly = new Set(typeof data?.simplifiedOnly === "string" ? Array.from(data.simplifiedOnly) : []);

  return {
    isSimplified: (text) => {
      const han = Array.from(text).filter((c) => HAN.test(c));
      const count = han.filter((c) => simplifiedOnly.has(c)).length;
      return count > 0 && count / han.length >= SIMPLIFIED_RATIO;
    },
    convert: (input) => {
      const out: string[] = [];
      const used: (string | undefined)[] = [];
      let i = 0;
      while (i < input.length) {
        let matched = false;
        for (let len = Math.min(longest, input.length - i); len >= 2; len--) {
          const key = input.slice(i, i + len).join("");
          const value = phrases.get(key);
          if (value === undefined) continue;
          out.push(...Array.from(value));
          for (let k = 0; k < len; k++) used.push(key);
          i += len;
          matched = true;
          break;
        }
        if (!matched) {
          out.push(chars.get(input[i]) ?? input[i]);
          used.push(undefined);
          i++;
        }
      }
      return { chars: out, phrases: used };
    },
  };
}

/** Validate substitution data, dropping malformed entries. */
export function parseSubstitutions(data: unknown): Map<number, Substitution> {
  const result = new Map<number, Substitution>();
  if (!isRecord(data)) return result;
  const notes = isRecord(data.notes) ? data.notes : {};
  for (const kind of ["original", "simplified"] as const) {
    const map = data[kind];
    if (!isRecord(map)) continue;
    for (const [from, to] of Object.entries(map)) {
      const cp = singleCodePoint(from);
      if (cp === undefined || !Array.isArray(to) || result.has(cp)) continue;
      const candidates = to.map(singleCodePoint).filter((c): c is number => c !== undefined && c !== cp);
      if (candidates.length === 0) continue;
      const note = notes[from];
      const sub: Substitution = { kind, candidates };
      if (typeof note === "string" && note.trim()) sub.note = note.trim().slice(0, MAX_NOTE_LENGTH);
      result.set(cp, sub);
    }
  }
  return result;
}

/**
 * Split `input` into tokens, mapping every character that has a Small Seal
 * equivalent. `preferences` maps a looked-up code point to the seal variant the
 * user picked for it; otherwise the first variant is used. A character with no
 * seal form of its own falls back to the first of its `substitutions` (a
 * Shuowen headword) that has one; characters with a seal are never replaced.
 */
export function tokenize(
  input: string,
  index: SealIndex,
  preferences: ReadonlyMap<number, number> = new Map(),
  substitutions: Substitutions = new Map(),
  s2t?: S2T,
): Token[] {
  const tokens: Token[] = [];
  // Array.from iterates by code point, so astral characters stay intact.
  const chars = Array.from(input);
  // Simplified input is first converted phrase by phrase, so that characters
  // merged by simplification resolve by context (以后 -> 以後, 皇后 stays 皇后).
  // The caller decides whether the input is simplified (see S2T.isSimplified).
  const converted = s2t?.convert(chars);

  for (const [i, text] of chars.entries()) {
    const cp = text.codePointAt(0)!;

    const traditional = converted?.chars[i];
    if (traditional !== undefined && traditional !== text) {
      // Simplification often reused an unrelated ancient character (厂 for 廠,
      // 蜡 for 蠟), so when the traditional form has no seal, the simplified
      // character's own seal would be a different word: leave it unconverted.
      tokens.push(
        simplifiedToken(text, traditional, converted!.phrases[i], index, preferences, substitutions) ??
          { kind: "plain", text, unmatchedHan: true },
      );
      continue;
    }

    if (index.isSeal(cp)) {
      const modern = index.modernOf(cp);
      if (modern !== undefined) {
        tokens.push({ kind: "seal", text, options: [cp], seal: cp, modern });
        continue;
      }
    }

    let modern = cp;
    let options = index.sealsOf(modern);
    if (options.length === 0) {
      // CJK compatibility ideographs normalize to their unified counterparts.
      const normalized = text.normalize("NFC").codePointAt(0)!;
      if (normalized !== cp) {
        modern = normalized;
        options = index.sealsOf(modern);
      }
    }

    let substitute: { char: number; kind: SubstitutionKind; note?: string } | undefined;
    if (options.length === 0) {
      const sub = substitutions.get(modern);
      for (const candidate of sub?.candidates ?? []) {
        const seals = index.sealsOf(candidate);
        if (seals.length > 0) {
          substitute = { char: candidate, kind: sub!.kind };
          if (sub!.note) substitute.note = sub!.note;
          modern = candidate;
          options = seals;
          break;
        }
      }
    }

    if (options.length > 0) {
      const preferred = preferences.get(modern);
      const seal = preferred !== undefined && options.includes(preferred) ? preferred : options[0];
      const token: Token = { kind: "seal", text, options, seal, modern };
      if (substitute) token.substitute = substitute;
      tokens.push(token);
    } else {
      tokens.push({ kind: "plain", text, unmatchedHan: HAN.test(text) });
    }
  }
  return tokens;
}

/** A token for a simplified character whose traditional form was decided by s2t. */
function simplifiedToken(
  text: string,
  traditional: string,
  phrase: string | undefined,
  index: SealIndex,
  preferences: ReadonlyMap<number, number>,
  substitutions: Substitutions,
): Token | undefined {
  let modern = traditional.codePointAt(0)!;
  let options = index.sealsOf(modern);
  let kind: SubstitutionKind = "simplified";
  let note = phrase ? `簡轉繁：「${phrase}」→ 依詞組取「${traditional}」（OpenCC）` : `簡轉繁：「${text}」→「${traditional}」（OpenCC）`;
  if (options.length === 0) {
    // The traditional form may itself need a Shuowen headword (e.g. 这 -> 這 -> ...).
    const sub = substitutions.get(modern);
    const candidate = sub?.candidates.find((c) => index.sealsOf(c).length > 0);
    if (!sub || candidate === undefined) return undefined;
    modern = candidate;
    options = index.sealsOf(candidate);
    if (sub.kind === "original") kind = "original";
    if (sub.note) note += `；${sub.note}`;
  }
  const preferred = preferences.get(modern);
  const seal = preferred !== undefined && options.includes(preferred) ? preferred : options[0];
  return { kind: "seal", text, options, seal, modern, substitute: { char: modern, kind, note } };
}

/** The converted text: seal code points, with everything else unchanged. */
export function toSealText(tokens: readonly Token[]): string {
  return tokens.map((t) => (t.kind === "seal" ? String.fromCodePoint(t.seal) : t.text)).join("");
}

export function formatCodePoint(cp: number): string {
  return "U+" + cp.toString(16).toUpperCase().padStart(4, "0");
}

/** Link to the zi.tools page of a character (route /zi/:zi). */
export function ziToolsUrl(char: string): string {
  return "https://zi.tools/zi/" + encodeURIComponent(char);
}
