import { getAllPoems, getPoet, getTuneByName, getVolume } from "@/lib/content";
import { glyphAvailable } from "@/lib/glyphs";
import { displayLines } from "@/lib/poem-lines";
import { markRare } from "@/lib/rare";
import type { CorpusEntry } from "./shards";

/**
 * Every poem, compacted for the journey and put in one canonical order.
 *
 * Sorted by id rather than by directory listing, so the shard a poem lands in
 * is a property of the corpus and not of the machine that ran the build.
 */
export function getCorpusEntries(): CorpusEntry[] {
  return getAllPoems()
    .map((poem): CorpusEntry => {
      const lines: string[] = [];
      const opens: number[] = [];

      poem.stanzas.forEach((stanza, s) => {
        displayLines(stanza).forEach((text, i) => {
          if (s > 0 && i === 0) opens.push(lines.length);
          lines.push(markRare(text, glyphAvailable));
        });
      });

      const volume = getVolume(poem.volumeId);
      const tune = getTuneByName(poem.tune);

      return {
        id: poem.id,
        tune: markRare(poem.tune, glyphAvailable),
        title: poem.title ? markRare(poem.title, glyphAvailable) : null,
        poet: poem.poet,
        poetId: poem.poetId,
        dynasty: getPoet(poem.poetId)?.dynasty ?? "",
        volume: volume?.title ?? poem.juan,
        volumeId: volume?.id ?? "",
        tuneId: tune?.id ?? null,
        lines,
        opens,
        notes: poem.notes.length,
        commentary: poem.commentary.length,
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
