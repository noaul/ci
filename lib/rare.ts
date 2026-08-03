/**
 * Rare-character tokens, split from the text that carries them.
 *
 * Around ninety characters fall outside the ebook's embedded font and are
 * printed as images; the pipeline keeps them as `{{IMG:file}}` tokens. Whether
 * the asset is actually on disk is a server question, so a token bound for the
 * client is re-marked `{{NOIMG:file}}` at build time — the browser then knows
 * which glyphs it may request without being handed a directory listing.
 */

const TOKEN = /\{\{(IMG|NOIMG):([^}]*)\}\}/g;

/** Filenames the site is willing to request. Anything else is a missing glyph. */
export const SAFE_GLYPH_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export type RarePart =
  | { kind: "text"; text: string }
  | { kind: "glyph"; file: string; available: boolean };

/**
 * Split text into runs and glyphs.
 *
 * The token itself says whether the asset exists; `available` overrides it,
 * which is what the server rendering uses to consult the real directory.
 */
export function parseRare(text: string, available?: (file: string) => boolean): RarePart[] {
  const parts: RarePart[] = [];
  let last = 0;

  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    const file = match[2] ?? "";
    if (index > last) parts.push({ kind: "text", text: text.slice(last, index) });
    parts.push({
      kind: "glyph",
      file,
      available: SAFE_GLYPH_FILE.test(file) && (available ? available(file) : match[1] === "IMG"),
    });
    last = index + match[0].length;
  }

  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

/** Re-mark tokens for a client that cannot see the filesystem. */
export function markRare(text: string, available: (file: string) => boolean): string {
  return text.replace(TOKEN, (_whole, _kind: string, file: string) =>
    SAFE_GLYPH_FILE.test(file) && available(file) ? `{{IMG:${file}}}` : `{{NOIMG:${file}}}`,
  );
}

/** Plain-text fallback for titles and metadata, where an `<img>` cannot go. */
export function stripRare(text: string): string {
  return text.replace(TOKEN, "□");
}

/** True when the text carries any rare-character token. */
export function hasRare(text: string): boolean {
  return /\{\{(?:IMG|NOIMG):/.test(text);
}
