import AdmZip from "adm-zip";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";

export type NavPoint = {
  label: string;
  /** Spine-relative path, e.g. "text/part0005_split_000.html". Fragment stripped. */
  href: string;
  /** Fragment id from the TOC link, if any. */
  hash: string | null;
  children: NavPoint[];
};

/**
 * Reader for the Calibre-generated 历代名家词集精华录 EPUB.
 *
 * The archive is flat: content.opf and toc.ncx sit at the root, and every
 * document href is already root-relative ("text/partNNNN.html"), so no
 * OPF-directory rebasing is needed.
 */
export class Epub {
  private readonly zip: AdmZip;
  /** Document hrefs in reading order, from the OPF spine. */
  readonly spine: readonly string[];
  /** Top-level TOC entries: 总目录 followed by the 22 volumes. */
  readonly nav: readonly NavPoint[];
  private readonly spineIndex: ReadonlyMap<string, number>;

  constructor(file: string) {
    this.zip = new AdmZip(file);
    this.spine = this.readSpine();
    this.nav = this.readNav();
    this.spineIndex = new Map(this.spine.map((href, i) => [href, i]));
  }

  read(path: string): string {
    const entry = this.zip.getEntry(path);
    if (!entry) throw new Error(`EPUB entry not found: ${path}`);
    return entry.getData().toString("utf8");
  }

  readBuffer(path: string): Buffer {
    const entry = this.zip.getEntry(path);
    if (!entry) throw new Error(`EPUB entry not found: ${path}`);
    return entry.getData();
  }

  /** Position of a document in reading order, or -1. */
  indexOf(href: string): number {
    return this.spineIndex.get(href) ?? -1;
  }

  private readSpine(): string[] {
    const $ = cheerio.load(this.read("content.opf"), { xmlMode: true });
    const manifest = new Map<string, string>();
    $("manifest item").each((_, el) => {
      const id = $(el).attr("id");
      const href = $(el).attr("href");
      if (id && href) manifest.set(id, href);
    });

    const spine: string[] = [];
    $("spine itemref").each((_, el) => {
      const idref = $(el).attr("idref");
      const href = idref ? manifest.get(idref) : undefined;
      if (href) spine.push(href);
    });
    if (spine.length === 0) throw new Error("OPF spine is empty — manifest/itemref parse failed");
    return spine;
  }

  private readNav(): NavPoint[] {
    const $ = cheerio.load(this.read("toc.ncx"), { xmlMode: true });

    const walk = (el: Element): NavPoint => {
      const $el = $(el);
      // .children() keeps this non-recursive: nested navPoints are handled by the
      // recursive call, not swept up into the parent's label/content lookup.
      const label = $el.children("navLabel").first().children("text").first().text().trim();
      const src = $el.children("content").first().attr("src") ?? "";
      const [href = "", hash] = src.split("#");
      return {
        label,
        href,
        hash: hash ?? null,
        children: $el.children("navPoint").toArray().map(walk),
      };
    };

    const roots = $("navMap").children("navPoint").toArray().map(walk);
    if (roots.length === 0) throw new Error("toc.ncx navMap is empty — navPoint parse failed");
    return roots;
  }
}

/** Strip the fragment from a TOC/anchor href. */
export function stripHash(href: string): string {
  const i = href.indexOf("#");
  return i === -1 ? href : href.slice(0, i);
}
