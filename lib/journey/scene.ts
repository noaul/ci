import {
  type CorpusEntry,
  entryHref,
  poetHref,
  tuneHref,
  volumeHref,
} from "@/lib/corpus/shards";
import type { CurrentWork } from "@/lib/library";
import { stripRare } from "@/lib/rare";
import type { SceneId, StageTheme } from "@/lib/stage/types";

/**
 * One poem, in the single shape the stage knows how to print.
 *
 * A curated scene carries its artwork, its motifs and its climax; a poem drawn
 * from the book carries none of those and is simply itself. Reducing both to
 * this keeps the rendering component free of "which kind is this" branches, and
 * keeps the drawer's 本阕 group reading from one place.
 */
export type SceneLine = { text: string; opens: boolean };

export type Scene = {
  /** Remount key — a new key replays the reveal for the incoming poem. */
  key: string;
  kind: "featured" | "corpus";
  /** Palette and climax id, for the four prepared scenes only. */
  sceneId: SceneId | null;
  /** Small marks above the title: 词境 and its motifs, or the 分册. */
  eyebrow: string[];
  title: string;
  href: string;
  dynasty: string;
  poet: string;
  poetHref: string;
  lines: SceneLine[];
  /** Where the opening movement closes; the preview stops here. */
  pauseIndex: number;
  /** The 转, which the prepared scenes colour once the poem stands whole. */
  turnIndex: number | null;
  aftertaste: string | null;
  work: CurrentWork;
};

export function sceneFromTheme(theme: StageTheme): Scene {
  return {
    key: `featured:${theme.id}`,
    kind: "featured",
    sceneId: theme.id,
    eyebrow: [theme.scene, ...theme.motifs],
    title: theme.heading,
    href: theme.href,
    dynasty: theme.dynasty,
    poet: theme.poet,
    poetHref: theme.poetHref,
    lines: theme.lines.map((line) => ({ text: line.text, opens: line.opensStanza })),
    pauseIndex: theme.pauseIndex,
    turnIndex: theme.turnIndex,
    aftertaste: theme.aftertaste,
    work: {
      title: theme.heading,
      href: theme.href,
      poet: theme.poet,
      poetHref: theme.poetHref,
      dynasty: theme.dynasty,
      tune: theme.tune,
      tuneHref: theme.tuneHref,
      volume: theme.volumeTitle,
      volumeHref: theme.volumeHref,
      notes: theme.noteCount,
      commentary: theme.commentaryCount,
    },
  };
}

/** 词牌·词题, preserving image-backed rare glyphs for the visible heading. */
export const entryTitle = (entry: CorpusEntry): string =>
  entry.title ? `${entry.tune}·${entry.title}` : entry.tune;

/** Everything of a poem a motif can be read out of. */
export const entryText = (entry: CorpusEntry): string =>
  `${entry.tune}${entry.title ?? ""}${entry.lines.join("")}`;

export function sceneFromEntry(entry: CorpusEntry): Scene {
  const opens = new Set(entry.opens);
  const title = entryTitle(entry);
  const plainTitle = stripRare(title);
  return {
    key: `corpus:${entry.id}`,
    kind: "corpus",
    sceneId: null,
    eyebrow: entry.volume ? [entry.volume] : [],
    title,
    href: entryHref(entry),
    dynasty: entry.dynasty,
    poet: entry.poet,
    poetHref: poetHref(entry),
    lines: entry.lines.map((text, i) => ({ text, opens: opens.has(i) })),
    pauseIndex: entry.lines.length - 1,
    turnIndex: null,
    aftertaste: null,
    work: {
      title: plainTitle,
      href: entryHref(entry),
      poet: entry.poet,
      poetHref: poetHref(entry),
      dynasty: entry.dynasty,
      tune: stripRare(entry.tune),
      tuneHref: tuneHref(entry),
      volume: entry.volume || null,
      volumeHref: volumeHref(entry),
      notes: entry.notes,
      commentary: entry.commentary,
    },
  };
}

/** What a screen reader is told when a poem takes the stage. */
export const sceneAnnouncement = (scene: Scene): string =>
  `${scene.poet}《${stripRare(scene.title)}》`;
