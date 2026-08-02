import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { Annotation } from "../types.js";
import {
  COMMENTARY_MARKER,
  NOTE_MARKER,
  extractText,
  normalize,
  splitSource,
  stripMarker,
} from "../text.js";

export type ParsedPoem = {
  tune: string;
  title: string | null;
  preface: string | null;
  /** Stanza (片) → lines. Volumes that print a 片 as one block yield a single line. */
  stanzas: string[][];
  notes: Annotation[];
  commentary: Annotation[];
  warnings: string[];
};

/** 小序 markup: 2em-indent in most volumes, kindle-cn-ref in 姜夔. */
const PREFACE_CLASS = /(?:^|[\s-])(?:para-2em-indent\d*|ref\d*)(?:\s|$)/;
/** 词意图 plate captions. */
const CAPTION_CLASS = /picture-txt/;
/** Signature lines (李清照 in 词论, 陈维崧 in a 纳兰 附录 piece). */
const SIGNATURE_CLASS = /signature|para-right\d*/;

const SENTENCE_PUNCT = /[，。、；：？！“”‘’…—]/;
/** Lines in the line-per-paragraph volumes always carry punctuation; 词题 never does. */
const TITLE_MAX_LEN = 10;

type Para = { text: string; cls: string; separator: boolean };

/**
 * Parse one poem document.
 *
 * Paragraph roles are decided by the leading ◎/◆ marker and by content shape,
 * never by CSS class alone: Calibre renumbered classes per source book, so the
 * poem body is `calibre9` in 温庭筠, `kindle-cn-bold1` in 苏轼 and
 * `kindle-cn-kai5` in 辛弃疾. Class is consulted only for 小序 and captions,
 * where the naming does hold across volumes.
 */
export function parsePoem(html: string, href: string): ParsedPoem | null {
  const $ = cheerio.load(html);
  const h2 = $("h2").first();
  if (h2.length === 0) return null;

  const warnings: string[] = [];
  const { tune, title: h2Title } = splitHeading($, h2.get(0) as Element);
  if (!tune) {
    warnings.push(`${href}: empty tune in <h2>`);
    return null;
  }

  const paras: Para[] = [];
  const notes: Annotation[] = [];
  const commentary: Annotation[] = [];
  let seenMarker = false;
  let lastAnnotation: Annotation | null = null;

  $("p").each((_, el) => {
    const raw = extractText($, el);
    const text = normalize(raw);
    const cls = ($(el).attr("class") ?? "").replace(/\s+/g, " ");

    if (text.startsWith(NOTE_MARKER)) {
      seenMarker = true;
      lastAnnotation = splitSource(stripMarker(text));
      notes.push(lastAnnotation);
      return;
    }
    if (text.startsWith(COMMENTARY_MARKER)) {
      seenMarker = true;
      lastAnnotation = splitSource(stripMarker(text));
      commentary.push(lastAnnotation);
      return;
    }
    if (seenMarker) {
      // Unmarked paragraph after a marker is a continuation of that annotation,
      // not a stray stanza. Re-run the source split over the joined text so a
      // citation on the final paragraph still lands in `source`.
      if (text && lastAnnotation) {
        const merged = splitSource(`${lastAnnotation.text}\n${text}`);
        lastAnnotation.text = merged.text;
        lastAnnotation.source = merged.source ?? lastAnnotation.source;
      } else if (text) {
        warnings.push(`${href}: orphan paragraph after marker: ${text.slice(0, 24)}`);
      }
      return;
    }

    if (CAPTION_CLASS.test(cls)) return;
    if (SIGNATURE_CLASS.test(cls) && text) {
      warnings.push(`${href}: dropped signature line "${text.slice(0, 20)}"`);
      return;
    }
    paras.push({ text, cls, separator: text === "" });
  });

  const prefaceParts: string[] = [];
  const body: Para[] = [];
  for (const p of paras) {
    if (!p.separator && PREFACE_CLASS.test(p.cls) && body.length === 0) prefaceParts.push(p.text);
    else body.push(p);
  }

  // 柳永 prints 词题 as its own centred paragraph instead of putting it in the
  // <h2>: short, and — unlike a poem line — carrying no sentence punctuation.
  let title = h2Title;
  const filledCount = body.filter((p) => !p.separator).length;
  const firstBody = body.find((p) => !p.separator);
  // Never consume the only body paragraph: 陆游's 断句 entries are single
  // unpunctuated fragments that would otherwise be mistaken for a 词题.
  if (!title && firstBody && filledCount >= 2 && isBareTitle(firstBody.text)) {
    title = firstBody.text;
    body.splice(body.indexOf(firstBody), 1);
  }

  const stanzas = groupStanzas(body);
  if (stanzas.length === 0) return null;

  return {
    tune,
    title: title || null,
    preface: prefaceParts.length ? prefaceParts.join("\n") : null,
    stanzas,
    notes,
    commentary,
    warnings,
  };
}

