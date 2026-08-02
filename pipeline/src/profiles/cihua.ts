import * as cheerio from "cheerio";
import { extractText, normalize } from "../text.js";

/** A poem quoted inside a 词话 entry, printed under its own heading. */
export type CihuaQuote = {
  title: string | null;
  author: string | null;
  lines: string[];
  /** Poem in this corpus with the same opening line, if there is one. */
  poemId: string | null;
};

export type CihuaEntry = {
  id: string;
  volumeId: string;
  /** 白雨斋词话卷一 / 卷上 人间词话 / 第一章 … */
  section: string;
  /** The 【壹】-style numbering the book prints, where it does. */
  ordinal: string | null;
  /** 词品 titles each entry (陶弘景寒夜怨); the others do not. */
  heading: string | null;
  paragraphs: string[];
  footnotes: { n: number; text: string }[];
  quotes: CihuaQuote[];
  sourceFile: string;
};

const ORDINAL = /^【([^】]{1,8})】\s*/;
const FOOTNOTE = /^\[(\d+)\]\s*(.+)$/;
/** Quoted verse: 人间词话 uses poem-left/para-center1, 词史 uses kindle-cn-ref. */
const QUOTE_LINE = /poem-left|para-center1|kindle-cn-ref\d*$/;
const QUOTE_AUTHOR = /para-center4|signature|para-right\d*/;

type Draft = Omit<CihuaEntry, "id" | "volumeId">;

/**
 * Parse one 词话 document into entries.
 *
 * The five 词话 volumes are printed differently — 词品 heads each entry with a
 * titled <h2>, 白雨斋词话 runs a whole 卷 of 【壹】-numbered paragraphs through a
 * single file, 人间词话 gives each 则 its own file, and 词史/词学通论 are plain
 * chapters. One rule covers them all: an entry begins at a heading or at a
 * paragraph opening with a 【N】 marker, and everything after it belongs to that
 * entry until the next one starts.
 */
export function parseCihua(html: string, section: string, sourceFile: string): Draft[] {
  const $ = cheerio.load(html);
  const entries: Draft[] = [];
  let current: Draft | null = null;

  const open = (ordinal: string | null, heading: string | null): Draft => {
    const draft: Draft = {
      section,
      ordinal,
      heading,
      paragraphs: [],
      footnotes: [],
      quotes: [],
      sourceFile,
    };
    entries.push(draft);
    return draft;
  };

  $("h1,h2,h3,h4,h5,p").each((_, el) => {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? "";
    const cls = $(el).attr("class") ?? "";
    const text = normalize(extractText($, el));
    if (!text) return;

    // h1 repeats the section title supplied by the caller.
    if (tag === "h1") return;

    if (tag === "h2" || tag === "h3") {
      const m = ORDINAL.exec(text);
      current = m ? open(m[1]!, text.slice(m[0].length).trim() || null) : open(null, text);
      return;
    }

    // A quoted poem opens with its own small heading and runs until the next
    // block that is neither an author line nor a verse line.
    if (tag === "h5" || tag === "h4") {
      current ??= open(null, null);
      current.quotes.push({ title: text, author: null, lines: [], poemId: null });
      return;
    }

    current ??= open(null, null);
    const quote = current.quotes.at(-1);

    const footnote = FOOTNOTE.exec(text);
    if (footnote) {
      current.footnotes.push({ n: Number(footnote[1]), text: footnote[2]!.trim() });
      return;
    }

    const marker = ORDINAL.exec(text);
    if (marker) {
      current = open(marker[1]!, null);
      const rest = text.slice(marker[0].length).trim();
      if (rest) current.paragraphs.push(rest);
      return;
    }

    if (quote && QUOTE_AUTHOR.test(cls) && quote.lines.length === 0) {
      quote.author = text;
      return;
    }
    if (quote && QUOTE_LINE.test(cls)) {
      quote.lines.push(...text.split("\n").map((l) => l.trim()).filter(Boolean));
      return;
    }

    current.paragraphs.push(text);
  });

  return entries.filter((e) => e.paragraphs.length > 0 || e.quotes.length > 0 || e.heading);
}

/** Strip punctuation so a quoted opening line can be matched against the corpus. */
export function normalizeLine(s: string): string {
  return s.replace(/\{\{IMG:[^}]+\}\}/g, "").replace(/[^一-鿿]/g, "");
}
