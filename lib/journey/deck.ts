/**
 * Choosing what the reader meets next.
 *
 * Every function here takes its randomness as an argument — a plain sample, a
 * supplier, or a seed — so the two promises the journey makes can be checked
 * without a browser: the curated scene is never the one this session already
 * showed, and the corpus deck reaches all three and a half thousand 词 before
 * it repeats a single one.
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

/** mulberry32 — small, fast, and good enough to shuffle a book with. */
export function seededRandom(seed: number): () => number {
  let state = (Math.trunc(seed) || 1) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
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
 * A shuffled deck of corpus positions, and how far through it the reader is.
 *
 * The seed is kept so a reload can resume the same deck at the same place
 * rather than starting the book again from a fresh shuffle.
 */
export type Deck = {
  seed: number;
  total: number;
  order: number[];
  cursor: number;
};

export function makeDeck(total: number, seed: number): Deck {
  const size = Math.max(0, Math.trunc(total));
  const order = shuffle(
    Array.from({ length: size }, (_, i) => i),
    seededRandom(seed),
  );
  return { seed, total: size, order, cursor: 0 };
}

/** Rebuild a deck from its seed, then walk it forward to where it was. */
export function restoreDeck(total: number, seed: number, cursor: number): Deck {
  const deck = makeDeck(total, seed);
  const at = Number.isInteger(cursor) ? cursor : 0;
  return { ...deck, cursor: Math.min(Math.max(at, 0), deck.order.length) };
}

export type DeckDraw = { deck: Deck; index: number };

/** The card that would be dealt next, so its shard can be warmed early. */
export const peekDeck = (deck: Deck): number =>
  deck.cursor < deck.order.length ? (deck.order[deck.cursor] as number) : -1;

/**
 * The next poem, and the deck that remembers it was dealt.
 *
 * Reaching the end reshuffles under a fresh seed rather than looping the same
 * order, so a reader who gets all the way through the book does not then meet
 * it again in exactly the sequence they just read. `exclude` keeps the poem
 * already on the stage from being dealt to itself. The excluded position is
 * consumed rather than swapped: seed plus cursor can therefore reconstruct the
 * exact remaining order after a reload.
 */
export function drawFromDeck(deck: Deck, exclude: number | null, reshuffleSeed: number): DeckDraw {
  if (deck.order.length === 0) return { deck, index: -1 };
  if (deck.order.length === 1) {
    return { deck: { ...deck, cursor: 1 }, index: deck.order[0] as number };
  }

  let current = deck.cursor >= deck.order.length ? makeDeck(deck.total, reshuffleSeed) : deck;

  if (current.order[current.cursor] === exclude) {
    current = { ...current, cursor: current.cursor + 1 };
    if (current.cursor >= current.order.length) {
      current = makeDeck(current.total, reshuffleSeed);
      if (current.order[current.cursor] === exclude) {
        current = { ...current, cursor: current.cursor + 1 };
      }
    }
  }

  // With at least two cards, one exclusion can never consume a whole fresh
  // deck. Keep the fallback explicit so malformed restored state still fails
  // open to a valid card instead of returning undefined.
  if (current.cursor >= current.order.length) current = makeDeck(current.total, reshuffleSeed + 1);

  const index = current.order[current.cursor] as number;
  return { deck: { ...current, cursor: current.cursor + 1 }, index };
}

/** A seed for a session's deck, drawn from whatever randomness is on hand. */
export const seedFrom = (random: number): number =>
  (Math.abs(Math.trunc(random * 0xffff_ffff)) || 1) >>> 0;
