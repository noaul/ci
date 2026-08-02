import {
  type BaixiangEntry,
  type GelvEntry,
  type TonePattern,
  baixiangCharCount,
} from "./profiles/cipu.js";
import type { Poem } from "./types.js";
import { slugify } from "./volumes.js";

export type Tune = {
  id: string;
  /** 词牌 as printed on the poems. */
  name: string;
  /** Alternate names, from 唐宋词格律's heading. */
  aliases: string[];
  /** Character count of the tune, where a 词谱 records it. */
  charCount: number | null;
  /** 第一类 平韵格 … from 唐宋词格律. */
  category: string | null;
  description: string | null;
  patterns: TonePattern[];
  /** 白香词谱's per-character tone template, when it covers this tune. */
  baixiang: BaixiangEntry | null;
  /**
   * A tune whose 词谱 entry lists this name among its variants — 减字木兰花 is
   * filed under 木兰花, for instance. Recorded as a cross-reference rather than
   * folded in, because those are related but metrically distinct tunes.
   */
  relatedTune: { name: string; id: string } | null;
  sourceBooks: string[];
  poemCount: number;
  poemIds: string[];
};

const CN_DIGITS: Record<string, number> = {
  〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

/** Parse 十六 / 二十七 / 一百零四 style numerals. */
export function parseChineseNumber(s: string): number | null {
  if (!s) return null;
  let total = 0;
  let section = 0;
  let current = 0;
  let seen = false;
  for (const ch of s) {
    if (ch in CN_DIGITS) {
      current = CN_DIGITS[ch]!;
      seen = true;
    } else if (ch === "十") {
      section += (current || 1) * 10;
      current = 0;
      seen = true;
    } else if (ch === "百") {
      section += (current || 1) * 100;
      current = 0;
      seen = true;
    } else if (ch === "千") {
      total += (section + current || 1) * 1000;
      section = 0;
      current = 0;
      seen = true;
    } else return null;
  }
  return seen ? total + section + current : null;
}

const HAN_CHAR = /[一-鿿]/;

/**
 * Build the 词牌 registry.
 *
 * Tune identity is the name printed on the poems — that is what a reader
 * searches for. 唐宋词格律 and 白香词谱 are then matched onto those names,
 * directly or through the aliases 唐宋词格律 lists in its headings, so a poem
 * filed under 《苍梧谣》 still reaches the 十六字令 template.
 */
export function buildTunes(
  poems: Poem[],
  gelv: GelvEntry[],
  baixiang: BaixiangEntry[],
): { tunes: Tune[]; unmatched: string[] } {
  const gelvByName = new Map<string, GelvEntry>();
  const gelvByAlias = new Map<string, GelvEntry>();
  for (const g of gelv) {
    gelvByName.set(g.name, g);
    for (const a of g.aliases) if (!gelvByAlias.has(a)) gelvByAlias.set(a, g);
  }

  const baixiangByName = new Map<string, BaixiangEntry>();
  for (const b of baixiang) if (!baixiangByName.has(b.name)) baixiangByName.set(b.name, b);

  const poemIdsByTune = new Map<string, string[]>();
  const lengthsByTune = new Map<string, number[]>();
  for (const p of poems) {
    let list = poemIdsByTune.get(p.tune);
    if (!list) poemIdsByTune.set(p.tune, (list = []));
    list.push(p.id);

    const n = p.stanzas.flat().join("").replace(/[^一-鿿]/g, "").length;
    let lens = lengthsByTune.get(p.tune);
    if (!lens) lengthsByTune.set(p.tune, (lens = []));
    lens.push(n);
  }

  /** Typical 字数 of the poems actually filed under a tune name. */
  const typicalLength = (name: string): number | null => {
    const lens = lengthsByTune.get(name);
    if (!lens?.length) return null;
    const sorted = [...lens].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)]!;
  };

  // Every name worth a page: those that carry poems, plus 词谱 tunes with none.
  const names = new Set<string>([
    ...poemIdsByTune.keys(),
    ...gelvByName.keys(),
    ...baixiangByName.keys(),
  ]);

  const used = new Set<string>();
  const tunes: Tune[] = [];

  for (const name of names) {
    // 唐宋词格律 lists two kinds of name under one heading: true alternate names
    // (鹊踏枝 is 蝶恋花) and related-but-distinct tunes (减字木兰花 is filed under
    // 木兰花 but is 44 characters to its 55). The book does not mark which is
    // which, so the corpus decides: if poems filed under this name run to the
    // same 字数 as the host tune, it is the same tune and inherits the template;
    // otherwise it stays a cross-reference.
    let g = gelvByName.get(name) ?? null;
    let related: GelvEntry | null = null;
    let viaAlias = false;
    if (!g) {
      const host = gelvByAlias.get(name) ?? null;
      if (host) {
        const own = typicalLength(name);
        const hostLen = parseChineseNumber(
          /([一二三四五六七八九十百千零〇]+)字/.exec(host.description ?? "")?.[1] ?? "",
        );
        // A 双调 setting is two 片 of the 单调 form, so 望江南's 54-character
        // poems still belong to 忆江南's 27-character template.
        const sameTune =
          own !== null &&
          hostLen !== null &&
          (Math.abs(own - hostLen) <= 1 || Math.abs(own - hostLen * 2) <= 2);
        if (sameTune) {
          g = host;
          viaAlias = true;
        } else related = host;
      }
    }
    const b = baixiangByName.get(name) ?? null;

    const poemIds = poemIdsByTune.get(name) ?? [];
    if (g || b) used.add(name);

    const charCount =
      (b ? baixiangCharCount(b) : null) ??
      (g ? parseChineseNumber(/([一二三四五六七八九十百千零〇]+)字/.exec(g.description ?? "")?.[1] ?? "") : null);

    const sourceBooks: string[] = [];
    if (g) sourceBooks.push("唐宋词格律");
    if (b) sourceBooks.push("白香词谱");

    tunes.push({
      id: slugify(name) || `tune-${tunes.length}`,
      name,
      // When the template was reached through an alias, the host's own name is
      // itself an alternate name for this tune.
      aliases: g ? [...(viaAlias ? [g.name] : []), ...g.aliases].filter((a) => a !== name) : [],
      charCount,
      category: g?.category ?? null,
      description: g?.description ?? null,
      patterns: g?.patterns ?? [],
      baixiang: b,
      relatedTune: related ? { name: related.name, id: slugify(related.name) } : null,
      sourceBooks,
      poemCount: poemIds.length,
      poemIds,
    });
  }

  // Slugs collide when two tunes romanise identically (e.g. 又名 variants);
  // disambiguate rather than silently overwrite a page.
  const bySlug = new Map<string, number>();
  for (const t of tunes) {
    const n = bySlug.get(t.id) ?? 0;
    bySlug.set(t.id, n + 1);
    if (n > 0) t.id = `${t.id}-${n + 1}`;
  }

  tunes.sort((a, b) => b.poemCount - a.poemCount || a.name.localeCompare(b.name, "zh"));

  const unmatched = [...poemIdsByTune.keys()].filter((n) => !used.has(n));
  return { tunes, unmatched };
}
