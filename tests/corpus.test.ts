import assert from "node:assert/strict";
import test from "node:test";
import {
  getAllPoems,
  getBookVolumes,
  getCihuaEntries,
  getFirstLines,
  getPoemsByPoet,
  getPoets,
  getTunes,
  getVolumes,
} from "@/lib/content";

test("corpus identifiers and aggregate counts remain internally consistent", () => {
  const poems = getAllPoems();
  const poets = getPoets();
  const volumes = getVolumes();

  assert.equal(poems.length, 3508);
  assert.equal(new Set(poems.map((poem) => poem.id)).size, poems.length);
  assert.equal(new Set(poets.map((poet) => poet.id)).size, poets.length);
  assert.equal(new Set(volumes.map((volume) => volume.id)).size, volumes.length);

  for (const poet of poets) {
    assert.equal(getPoemsByPoet(poet.id).length, poet.poemCount, poet.id);
  }
  for (const volume of volumes) {
    assert.equal(
      poems.filter((poem) => poem.volumeId === volume.id).length,
      volume.poemCount,
      volume.id,
    );
  }
});

test("tune, first-line, and critical-work references resolve to corpus poems", () => {
  const poems = getAllPoems();
  const poemIds = new Set(poems.map((poem) => poem.id));
  const tunes = getTunes();
  const tuneIds = new Set(tunes.map((tune) => tune.id));
  const firstLines = getFirstLines();

  assert.equal(tuneIds.size, tunes.length);
  assert.equal(firstLines.length, poems.length);
  assert.deepEqual(new Set(firstLines.map((entry) => entry.id)), poemIds);

  for (const tune of tunes) {
    assert.equal(tune.poemIds.length, tune.poemCount, tune.id);
    assert.equal(tune.poemIds.every((id) => poemIds.has(id)), true, tune.id);
    if (tune.relatedTune) assert.equal(tuneIds.has(tune.relatedTune.id), true, tune.id);
  }

  const entries = getBookVolumes().flatMap((volume) => getCihuaEntries(volume.id));
  assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
  for (const entry of entries) {
    for (const quote of entry.quotes) {
      if (quote.poemId) assert.equal(poemIds.has(quote.poemId), true, entry.id);
    }
  }
});

test("annotation headwords remain prefixes of the stored annotation text", () => {
  for (const poem of getAllPoems()) {
    for (const annotation of [...poem.notes, ...poem.commentary]) {
      if (annotation.headword) {
        assert.equal(annotation.text.startsWith(annotation.headword), true, poem.id);
      }
    }
  }
});
