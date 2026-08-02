/**
 * Split a 片 printed as one continuous block into display lines.
 *
 * Most volumes set a whole 片 as a single paragraph; 李清照 and 李煜 preserve the
 * printed line breaks. Breaking the former after 。？！ gives every volume the
 * same reading rhythm without inventing breaks the source does not imply.
 *
 * Shared so the reading pages and the home stage break identically: the stage
 * reveals one display line at a time, and a line it reveals must be a line the
 * poem page also prints.
 */
export function displayLines(stanza: string[]): string[] {
  if (stanza.length > 1) return stanza;
  const line = stanza[0] ?? "";
  const parts = line.split(/(?<=[。？！])/).filter((s) => s.trim());
  return parts.length > 0 ? parts : [line];
}

/** Every display line of a poem, flattened, in reading order. */
export function displayLinesOf(stanzas: string[][]): string[] {
  return stanzas.flatMap(displayLines);
}
