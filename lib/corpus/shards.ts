/**
 * The corpus, cut into fetchable pieces.
 *
 * The reading journey can reach any of the three and a half thousand 词, and
 * none of them may be in the page's first payload: the home route ships the one
 * curated scene it opens on, then fetches a shard the moment the reader asks
 * for a second poem. Sixty-four poems is roughly thirty kilobytes of JSON. The
 * deck is globally shuffled, so the client warms the next shard while the
 * reader is still with the current poem instead of assuming adjacent draws.
 *
 * Everything here is pure and free of Node imports: the generator writes the
 * files, the browser reads them, and the tests check that the two agree.
 */

/** Poems per shard. */
export const SHARD_SIZE = 64;

/** Where the generated files are served from. */
export const CORPUS_BASE = "/corpus";

export const MANIFEST_FILE = "manifest.json";

/** One poem, compacted to what the stage actually prints. */
export type CorpusEntry = {
  /** Corpus id, `poetId/slug`; the detail route is `/poems/{id}/`. */
  id: string;
  tune: string;
  title: string | null;
  poet: string;
  poetId: string;
  dynasty: string;
  volume: string;
  volumeId: string;
  /** 词谱 route id, where the indexes carry one. */
  tuneId: string | null;
  /** Display lines, exactly as the reading pages break them. */
  lines: string[];
  /** Indices of the lines that open a 片. */
  opens: number[];
  /** ◎ 注释 waiting on the poem page. */
  notes: number;
  /** ◆ 历代辑评 waiting on the poem page. */
  commentary: number;
};

export type CorpusShardRef = {
  file: string;
  count: number;
};

export type CorpusManifest = {
  /** Poems in the corpus, and the length of the deck the journey shuffles. */
  total: number;
  shardSize: number;
  shards: CorpusShardRef[];
};

export const shardFileName = (shard: number): string =>
  `shard-${String(shard).padStart(3, "0")}.json`;

export const shardUrl = (file: string, base = CORPUS_BASE): string => `${base}/${file}`;

export const manifestUrl = (base = CORPUS_BASE): string => `${base}/${MANIFEST_FILE}`;

/** Which shard holds the poem at this position in the corpus. */
export const shardOf = (position: number, shardSize = SHARD_SIZE): number =>
  Math.floor(position / shardSize);

/** Where inside its shard that poem sits. */
export const offsetOf = (position: number, shardSize = SHARD_SIZE): number =>
  position % shardSize;

/** Cut the corpus into shards, in the order the deck indexes them. */
export function shardCorpus(
  entries: readonly CorpusEntry[],
  shardSize = SHARD_SIZE,
): CorpusEntry[][] {
  const shards: CorpusEntry[][] = [];
  for (let i = 0; i < entries.length; i += shardSize) {
    shards.push(entries.slice(i, i + shardSize));
  }
  return shards;
}

export function buildManifest(
  shards: readonly (readonly CorpusEntry[])[],
  shardSize = SHARD_SIZE,
): CorpusManifest {
  return {
    total: shards.reduce((n, shard) => n + shard.length, 0),
    shardSize,
    shards: shards.map((shard, i) => ({ file: shardFileName(i), count: shard.length })),
  };
}

/**
 * Whether a manifest actually accounts for every poem it claims.
 *
 * A shard that fell short would strand the tail of the deck on a 404, so the
 * arithmetic is checked at build time rather than discovered by a reader.
 */
export function manifestIsComplete(manifest: CorpusManifest): boolean {
  const counted = manifest.shards.reduce((n, shard) => n + shard.count, 0);
  if (counted !== manifest.total) return false;
  return manifest.shards.every((shard, i) => {
    const expected = Math.min(manifest.shardSize, manifest.total - i * manifest.shardSize);
    return shard.file === shardFileName(i) && shard.count === expected;
  });
}

/** The detail route for a corpus poem — the same href the indexes link to. */
export const entryHref = (entry: Pick<CorpusEntry, "id">): string => `/poems/${entry.id}/`;

export const poetHref = (entry: Pick<CorpusEntry, "poetId">): string =>
  `/poets/${entry.poetId}/`;

export const tuneHref = (entry: Pick<CorpusEntry, "tuneId">): string | null =>
  entry.tuneId ? `/tunes/${entry.tuneId}/` : null;

export const volumeHref = (entry: Pick<CorpusEntry, "volumeId">): string | null =>
  entry.volumeId ? `/volumes/${entry.volumeId}/` : null;
