import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getCorpusEntries } from "@/lib/corpus/entries";
import {
  MANIFEST_FILE,
  buildManifest,
  manifestIsComplete,
  shardCorpus,
  shardFileName,
} from "@/lib/corpus/shards";

/**
 * Write the fetchable corpus into `public/corpus/`.
 *
 * These files are derived from `content/` and are therefore not committed; the
 * build regenerates them, and `public/` copies them into the static export
 * untouched, so the journey can fetch `/corpus/shard-017.json` from any plain
 * file host.
 */
const OUT_DIR = resolve("public", "corpus");

const entries = getCorpusEntries();
const shards = shardCorpus(entries);
const manifest = buildManifest(shards);

if (!manifestIsComplete(manifest)) {
  console.error("Corpus manifest does not account for every poem.");
  process.exit(1);
}

// A stale shard left over from a smaller corpus would be reachable but wrong.
try {
  for (const file of readdirSync(OUT_DIR)) {
    if (file.endsWith(".json")) rmSync(join(OUT_DIR, file));
  }
} catch {
  // First run: nothing to clear.
}

mkdirSync(OUT_DIR, { recursive: true });
shards.forEach((shard, i) => {
  writeFileSync(join(OUT_DIR, shardFileName(i)), JSON.stringify(shard), "utf8");
});
writeFileSync(join(OUT_DIR, MANIFEST_FILE), JSON.stringify(manifest), "utf8");

console.log(
  `Corpus sharded: ${manifest.total} poems across ${manifest.shards.length} files of ${manifest.shardSize}.`,
);
