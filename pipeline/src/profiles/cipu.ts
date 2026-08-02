import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { countHanGlyphs, extractText, normalize } from "../text.js";

export type ToneExample = {
  label: string;
  text: string;
  author: string | null;
  /** Indexes into `text` of characters the book marks as rhyme positions. */
  rhymeIndexes: number[];
  /** Indexes the book underlines as 句 (unrhymed line ends). */
  breakIndexes: number[];
};

export type TonePattern = {
  /** 定格 / 变格 / 又一体 … */
  label: string;
  /** Raw symbol string: - 平, ｜ 仄, ＋ 可平可仄, with （韵）（句）（叶）markers. */
  tones: string;
  examples: ToneExample[];
};

export type GelvEntry = {
  name: string;
  aliases: string[];
  category: string;
  description: string | null;
  patterns: TonePattern[];
  sourceFile: string;
};

/** 又名《苍梧谣》、《归字谣》 → ["苍梧谣", "归字谣"] */
export function parseAliases(heading: string): string[] {
  const paren = /（(.+)）\s*$/.exec(heading);
  if (!paren) return [];
  return [...paren[1]!.matchAll(/《([^》]+)》/g)].map((m) => m[1]!);
}

const RHYME_CLASS = /specialtext-double/;
const BREAK_CLASS = /underline/;

/**
 * Parse one 唐宋词格律 tune entry.
 *
 * Layout: <h2> name, a prose description, then one or more 格 blocks — <h4>
 * label, <p> tone string, and <h5>例 blocks pairing an example poem with its
 * author. Rhyme characters are wrapped in specialtext-double spans and 句
 * positions underlined, so the example doubles as a worked illustration of the
 * template above it.
 */
export function parseGelv(html: string, category: string, sourceFile: string): GelvEntry | null {
  const $ = cheerio.load(html);
  const h2 = $("h2").first();
  if (h2.length === 0) return null;

  const name = normalize(h2.clone().children("span,a").remove().end().text()) || normalize(h2.text());
  const aliases = parseAliases(h2.attr("title") ?? "");

  const patterns: TonePattern[] = [];
  let description: string | null = null;
  let pattern: TonePattern | null = null;
  let example: ToneExample | null = null;

  $("h2, h3, h4, h5, p").each((_, el) => {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? "";
    const text = normalize(extractText($, el));
    if (!text || tag === "h2") return;

    if (tag === "h4" || tag === "h3") {
      pattern = { label: text, tones: "", examples: [] };
      patterns.push(pattern);
      example = null;
      return;
    }
    if (tag === "h5") {
      if (!pattern) {
        pattern = { label: "定格", tones: "", examples: [] };
        patterns.push(pattern);
      }
      example = { label: text, text: "", author: null, rhymeIndexes: [], breakIndexes: [] };
      pattern.examples.push(example);
      return;
    }

    // paragraph
    const cls = ($(el).attr("class") ?? "");
    if (/para-right/.test(cls)) {
      if (example) example.author = text.replace(/^[—–-]+/, "").trim();
      return;
    }
    if (!pattern) {
      description = description ? `${description}\n${text}` : text;
      return;
    }
    if (!pattern.tones && !example) {
      pattern.tones = text;
      return;
    }
    if (example && !example.text) {
      Object.assign(example, readMarkedExample($, el as Element));
    }
  });

  return { name, aliases, category, description, patterns, sourceFile };
}

/** Read an example poem, recording which characters carry rhyme/句 marks. */
function readMarkedExample(
  $: cheerio.CheerioAPI,
  p: Element,
): { text: string; rhymeIndexes: number[]; breakIndexes: number[] } {
  let text = "";
  const rhymeIndexes: number[] = [];
  const breakIndexes: number[] = [];

  const walk = (node: import("domhandler").AnyNode, marker: "rhyme" | "break" | null): void => {
    if (node.type === "text") {
      const data = (node as unknown as { data: string }).data;
      for (const ch of data) {
        if (marker === "rhyme") rhymeIndexes.push(text.length);
        else if (marker === "break") breakIndexes.push(text.length);
        text += ch;
      }
      return;
    }
    if (node.type !== "tag") return;
    const el = node as Element;
    const cls = el.attribs?.["class"] ?? "";
    const next = RHYME_CLASS.test(cls) ? "rhyme" : BREAK_CLASS.test(cls) ? "break" : marker;
    for (const child of el.children) walk(child, next);
  };

  for (const child of p.children) walk(child, null);
  return { text: normalize(text), rhymeIndexes, breakIndexes };
}

