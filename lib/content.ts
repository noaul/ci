import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { CihuaEntry } from "@/pipeline/src/profiles/cihua";
import type { Poem, Poet, ProseDoc, Volume } from "@/pipeline/src/types";
import type { Tune } from "@/pipeline/src/tunes";

export type { Poem, Poet, ProseDoc, Volume, Tune, CihuaEntry };

const CONTENT = join(process.cwd(), "content");

function read<T>(...segments: string[]): T {
  return JSON.parse(readFileSync(join(CONTENT, ...segments), "utf8")) as T;
}

function readDir<T>(dir: string): T[] {
  const path = join(CONTENT, dir);
  return readdirSync(path)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => JSON.parse(readFileSync(join(path, f), "utf8")) as T[]);
}

/**
 * The whole corpus, loaded once per build. Everything downstream is derived
 * from these arrays, so pages stay plain synchronous reads.
 */
const corpus = (() => {
  const volumes = read<Volume[]>("volumes.json").sort((a, b) => a.order - b.order);
  const poets = read<Poet[]>("poets.json");
  const poems = readDir<Poem>("poems");
  const prose = readDir<ProseDoc>("prose");
  const tunes = read<Tune[]>("tunes.json");

  const poemById = new Map(poems.map((p) => [p.id, p]));
  const poemsByPoet = new Map<string, Poem[]>();
  for (const p of poems) {
    let list = poemsByPoet.get(p.poetId);
    if (!list) poemsByPoet.set(p.poetId, (list = []));
    list.push(p);
  }
  for (const list of poemsByPoet.values()) list.sort((a, b) => a.order - b.order);

  return {
    volumes,
    poets: poets.filter((p) => p.poemCount > 0),
    poems,
    prose,
    tunes,
    poemById,
    poemsByPoet,
    poetById: new Map(poets.map((p) => [p.id, p])),
    volumeById: new Map(volumes.map((v) => [v.id, v])),
    tuneById: new Map(tunes.map((t) => [t.id, t])),
    tuneByName: new Map(tunes.map((t) => [t.name, t])),
  };
})();

/** 词话 entries, keyed by volume id. */
const cihua = (() => {
  const dir = join(CONTENT, "cihua");
  const byVolume = new Map<string, CihuaEntry[]>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    byVolume.set(file.replace(/\.json$/, ""), JSON.parse(readFileSync(join(dir, file), "utf8")));
  }
  return byVolume;
})();

/** Section names of a 词话 volume, in printed order. */
export function getCihuaSections(volumeId: string): string[] {
  return [...new Set((cihua.get(volumeId) ?? []).map((e) => e.section))];
}

export const getCihuaEntries = (volumeId: string): CihuaEntry[] => cihua.get(volumeId) ?? [];

export const getCihuaEntriesBySection = (volumeId: string, section: string): CihuaEntry[] =>
  (cihua.get(volumeId) ?? []).filter((e) => e.section === section);

/** Volumes that hold 词话/词论 prose rather than poems. */
export const getBookVolumes = (): Volume[] =>
  corpus.volumes.filter((v) => cihua.has(v.id));

/** Stable, URL-safe id for a section within its volume. */
export const sectionSlug = (volumeId: string, section: string): string =>
  String(getCihuaSections(volumeId).indexOf(section) + 1);

export type FirstLineEntry = {
  id: string;
  line: string;
  tune: string;
  poet: string;
  /** Pinyin initial A–Z, or "#". */
  initial: string;
};

const firstLines = read<FirstLineEntry[]>("first-lines.json");

export const getFirstLines = (): FirstLineEntry[] => firstLines;

/** Pinyin initials present in the corpus, in order. */
export const getFirstLineInitials = (): string[] =>
  [...new Set(firstLines.map((e) => e.initial))].sort((a, b) =>
    a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b),
  );

export const getFirstLinesByInitial = (initial: string): FirstLineEntry[] =>
  firstLines.filter((e) => e.initial === initial);

export const getVolumes = (): Volume[] => corpus.volumes;
export const getPoets = (): Poet[] => corpus.poets;
export const getAllPoems = (): Poem[] => corpus.poems;
export const getTunes = (): Tune[] => corpus.tunes;

export const getPoet = (id: string): Poet | undefined => corpus.poetById.get(id);
export const getVolume = (id: string): Volume | undefined => corpus.volumeById.get(id);
export const getTune = (id: string): Tune | undefined => corpus.tuneById.get(id);
export const getTuneByName = (name: string): Tune | undefined => corpus.tuneByName.get(name);
export const getPoemsByPoet = (poetId: string): Poem[] => corpus.poemsByPoet.get(poetId) ?? [];
export const getPoem = (poetId: string, slug: string): Poem | undefined =>
  corpus.poemById.get(`${poetId}/${slug}`);
export const getPoemById = (id: string): Poem | undefined => corpus.poemById.get(id);

export const getProseForVolume = (volumeId: string): ProseDoc[] =>
  corpus.prose.filter((d) => d.volumeId === volumeId);
export const getProseForPoet = (poetId: string): ProseDoc[] =>
  corpus.prose.filter((d) => d.poetId === poetId);

/** Neighbouring poems within the same 卷, for prev/next navigation. */
export function getNeighbours(poem: Poem): { prev: Poem | null; next: Poem | null } {
  const siblings = getPoemsByPoet(poem.poetId);
  const i = siblings.findIndex((p) => p.id === poem.id);
  return {
    prev: i > 0 ? (siblings[i - 1] ?? null) : null,
    next: i >= 0 && i < siblings.length - 1 ? (siblings[i + 1] ?? null) : null,
  };
}

/** URL for a poem, derived from its id (`poetId/slug`). */
export function poemHref(poem: Poem): string {
  return `/poems/${poem.id}/`;
}

/** First line, used for indexes and disambiguating same-tune poems. */
export function firstLine(poem: Poem): string {
  return poem.stanzas[0]?.[0] ?? "";
}

/** Han-character count of the poem body. */
export function charCount(poem: Poem): number {
  return poem.stanzas
    .flat()
    .join("")
    .replace(/[^一-鿿]/g, "").length;
}
