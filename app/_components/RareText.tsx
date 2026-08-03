import { glyphAvailable } from "@/lib/glyphs";
import { parseRare, stripRare } from "@/lib/rare";
import { RareParts } from "./RareParts";

/**
 * Render text that may contain rare-character image tokens.
 *
 * Around 90 characters fall outside the ebook's embedded font and are printed
 * as images. They are kept as {{IMG:file}} tokens through the pipeline and
 * rendered inline here at the surrounding text's size, so a line like
 * 宋傅[藻]《东坡纪年录》 reads correctly even before a Unicode mapping exists.
 */
export function RareText({ children }: { children: string }) {
  return <RareParts parts={parseRare(children, glyphAvailable)} />;
}

/** Plain-text fallback for titles and metadata, where an `<img>` cannot go. */
export const stripTokens = stripRare;