// ---------------------------------------------------------------------------
// 白香词谱
// ---------------------------------------------------------------------------

/**
 * Tone marks used by 白香词谱, as observed across all 100 entries:
 *   平 / 仄  fixed tone
 *   〇 / ●   可平可仄 (open = the example uses 平, filled = 仄)
 *   ◎        平韵 rhyme position
 *   △        仄韵 rhyme position
 *   ① / ②    平韵 rhyme groups, for tunes that change rhyme
 *   △¹ / △²  仄韵 rhyme groups (printed as images, mapped below)
 *   去        must be 去声
 */
export const TONE_MARKS = ["平", "仄", "〇", "●", "◎", "△", "①", "②", "△¹", "△²", "去"] as const;

/** Two 仄韵 group marks are shipped as images: a △ containing 1 and one containing 2. */
const TONE_IMAGES: Record<string, string> = {
  "00295.jpeg": "△¹",
  "00028.jpeg": "△²",
};

export type BaixiangChar = {
  ch: string;
  /** Tone mark from the ruby base; see TONE_MARKS. Null for punctuation. */
  tone: string | null;
};

/**
 * One worked example of the tune. The first variant is the entry's main
 * example; further variants are alternate 体 the book appends under their own
 * centred heading (声声慢 carries both a 平韵格 and a 仄韵格 by other poets).
 */
export type BaixiangVariant = {
  /** Heading of an alternate 体, e.g. "声声慢（平韵格）"; null for the main example. */
  label: string | null;
  author: string | null;
  /** One entry per 片. Punctuation carries tone: null. */
  stanzas: BaixiangChar[][];
  text: string;
  tones: string;
};

export type BaixiangEntry = {
  name: string;
  title: string | null;
  variants: BaixiangVariant[];
  notes: { n: number; text: string }[];
  /** 【评析】 — the editor's reading of the example poem. */
  analysis: string | null;
  /** 【说明】 — history of the tune, its aliases and metrical rules. */
  remark: string | null;
  sourceFile: string;
};

/** Han characters in the main example — the tune's 字数. */
export function baixiangCharCount(entry: BaixiangEntry): number | null {
  const main = entry.variants[0];
  if (!main) return null;
  return main.stanzas.flat().reduce((total, c) => total + countHanGlyphs(c.ch), 0);
}

/**
 * Parse one 白香词谱 entry.
 *
 * The tone template is stored as *inverted* ruby: the ruby base <rb> holds the
 * 平仄 mark and the ruby text <rt> holds the actual character, so joining the
 * bases yields the template and joining the ruby texts yields the poem. Rubies
 * with no <rb> are footnote references rather than characters.
 */
