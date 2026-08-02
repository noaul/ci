import type { AnyNode, Element } from "domhandler";
import type { CheerioAPI } from "cheerio";
import type { Annotation } from "./types.js";

/** ◎ introduces an allusion source / gloss; ◆ introduces 历代辑评 commentary. */
export const NOTE_MARKER = "◎";
export const COMMENTARY_MARKER = "◆";

/**
 * Placeholder for the 90 rare characters the ebook ships as inline images
 * because they fall outside its embedded font. `char-map.json` rewrites the
 * mapped ones to real Unicode; the rest stay as markers for the web layer to
 * render as images.
 */
export function imageToken(file: string): string {
  return `{{IMG:${file}}}`;
}

export const IMAGE_TOKEN_RE = /\{\{IMG:([^}]+)\}\}/g;

/**
 * Text content of a node, with inline character images preserved as tokens.
 *
 * cheerio's .text() silently drops <img>, which would corrupt the ~167 places
 * where an image *is* a character (e.g. 宋傅[img]《东坡纪年录》).
 */
export function extractText($: CheerioAPI, node: AnyNode): string {
  let out = "";
  const walk = (n: AnyNode): void => {
    if (n.type === "text") {
      out += (n as unknown as { data: string }).data;
      return;
    }
    if (n.type !== "tag" && n.type !== "script" && n.type !== "style") return;
    const el = n as Element;
    const tag = el.tagName?.toLowerCase();
    if (tag === "img") {
      const src = el.attribs?.["src"] ?? "";
      out += imageToken(src.split("/").pop() ?? src);
      return;
    }
    if (tag === "br") {
      out += "\n";
      return;
    }
    for (const child of el.children) walk(child);
  };
  walk(node);
  return out;
}

/** Collapse whitespace and strip zero-width characters, keeping CJK punctuation intact. */
export function normalize(s: string): string {
  return s
    .replace(/[​-‍﻿]/g, "")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/　+/g, "　")
    .trim();
}

const SOURCE_MAX_LEN = 60;

/**
 * Split a trailing full-width parenthetical attribution off an annotation.
 *
 * "黯然销魂者，唯别而已矣。（南朝江淹《别赋》）"
 *   → { text: "黯然销魂者，唯别而已矣。", source: "南朝江淹《别赋》" }
 *
 * Only the final group is considered, and only when it is short enough to
 * plausibly be a citation — commentary occasionally ends with a genuine
 * parenthetical aside, which we would rather leave in the text than mislabel.
 */
export function splitSource(raw: string): Annotation {
  const text = normalize(raw);
  const m = /（([^（）]{1,60})）$/.exec(text);
  if (!m) return { text, source: null, headword: detectHeadword(text) };
  const source = m[1]!.trim();
  const head = text.slice(0, m.index).trim();
  if (!head || source.length > SOURCE_MAX_LEN) {
    return { text, source: null, headword: detectHeadword(text) };
  }
  return { text: head, source, headword: detectHeadword(head) };
}

/**
 * Headword of an editorial gloss, if the note is one.
 *
 * Two printed forms: "谢娘：唐宰相李德裕家谢秋娘为名歌妓。" and
 * "颇黎，即玻璃，古指状如水晶的宝石。". Both key the note to a word that
 * appears in the poem, which lets the reading page attach it inline.
 */
export function detectHeadword(text: string): string | null {
  const colon = /^([^：，。；？！“”（）]{1,8})：/.exec(text);
  if (colon) return colon[1]!;
  const comma = /^([^：，。；？！“”（）]{1,6})，(?:即|指|谓|犹)/.exec(text);
  return comma ? comma[1]! : null;
}

/** Strip the leading ◎/◆ marker from a classified paragraph. */
export function stripMarker(s: string): string {
  return s.replace(/^[◎◆]\s*/, "");
}

const HAN = "\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF";

/** True when the string contains at least one Han character. */
export function hasHan(s: string): boolean {
  return new RegExp(`[${HAN}]`).test(s);
}

/** Characters used by the corpus — drives font subsetting later. */
export function collectChars(s: string, into: Set<string>): void {
  for (const ch of s.replace(IMAGE_TOKEN_RE, "")) into.add(ch);
}
