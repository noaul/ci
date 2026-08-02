import * as cheerio from "cheerio";
import { extractText, normalize } from "../text.js";
import type { ProseBlock } from "../types.js";

export type ParsedProse = {
  headings: string[];
  blocks: ProseBlock[];
};

/** 总评 excerpts lead with a bolded citation, then an ideographic space, then the text. */
const BOLD_CLASS = /bold/;

/**
 * Parse a prose document: volume 导读 introductions, per-poet 总评 critical
 * overviews, 李清照's 词论, and 附录 essays.
 *
 * 总评 pages attribute each excerpt with a bolded source at the head of the
 * paragraph (庄绰《鸡肋编》　靖康初…), the mirror image of the trailing
 * attribution used by ◎/◆ annotations on poem pages.
 */
export function parseProse(html: string): ParsedProse {
  const $ = cheerio.load(html);
  const blocks: ProseBlock[] = [];
  const headings: string[] = [];

  $("h1, h2, h3, h4, h5, p").each((_, el) => {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? "";
    const text = normalize(extractText($, el));
    if (!text) return;

    if (tag !== "p") {
      const level = Number(tag.slice(1));
      headings.push(text);
      blocks.push({ type: "heading", level, text });
      return;
    }

    const firstEl = $(el).children().first();
    const cls = firstEl.attr("class") ?? "";
    if (firstEl.length && BOLD_CLASS.test(cls)) {
      const source = normalize(extractText($, firstEl.get(0)!));
      const rest = text.startsWith(source) ? text.slice(source.length) : text;
      const body = rest.replace(/^[　\s]+/, "");
      if (source && body) {
        blocks.push({ type: "para", source, text: body });
        return;
      }
    }
    blocks.push({ type: "para", source: null, text });
  });

  return { headings, blocks };
}