export function parseBaixiang(html: string, sourceFile: string): BaixiangEntry | null {
  const $ = cheerio.load(html);
  const h2 = $("h2").first();
  if (h2.length === 0) return null;

  let name = "";
  const titleParts: string[] = [];
  for (const node of h2.get(0)!.children) {
    if (node.type === "text") {
      name += (node as unknown as { data: string }).data;
      continue;
    }
    if (node.type !== "tag") continue;
    const el = node as Element;
    const cls = el.attribs?.["class"] ?? "";
    const t = normalize(extractText($, el));
    if (!t || cls.includes("math-super") || /^\[\d+\]$/.test(t)) continue;
    titleParts.push(t);
  }
  name = normalize(name);
  if (!name) return null;

  const notes: { n: number; text: string }[] = [];
  const variants: BaixiangVariant[] = [];
  let current: { label: string | null; author: string | null; stanzas: BaixiangChar[][] } = {
    label: null,
    author: null,
    stanzas: [],
  };
  let analysis: string | null = null;
  let remark: string | null = null;

  const flush = (): void => {
    if (current.stanzas.length === 0) return;
    const all = current.stanzas.flat();
    variants.push({
      label: current.label,
      author: current.author,
      stanzas: current.stanzas,
      text: all.map((c) => c.ch).join(""),
      tones: all.map((c) => c.tone ?? "").join(""),
    });
    current = { label: null, author: null, stanzas: [] };
  };

  $("p").each((_, el) => {
    const $el = $(el);
    const cls = $el.attr("class") ?? "";
    const text = normalize(extractText($, el));

    // An alternate 体 opens with its own centred heading, then a signature.
    if (/para-align-center/.test(cls) && text && $el.find("ruby").length === 0) {
      flush();
      current.label = text;
      return;
    }
    if (/signature/.test(cls)) {
      // A signature after a completed example introduces the next one.
      if (current.stanzas.length > 0) flush();
      current.author = text;
      return;
    }
    // 【评析】 is the editor's reading of the example poem; 【说明】 covers the
    // tune's history and metrical rules. Either can trail the poem in the same
    // paragraph rather than standing alone.
    const takeBracketed = (s: string): boolean => {
      const m = /^【(评析|说明)】([\s\S]*)$/.exec(s.trim());
      if (!m) return false;
      // Commentary always follows the example it discusses, so it closes the
      // current variant. 减字木兰花 appends a second example after its 【说明】
      // with no heading of its own; without this it would merge into the first.
      flush();
      if (m[1] === "评析") analysis = m[2]!.trim();
      else remark = m[2]!.trim();
      return true;
    };

    if ($el.find("ruby").length > 0) {
      const stanza: BaixiangChar[] = [];
      const tail = readRuby($, el as Element, stanza);
      if (stanza.length) current.stanzas.push(stanza);
      if (tail) takeBracketed(tail);
      return;
    }
    if (takeBracketed(text)) return;
    const noteMatch = /^\[(\d+)\]\s*(.+)$/.exec(text);
    if (noteMatch) {
      flush();
      notes.push({ n: Number(noteMatch[1]), text: noteMatch[2]!.trim() });
    }
  });

  flush();
  if (variants.length === 0) return null;

  return {
    name,
    title: titleParts.join("").trim() || null,
    variants,
    notes,
    analysis,
    remark,
    sourceFile,
  };
}

/** Tone-mark images with no mapping; surfaced by the ETL so new ones can't slip through. */
export const unmappedToneImages = new Set<string>();

/**
 * Collect the ruby characters of a poem paragraph.
 *
 * Returns any trailing prose: 念奴娇 prints its 【说明】 inside the same
 * paragraph as the poem, so everything from the first 【 onward is handed back
 * rather than being mistaken for untoned poem characters.
 */
function readRuby($: cheerio.CheerioAPI, p: Element, out: BaixiangChar[]): string {
  let tail = "";
  const walk = (node: import("domhandler").AnyNode): void => {
    if (node.type === "text") {
      for (const ch of (node as unknown as { data: string }).data) {
        if (tail || ch === "【") {
          tail += ch;
          continue;
        }
        if (ch.trim()) out.push({ ch, tone: null });
      }
      return;
    }
    if (node.type !== "tag") return;
    const el = node as Element;
    const tag = el.tagName?.toLowerCase();

    if (tail) {
      tail += extractText($, el);
      return;
    }
    if (tag === "ruby") {
      const $ruby = $(el);
      const rb = $ruby.children("rb").first();
      const rt = $ruby.children("rt").first();
      // A ruby with no <rb> is a footnote reference, not a character.
      if (rb.length === 0) return;
      const ch = normalize(rt.text());
      if (!ch) return;
      let tone = normalize(rb.text());
      if (!tone) {
        const img = (rb.find("img").first().attr("src") ?? "").split("/").pop() ?? "";
        tone = TONE_IMAGES[img] ?? "";
        if (!tone && img) unmappedToneImages.add(img);
      }
      out.push({ ch, tone: tone || null });
      return;
    }
    if (tag === "a") return; // footnote link
    for (const child of el.children) walk(child);
  };
  for (const child of p.children) walk(child);
  return normalize(tail);
}
