import assert from "node:assert/strict";
import test from "node:test";
import { getCorpusEntries } from "@/lib/corpus/entries";
import {
  buildManifest,
  manifestIsComplete,
  offsetOf,
  shardCorpus,
  shardFileName,
  shardOf,
  type CorpusEntry,
} from "@/lib/corpus/shards";
import { createCorpusClient } from "@/lib/journey/corpus-client";

test("all 3508 poems form a complete, addressable 55-shard manifest", () => {
  const entries = getCorpusEntries();
  const shards = shardCorpus(entries);
  const manifest = buildManifest(shards);

  assert.equal(entries.length, 3508);
  assert.equal(shards.length, 55);
  assert.equal(manifest.total, entries.length);
  assert.equal(manifestIsComplete(manifest), true);
  assert.equal(manifest.shards.at(-1)?.file, shardFileName(54));

  for (const position of [0, 63, 64, 3507]) {
    assert.equal(shards[shardOf(position)]?.[offsetOf(position)]?.id, entries[position]?.id);
  }
});

test("the browser corpus client shares requests, retries failures, and rejects bad positions", async () => {
  const entries: CorpusEntry[] = [
    {
      id: "a/one",
      tune: "甲",
      title: null,
      poet: "甲",
      poetId: "a",
      dynasty: "宋",
      volume: "甲集",
      volumeId: "a",
      tuneId: null,
      lines: ["甲。"],
      opens: [],
      notes: 0,
      commentary: 0,
    },
    {
      id: "b/two",
      tune: "乙",
      title: null,
      poet: "乙",
      poetId: "b",
      dynasty: "宋",
      volume: "乙集",
      volumeId: "b",
      tuneId: null,
      lines: ["乙。"],
      opens: [],
      notes: 0,
      commentary: 0,
    },
  ];
  let manifestCalls = 0;
  let shardCalls = 0;
  let failManifest = true;
  const client = createCorpusClient({
    base: "/test-corpus",
    fetch: async (url) => {
      if (url.endsWith("manifest.json")) {
        manifestCalls += 1;
        if (failManifest) {
          failManifest = false;
          return { ok: false, status: 503, json: async () => ({}) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ total: 2, shardSize: 64, shards: [{ file: "shard-000.json", count: 2 }] }),
        };
      }
      shardCalls += 1;
      return { ok: true, status: 200, json: async () => entries };
    },
  });

  await assert.rejects(client.manifest());
  assert.equal((await client.manifest()).total, 2);
  const [first, second] = await Promise.all([client.entry(0), client.entry(1)]);
  assert.equal(first.id, "a/one");
  assert.equal(second.id, "b/two");
  assert.equal(manifestCalls, 2);
  assert.equal(shardCalls, 1);
  await assert.rejects(client.entry(2), /outside the book/);
});
