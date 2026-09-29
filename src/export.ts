/** One character to draw: `seal` ones use the seal font, others a fallback serif. */
export interface Glyph {
  text: string;
  seal: boolean;
}

/** A glyph placed on the grid: `line` is the row (horizontal) or column (vertical). */
export interface Cell extends Glyph {
  line: number;
  pos: number;
}

export interface Layout {
  cells: Cell[];
  lines: number;
  /** The longest line, in characters. */
  length: number;
}

/** Punctuation that must not start a line; it stays with the character before it. */
const CLOSING = /^[，。、；：！？」』）〕】》〉…,.;:!?)\]]$/u;

/**
 * Break glyphs into lines of at most `perLine` characters, starting a new line
 * at each newline. Closing punctuation never starts a line: it is appended to
 * the previous one, even if that makes the line one character longer.
 */
export function layoutGlyphs(glyphs: readonly Glyph[], perLine: number): Layout {
  const cells: Cell[] = [];
  let line = 0;
  let pos = 0;
  let length = 0;
  for (const glyph of glyphs) {
    if (glyph.text === "\n") {
      line++;
      pos = 0;
      continue;
    }
    if (pos >= perLine && !CLOSING.test(glyph.text)) {
      line++;
      pos = 0;
    }
    cells.push({ ...glyph, line, pos });
    pos++;
    length = Math.max(length, pos);
  }
  return { cells, lines: cells.length ? line + 1 : 0, length };
}

export interface RenderOptions {
  vertical: boolean;
  /** CSS font family of the seal font. */
  sealFont: string;
  ink: string;
  /** Background colour, or null for a transparent background. */
  paper: string | null;
  fontSize?: number;
  perLine?: number;
}

/**
 * Draw the glyphs onto a canvas: rows top to bottom when horizontal, columns
 * right to left when vertical, as in a traditional book.
 */
export function renderCanvas(glyphs: readonly Glyph[], options: RenderOptions): HTMLCanvasElement {
  const size = options.fontSize ?? 96;
  const layout = layoutGlyphs(glyphs, options.perLine ?? 20);
  const advance = Math.round(size * 1.1);
  const leading = Math.round(size * 1.5);
  const pad = Math.round(size * 0.6);

  const across = Math.max(layout.lines, 1) * leading - (leading - advance);
  const along = Math.max(layout.length, 1) * advance;
  const canvas = document.createElement("canvas");
  canvas.width = (options.vertical ? across : along) + pad * 2;
  canvas.height = (options.vertical ? along : across) + pad * 2;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  if (options.paper) {
    ctx.fillStyle = options.paper;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.fillStyle = options.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const cell of layout.cells) {
    ctx.font = `${size}px ${cell.seal ? `${options.sealFont}, serif` : "serif"}`;
    const lineCenter = cell.line * leading + advance / 2;
    const posCenter = cell.pos * advance + advance / 2;
    const x = options.vertical ? canvas.width - pad - lineCenter : pad + posCenter;
    const y = options.vertical ? pad + posCenter : pad + lineCenter;
    ctx.fillText(cell.text, x, y);
  }
  return canvas;
}