function isBareTitle(text: string): boolean {
  return text.length <= TITLE_MAX_LEN && !SENTENCE_PUNCT.test(text) && !text.includes("\n");
}

/**
 * Split an <h2> into 词牌 and 词题.
 *
 * The tune sits in the heading's own text nodes; the 词题, when present, is
 * wrapped in a <span> whose class differs per volume (font2, calibre16, kaiti,
 * kindle-cn-kai3). Empty <a> anchors and [N] footnote references are ignored.
 */
function splitHeading(
  $: cheerio.CheerioAPI,
  h2: Element,
): { tune: string; title: string | null } {
  let tune = "";
  const titleParts: string[] = [];

  for (const node of h2.children) {
    if (node.type === "text") {
      tune += (node as unknown as { data: string }).data;
      continue;
    }
    if (node.type !== "tag") continue;
    const el = node as Element;
    const cls = el.attribs?.["class"] ?? "";
    const text = normalize(extractText($, el));
    if (!text) continue;
    if (cls.includes("math-super") || /^\[\d+\]$/.test(text)) continue;
    titleParts.push(text);
  }

  const cleanedTune = normalize(tune).replace(/^[　\s]+|[　\s]+$/g, "");
  let title = titleParts.join("").trim() || null;

  // A few headings separate 词牌 from 词题 with an ideographic space instead of
  // wrapping the 词题 in a span.
  if (!title && /　/.test(cleanedTune)) {
    const [head, ...rest] = cleanedTune.split("　");
    const tail = rest.join("　").trim();
    if (head && tail) return { tune: head.trim(), title: tail };
  }

  return { tune: cleanedTune, title };
}

/**
 * Normalise the three body layouts the 22 volumes use:
 *   - one paragraph per 片 (most volumes)
 *   - one paragraph per line, blank paragraph between 片 (李清照)
 *   - one paragraph per 片 with <br> between lines (李煜)
 */
function groupStanzas(body: Para[]): string[][] {
  const filled = body.filter((p) => !p.separator);
  if (filled.length === 0) return [];

  if (filled.some((p) => p.text.includes("\n"))) {
    return filled.map((p) => p.text.split("\n").map((l) => l.trim()).filter(Boolean));
  }

  // Line-per-paragraph volumes break mid-sentence, so most paragraphs end on a
  // non-terminal mark. A 片 printed as one block ends on 。？！ almost always.
  const nonTerminal = filled.filter((p) => /[，、；]$/.test(p.text)).length;
  const lineMode = filled.length >= 2 && nonTerminal / filled.length >= 0.3;

  if (!lineMode) return filled.map((p) => [p.text]);

  const stanzas: string[][] = [];
  let current: string[] = [];
  for (const p of body) {
    if (p.separator) {
      if (current.length) stanzas.push(current);
      current = [];
    } else current.push(p.text);
  }
  if (current.length) stanzas.push(current);
  return stanzas;
}
