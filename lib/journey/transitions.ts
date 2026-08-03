/**
 * How one 词 gives way to the next.
 *
 * Eight families, each a thing the poems themselves keep doing: ink spreading,
 * a scroll drawn sideways, a page turned, mist clearing, water ringing out,
 * rain washing down, wind sweeping across, a lantern going out. The poem about
 * to arrive chooses its own entrance where its words say what it should be, and
 * falls back to a hash of its id where they do not — so the same poem always
 * arrives the same way, and the reader is never shown one family twice running.
 */

export const TRANSITION_FAMILIES = [
  "ink",
  "scroll",
  "page",
  "mist",
  "ripple",
  "rain",
  "wind",
  "lantern",
] as const;

export type TransitionFamily = (typeof TRANSITION_FAMILIES)[number];

/** Bounds the cover is held inside, so a turn never becomes a wait. */
export const TRANSITION_MIN_MS = 480;
export const TRANSITION_MAX_MS = 680;

/** How many recent families the bag remembers. */
export const TRANSITION_HISTORY = 6;

/** Where in the cover the incoming poem takes the stage. */
export const TRANSITION_SWAP_AT = 0.46;

/**
 * Words that call a family. All are drawn from the vocabulary the corpus
 * actually uses, and each family is claimed by several so a poem rarely has to
 * fall through to its hash.
 */
const MOTIFS: Record<TransitionFamily, readonly string[]> = {
  ink: ["墨", "笔", "书", "题", "字", "诗", "笺", "砚", "画"],
  scroll: ["江", "河", "川", "千里", "万里", "天涯", "长亭", "关山", "平野", "野"],
  page: ["梦", "忆", "记", "旧", "昔", "年年", "当时", "前事", "少年"],
  mist: ["烟", "雾", "云", "霭", "暮", "蔼", "苍茫", "迷"],
  ripple: ["水", "波", "舟", "湖", "溪", "池", "塘", "浪", "萍", "渡"],
  rain: ["雨", "泪", "湿", "露", "潇潇", "滴", "霖"],
  wind: ["风", "絮", "柳", "吹", "叶", "落花", "杨花", "飘"],
  lantern: ["灯", "火", "月", "星", "烛", "影", "明", "照"],
};

/** FNV-1a over UTF-16 code units — stable across runs and platforms. */
export function hashString(text: string): number {
  let hash = 0x811c_9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x0100_0193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * The families a poem's own words ask for, strongest first.
 *
 * Ties keep the declared family order, so the ranking is a property of the poem
 * rather than of the order the motifs happened to be scanned in.
 */
export function motifFamilies(text: string): TransitionFamily[] {
  return TRANSITION_FAMILIES.map((family, order) => ({
    family,
    order,
    hits: MOTIFS[family].reduce((n, word) => (text.includes(word) ? n + 1 : n), 0),
  }))
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.order - b.order)
    .map((entry) => entry.family);
}

/** The family a poem falls back to when its words name none. */
export function hashFamily(id: string): TransitionFamily {
  return TRANSITION_FAMILIES[hashString(id) % TRANSITION_FAMILIES.length] as TransitionFamily;
}

export type TransitionDirection = "forward" | "reverse";

export type TransitionPlan = {
  family: TransitionFamily;
  direction: TransitionDirection;
  /** 1–3: how far into the page the effect layer sits. */
  depth: 1 | 2 | 3;
  duration: number;
  /** Where the reader touched, in fractions of the stage box. */
  origin: { x: number; y: number };
};

export type TransitionRequest = {
  /** Corpus id of the poem arriving. */
  id: string;
  /** Its text, for reading the motifs out of. */
  text: string;
  /** Families recently played, newest first. */
  history: readonly TransitionFamily[];
  /** Where the reader touched, if a pointer was involved. */
  origin?: { x: number; y: number } | null;
};

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0.5;

/**
 * Pick the family, then the variation.
 *
 * The bag rules out the last six; the poem's own motifs choose among what is
 * left, and its id hash breaks the tie. Only if the bag has ruled out every
 * family does the rule relax to "anything but the one just played", which is
 * the promise that actually matters.
 */
export function planTransition(request: TransitionRequest): TransitionPlan {
  const recent = request.history.slice(0, TRANSITION_HISTORY);
  const fresh = (families: readonly TransitionFamily[]): TransitionFamily[] =>
    families.filter((family) => !recent.includes(family));

  const wanted = motifFamilies(request.text);
  const candidates =
    fresh(wanted).length > 0
      ? fresh(wanted)
      : fresh(TRANSITION_FAMILIES).length > 0
        ? fresh(TRANSITION_FAMILIES)
        : TRANSITION_FAMILIES.filter((family) => family !== recent[0]);

  const pool = candidates.length > 0 ? candidates : [...TRANSITION_FAMILIES];
  const family = pool[hashString(request.id) % pool.length] as TransitionFamily;
  const spread = TRANSITION_MAX_MS - TRANSITION_MIN_MS + 1;

  return {
    family,
    direction: hashString(`${request.id}:direction`) % 2 === 0 ? "forward" : "reverse",
    depth: ((hashString(`${request.id}:depth`) % 3) + 1) as 1 | 2 | 3,
    duration: TRANSITION_MIN_MS + (hashString(`${request.id}:time`) % spread),
    origin: {
      x: clamp01(request.origin?.x ?? 0.5),
      y: clamp01(request.origin?.y ?? 0.5),
    },
  };
}

/** The bag, newest first, trimmed to the families still worth avoiding. */
export function rememberFamily(
  history: readonly TransitionFamily[],
  family: TransitionFamily,
): TransitionFamily[] {
  return [family, ...history.filter((seen) => seen !== family)].slice(0, TRANSITION_HISTORY);
}
