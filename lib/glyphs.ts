import { readdirSync } from "node:fs";
import { join } from "node:path";
import { SAFE_GLYPH_FILE } from "./rare";

/**
 * Which rare-character assets the repository actually carries.
 *
 * The corpus references more glyphs than are committed; the site prints a 「□」
 * with an explanation for the rest rather than issuing a request it knows will
 * fail. Read once, at module load, on the server only.
 */
const availableGlyphs = (() => {
  try {
    return new Set(
      readdirSync(join(process.cwd(), "public", "glyphs"), { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name),
    );
  } catch {
    return new Set<string>();
  }
})();

export const glyphAvailable = (file: string): boolean =>
  SAFE_GLYPH_FILE.test(file) && availableGlyphs.has(file);
