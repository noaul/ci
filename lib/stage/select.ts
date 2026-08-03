import type { StageMetrics, StageTheme } from "./types";

/**
 * Pure choice helpers for the stage.
 *
 * They take randomness as a plain number (or a supplier) rather than calling
 * `Math.random` themselves, so the behaviour that matters — a fresh scene on
 * every entry, and never the same scene twice in a row — is testable without a
 * browser and without stubbing globals.
 */

/** Map a `[0, 1)` sample onto `0…count-1`, tolerating 1 and out-of-range input. */
export function scaleIndex(count: number, random: number): number {
  if (count <= 1) return 0;
  const sample = Number.isFinite(random) ? Math.min(Math.max(random, 0), 0.999_999_999) : 0;
  return Math.floor(sample * count);
}

/** The scene a fresh page entry opens on. */
export function pickInitialIndex(count: number, random: number): number {
  return scaleIndex(count, random);
}

/** A fresh entry avoids the scene most recently seen in this browser session. */
export function pickEntryIndex(
  count: number,
  previous: number | null | undefined,
  random: number,
): number {
  return typeof previous === "number" && Number.isInteger(previous)
    ? pickNextIndex(count, previous, random)
    : pickInitialIndex(count, random);
}

/**
 * The scene a switch moves to. Offsetting by at least one guarantees the stage
 * never repeats what the reader is already looking at, which a plain re-roll
 * would do a quarter of the time.
 */
export function pickNextIndex(count: number, current: number, random: number): number {
  if (count <= 1) return 0;
  const from = Number.isInteger(current) && current >= 0 && current < count ? current : 0;
  return (from + 1 + scaleIndex(count - 1, random)) % count;
}

/** Fisher–Yates, with the randomness supplied. */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = scaleIndex(i + 1, random());
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * Candidate decoys, nearest in length to the answer first.
 *
 * A seven-character 小令 line among three long 慢词 lines gives itself away on
 * shape alone; matching the measure first keeps the choice about the poem.
 * Ties keep corpus order, so the result is deterministic.
 */
export function nearestByLength(answer: string, pool: readonly string[], limit: number): string[] {
  return [...new Set(pool)]
    .filter((line) => line !== answer)
    .map((line, order) => ({ line, order, gap: Math.abs(line.length - answer.length) }))
    .sort((a, b) => a.gap - b.gap || a.order - b.order)
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.line);
}

/**
 * The 接下一句 line-up: the poem's own next line, set among lines from the
 * other scenes. Decoys are real 词 from the same four works, so a wrong pick
 * still puts a good line in front of the reader.
 */
export function buildContinuationChoices(
  answer: string,
  pool: readonly string[],
  size: number,
  random: () => number,
): string[] {
  const decoys = [...new Set(pool)].filter((line) => line !== answer);
  const wanted = Math.max(1, Math.min(size, decoys.length + 1));
  const picked: string[] = [];

  while (picked.length < wanted - 1 && decoys.length > 0) {
    picked.push(decoys.splice(scaleIndex(decoys.length, random()), 1)[0] as string);
  }
  return shuffle([answer, ...picked], random);
}

/** Where the reading stands against the 转, and nothing else. */
export type StageEvent = "reading" | "turn" | "turned";

/**
 * The 转 marker.
 *
 * Derived only from the reveal against the 转 — never from whether the poem is
 * finished. 辛弃疾's 元夕 and 李清照's 如梦令 both *end* on their 转, so folding
 * completion into this would mean their climax never happened at all: supplying
 * the last line would jump the stage straight to its closing state.
 */
export function stageEvent(revealCount: number, turnIndex: number): StageEvent {
  if (revealCount > turnIndex) return "turned";
  if (revealCount === turnIndex) return "turn";
  return "reading";
}

/** The tallest frame any of the themes needs, so the stage can reserve it once. */
export function stageMetrics(themes: readonly StageTheme[]): StageMetrics {
  return {
    rows: themes.reduce((n, t) => Math.max(n, t.lines.length), 1),
    stanzaBreaks: themes.reduce(
      (n, t) => Math.max(n, t.lines.filter((line, i) => i > 0 && line.opensStanza).length),
      0,
    ),
  };
}
