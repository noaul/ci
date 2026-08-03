import {
  CORPUS_BASE,
  type CorpusEntry,
  type CorpusManifest,
  manifestUrl,
  offsetOf,
  shardOf,
  shardUrl,
} from "@/lib/corpus/shards";

/**
 * Reading the corpus a shard at a time.
 *
 * The home route ships one curated 词 and nothing else; the book arrives only
 * once the reader has asked for it. Shards are cached for the session and
 * in-flight requests are shared, so a prefetch and the draw that follows it
 * cost one request between them. Failure is returned rather than swallowed:
 * the poem already on the stage has to stay readable.
 */
export type CorpusClient = {
  manifest(): Promise<CorpusManifest>;
  entry(position: number): Promise<CorpusEntry>;
  /** Warm a shard without waiting on it, and without reporting failure. */
  prefetch(position: number): void;
};

type Fetcher = (input: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export function createCorpusClient(
  options: { base?: string; fetch?: Fetcher } = {},
): CorpusClient {
  const base = options.base ?? CORPUS_BASE;
  const request: Fetcher =
    options.fetch ?? ((input) => fetch(input, { credentials: "same-origin" }));

  let manifestPromise: Promise<CorpusManifest> | null = null;
  const shards = new Map<number, Promise<CorpusEntry[]>>();

  async function load<T>(url: string): Promise<T> {
    const response = await request(url);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return (await response.json()) as T;
  }

  function manifest(): Promise<CorpusManifest> {
    // A failed manifest must not poison the client: clear it so a retry can
    // ask again rather than replaying the rejection forever.
    manifestPromise ??= load<CorpusManifest>(manifestUrl(base)).catch((error: unknown) => {
      manifestPromise = null;
      throw error;
    });
    return manifestPromise;
  }

  function shard(index: number, file: string): Promise<CorpusEntry[]> {
    let pending = shards.get(index);
    if (!pending) {
      pending = load<CorpusEntry[]>(shardUrl(file, base)).catch((error: unknown) => {
        shards.delete(index);
        throw error;
      });
      shards.set(index, pending);
    }
    return pending;
  }

  async function entry(position: number): Promise<CorpusEntry> {
    const loaded = await manifest();
    if (!Number.isInteger(position) || position < 0 || position >= loaded.total) {
      throw new Error(`corpus position ${position} is outside the book`);
    }
    const index = shardOf(position, loaded.shardSize);
    const ref = loaded.shards[index];
    if (!ref) throw new Error(`corpus shard ${index} is not in the manifest`);

    const poems = await shard(index, ref.file);
    const poem = poems[offsetOf(position, loaded.shardSize)];
    if (!poem) throw new Error(`corpus position ${position} is missing from ${ref.file}`);
    return poem;
  }

  return {
    manifest,
    entry,
    prefetch(position) {
      void entry(position).catch(() => {
        // A warm-up that fails is simply not warm; the real draw will report it.
      });
    },
  };
}
