import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Epub, type NavPoint } from "./epub.js";
import { parsePoem } from "./profiles/anthology.js";
import {
  type BaixiangEntry,
  type GelvEntry,
  parseBaixiang,
  parseGelv,
  unmappedToneImages,
} from "./profiles/cipu.js";
import { type CihuaEntry, normalizeLine, parseCihua } from "./profiles/cihua.js";
import { parseProse } from "./profiles/prose.js";
import { IMAGE_TOKEN_RE, collectChars } from "./text.js";
import { buildTunes } from "./tunes.js";
import type { Poem, Poet, ProseDoc, ProseDocKind, Volume } from "./types.js";
import {
  POETS,
  VOLUMES,
  isProseEntry,
  pinyinInitial,
  poetByName,
  poetFromSection,
  slugify,
} from "./volumes.js";

const EPUB_PATH = "source/corpus.epub";
const OUT_DIR = "content";

/** 又 means "same tune as the poem above" and is not itself a 词牌. */
const REPEAT_TUNE = "又";
/** Navigation entries with no readable content of their own. */
const SKIP_FRONT_MATTER = /^(书名页|目录|封面)$/;

/** Spine index one past the last file belonging to a volume. */
function spineEnd(epub: Epub, nav: NavPoint, label: string): number {
  const i = epub.nav.findIndex((n) => n.label === label);
  const next = epub.nav[i + 1];
  return next ? epub.indexOf(next.href) : epub.spine.length;
}

function proseKind(label: string): ProseDocKind {
  if (label.startsWith("导读")) return "导读";
  if (label === "总评") return "总评";
  if (label === "词论") return "词论";
  if (label.startsWith("附录")) return "附录";
  return "其他";
}

function main(): void {
  const epub = new Epub(EPUB_PATH);
  const navByLabel = new Map(epub.nav.map((n) => [n.label, n]));

  const warnings: string[] = [];
  const charset = new Set<string>();
  const volumes: Volume[] = [];
  const poemsByVolume = new Map<string, Poem[]>();
  const proseByVolume = new Map<string, ProseDoc[]>();
  const poemCountByPoet = new Map<string, number>();
  const volumeIdsByPoet = new Map<string, Set<string>>();
  const gelvEntries: GelvEntry[] = [];
  const baixiangEntries: BaixiangEntry[] = [];
  const cihuaByVolume = new Map<string, CihuaEntry[]>();

  VOLUMES.forEach((def, index) => {
    const nav = navByLabel.get(def.label);
    if (!nav) throw new Error(`Volume not found in toc.ncx: ${def.label}`);

    const poems: Poem[] = [];
    const prose: ProseDoc[] = [];

    const addProse = (entry: NavPoint, poetId: string | null): void => {
      if (SKIP_FRONT_MATTER.test(entry.label)) return;
      const kind = proseKind(entry.label);
      const parsed = parseProse(epub.read(entry.href));
      if (parsed.blocks.length === 0) {
        warnings.push(`${entry.href}: prose entry "${entry.label}" produced no blocks`);
        return;
      }
      // The document usually opens with its own title as a heading; the site
      // already renders that from `title`, so drop the duplicate.
      const blocks = [...parsed.blocks];
      while (
        blocks[0]?.type === "heading" &&
        blocks[0].text.replace(/\s+/g, "") === entry.label.replace(/\s+/g, "")
      ) {
        blocks.shift();
      }

      const seq = String(prose.length + 1).padStart(2, "0");
      prose.push({
        id: `${def.id}/${seq}-${slugify(entry.label) || "wen"}`,
        volumeId: def.id,
        // 导读 introduces the whole volume, which may cover several poets.
        poetId: kind === "导读" ? null : poetId,
        kind,
        title: entry.label,
        blocks,
        sourceFile: entry.href,
      });
      for (const b of parsed.blocks) {
        collectChars(b.text, charset);
        if (b.type === "para" && b.source) collectChars(b.source, charset);
      }
    };

    if (def.kind === "anthology") {
      let currentPoet = def.defaultPoet ?? "";
      let lastTune: string | null = null;
      let order = 0;

      for (const child of nav.children) {
        // Leaf entries are front matter or trailing prose (导读, 总评, 附录).
        if (child.children.length === 0) {
          addProse(child, poetByName(currentPoet)?.id ?? null);
          continue;
        }

        const sectionPoet = poetFromSection(child.label);
        if (sectionPoet) {
          currentPoet = sectionPoet.name;
          // A new poet restarts the 又 chain; carrying a tune across poets would
          // silently attribute the wrong 词牌.
          lastTune = null;
        }
        const poet = poetByName(currentPoet);
        if (!poet) throw new Error(`Unknown poet "${currentPoet}" in ${def.label}/${child.label}`);

        for (const entry of child.children) {
          if (isProseEntry(entry.label)) {
            addProse(entry, poet.id);
            continue;
          }

          const parsed = parsePoem(epub.read(entry.href), entry.href);
          if (!parsed) {
            // No <h2> or no body: an appended essay rather than a poem.
            addProse(entry, poet.id);
            continue;
          }
          warnings.push(...parsed.warnings);

          const repeated = parsed.tune === REPEAT_TUNE;
          let tune = parsed.tune;
          if (repeated) {
            if (!lastTune) {
              warnings.push(`${entry.href}: 又 with no preceding tune in ${child.label}`);
            } else tune = lastTune;
          } else {
            lastTune = tune;
          }

          order += 1;
          const poem: Poem = {
            id: `${poet.id}/${String(order).padStart(4, "0")}-${slugify(tune) || "ci"}`,
            volumeId: def.id,
            poetId: poet.id,
            poet: poet.name,
            juan: child.label,
            order,
            tune,
            tuneRepeated: repeated,
            title: parsed.title,
            preface: parsed.preface,
            stanzas: parsed.stanzas,
            notes: parsed.notes,
            commentary: parsed.commentary,
            sourceFile: entry.href,
          };
          poems.push(poem);

          poemCountByPoet.set(poet.id, (poemCountByPoet.get(poet.id) ?? 0) + 1);
          let vols = volumeIdsByPoet.get(poet.id);
          if (!vols) volumeIdsByPoet.set(poet.id, (vols = new Set()));
          vols.add(def.id);

          collectChars(tune, charset);
          if (poem.title) collectChars(poem.title, charset);
          if (poem.preface) collectChars(poem.preface, charset);
          for (const stanza of poem.stanzas) for (const line of stanza) collectChars(line, charset);
          for (const a of [...poem.notes, ...poem.commentary]) {
            collectChars(a.text, charset);
            if (a.source) collectChars(a.source, charset);
          }
        }
      }
    }

    if (def.kind === "cipu") {
      for (const child of nav.children) {
        if (child.children.length === 0) {
          addProse(child, null);
          continue;
        }
        // 唐宋词格律 groups tunes under 第一类…第五类; its 词韵简编 section holds
        // rhyme tables, which are prose rather than tune entries.
        const isTuneSection = def.id !== "tang-song-ci-ge-lv" || /^第.类/.test(child.label);
        for (const entry of child.children) {
          if (!isTuneSection) {
            addProse(entry, null);
            continue;
          }
          const html = epub.read(entry.href);
          if (def.id === "tang-song-ci-ge-lv") {
            const parsed = parseGelv(html, child.label, entry.href);
            if (!parsed) {
              warnings.push(`${entry.href}: 唐宋词格律 entry "${entry.label}" did not parse`);
              continue;
            }
            gelvEntries.push(parsed);
            collectChars(parsed.name, charset);
            if (parsed.description) collectChars(parsed.description, charset);
            for (const pat of parsed.patterns) {
              for (const ex of pat.examples) collectChars(ex.text, charset);
            }
          } else {
            const parsed = parseBaixiang(html, entry.href);
            if (!parsed) {
              warnings.push(`${entry.href}: 白香词谱 entry "${entry.label}" did not parse`);
              continue;
            }
            baixiangEntries.push(parsed);
            for (const v of parsed.variants) collectChars(v.text, charset);
            if (parsed.analysis) collectChars(parsed.analysis, charset);
            if (parsed.remark) collectChars(parsed.remark, charset);
            for (const n of parsed.notes) collectChars(n.text, charset);
          }
        }
      }
    }

    if (def.kind === "cihua") {
      // These volumes do not enumerate their entries in the TOC — 白雨斋词话's
      // 卷一 and 人间词话's 卷上 both point at the first file of a run. Walk the
      // spine between one section heading and the next instead.
      // Descend one level where the TOC has it: 词品 nests 卷一…卷六 under a
      // single 词品 node, and 词学通论 nests its chapters, while 白雨斋词话 and
      // 人间词话 list their 卷 at the top. Flattening to the deepest named
      // division keeps every book paginated by 卷 or 章.
      const sections = nav.children
        .filter((c) => !SKIP_FRONT_MATTER.test(c.label))
        .flatMap((c) => (c.children.length > 0 ? c.children : [c]));
      const entries: CihuaEntry[] = [];

      sections.forEach((section, si) => {
        const start = epub.indexOf(section.href);
        if (start < 0) return;
        const nextSection = sections[si + 1];
        const end = nextSection ? epub.indexOf(nextSection.href) : spineEnd(epub, nav, def.label);
        if (/^(导读|导 读|序|自序|自 序|凡例|出版说明)/.test(section.label)) {
          addProse(section, null);
          return;
        }

        for (let i = start; i < end; i++) {
          const href = epub.spine[i];
          if (!href) continue;
          for (const draft of parseCihua(epub.read(href), section.label, href)) {
            const seq = String(entries.length + 1).padStart(4, "0");
            entries.push({ ...draft, id: `${def.id}/${seq}`, volumeId: def.id });
          }
        }
      });

      cihuaByVolume.set(def.id, entries);
      for (const e of entries) {
        for (const p of e.paragraphs) collectChars(p, charset);
        for (const f of e.footnotes) collectChars(f.text, charset);
        for (const q of e.quotes) for (const l of q.lines) collectChars(l, charset);
      }
    }

    poemsByVolume.set(def.id, poems);
    proseByVolume.set(def.id, prose);
    volumes.push({
      id: def.id,
      label: def.label,
      title: def.title,
      kind: def.kind,
      order: index,
      poetIds: [...new Set(poems.map((p) => p.poetId))],
      poemCount: poems.length,
    });
  });

  const poets: Poet[] = POETS.map((p) => ({
    ...p,
    volumeIds: [...(volumeIdsByPoet.get(p.id) ?? [])],
    poemCount: poemCountByPoet.get(p.id) ?? 0,
  }));

  mkdirSync(join(OUT_DIR, "poems"), { recursive: true });
  mkdirSync(join(OUT_DIR, "prose"), { recursive: true });
  for (const [volumeId, list] of poemsByVolume) {
    if (list.length) writeJson(join(OUT_DIR, "poems", `${volumeId}.json`), list);
  }
  for (const [volumeId, list] of proseByVolume) {
    if (list.length) writeJson(join(OUT_DIR, "prose", `${volumeId}.json`), list);
  }
  const allPoems = [...poemsByVolume.values()].flat();
  const { tunes, unmatched } = buildTunes(allPoems, gelvEntries, baixiangEntries);

  // Resolve the poems 词话 entries quote against the corpus by their opening
  // line. 人间词话 links its quotations internally; matching on the line itself
  // reaches the reading page and works for the other four volumes too.
  // Match on a prefix, not the whole line: the anthologies print a 片 as one
  // continuous line while 词话 quotations break it into shorter ones, so the two
  // never agree on where a line ends. A prefix that is ambiguous across poems is
  // dropped rather than guessed at.
  const PREFIX = 8;
  const poemsByOpening = new Map<string, Poem[]>();
  for (const p of allPoems) {
    const key = normalizeLine(p.stanzas[0]?.[0] ?? "").slice(0, PREFIX);
    if (key.length < PREFIX) continue;
    let list = poemsByOpening.get(key);
    if (!list) poemsByOpening.set(key, (list = []));
    list.push(p);
  }

  let linkedQuotes = 0;
  let totalQuotes = 0;
  let ambiguousQuotes = 0;
  for (const entries of cihuaByVolume.values()) {
    for (const entry of entries) {
      for (const quote of entry.quotes) {
        totalQuotes++;
        const key = normalizeLine(quote.lines.join("")).slice(0, PREFIX);
        if (key.length < PREFIX) continue;
        const candidates = poemsByOpening.get(key);
        if (!candidates?.length) continue;

        let match = candidates[0];
        if (candidates.length > 1) {
          // 庭院深深深几许 appears under both 冯延巳《鹊踏枝》 and 欧阳修《蝶恋花》 —
          // the book prints the disputed attribution twice. The quotation names
          // its own poet, so use that rather than guessing.
          const author = (quote.author ?? "").replace(/^［[^］]*］/, "").trim();
          match = candidates.find((p) => author.includes(p.poet));
          if (!match) {
            ambiguousQuotes++;
            continue;
          }
        }
        quote.poemId = match!.id;
        linkedQuotes++;
      }
    }
  }

  // 首句索引: a compact record per poem, grouped by pinyin initial so the index
  // can be served as ~26 small pages rather than one listing every poem.
  const firstLines = allPoems
    .map((p) => ({
      id: p.id,
      line: (p.stanzas[0]?.[0] ?? "").replace(/\{\{IMG:[^}]+\}\}/g, "□"),
      tune: p.tune,
      poet: p.poet,
      initial: pinyinInitial(p.stanzas[0]?.[0] ?? ""),
    }))
    .filter((e) => e.line)
    .sort((a, b) => a.line.localeCompare(b.line, "zh"));

  mkdirSync(join(OUT_DIR, "cipu"), { recursive: true });
  mkdirSync(join(OUT_DIR, "cihua"), { recursive: true });
  for (const [volumeId, entries] of cihuaByVolume) {
    if (entries.length) writeJson(join(OUT_DIR, "cihua", `${volumeId}.json`), entries);
  }
  writeJson(join(OUT_DIR, "first-lines.json"), firstLines);
  writeJson(join(OUT_DIR, "tunes.json"), tunes);
  writeJson(join(OUT_DIR, "cipu", "tang-song-ci-ge-lv.json"), gelvEntries);
  writeJson(join(OUT_DIR, "cipu", "bai-xiang-ci-pu.json"), baixiangEntries);
  writeJson(join(OUT_DIR, "volumes.json"), volumes);
  writeJson(join(OUT_DIR, "poets.json"), poets);
  writeJson(join(OUT_DIR, "charset.json"), [...charset].sort());
  writeJson(join(OUT_DIR, "etl-report.json"), { warnings, tunesWithoutPattern: unmatched });

  // Rare characters the ebook ships as images survive in the text as
  // {{IMG:file}} tokens. Export just those images so the site can render them
  // inline until a Unicode mapping replaces them.
  const referenced = new Set<string>();
  for (const blob of [
    JSON.stringify([...poemsByVolume.values()]),
    JSON.stringify([...proseByVolume.values()]),
    JSON.stringify(gelvEntries),
    JSON.stringify(baixiangEntries),
  ]) {
    for (const m of blob.matchAll(IMAGE_TOKEN_RE)) referenced.add(m[1]!);
  }
  const glyphDir = join("public", "glyphs");
  mkdirSync(glyphDir, { recursive: true });
  for (const file of referenced) {
    writeFileSync(join(glyphDir, file), epub.readBuffer(`images/${file}`));
  }
  console.log(`glyphs    ${referenced.size} rare-character images exported to public/glyphs`);

  const totalPoems = [...poemsByVolume.values()].reduce((n, p) => n + p.length, 0);
  const totalProse = [...proseByVolume.values()].reduce((n, p) => n + p.length, 0);
  console.log(`poems     ${totalPoems}`);
  console.log(`prose     ${totalProse}`);
  const cihuaTotal = [...cihuaByVolume.values()].reduce((n, e) => n + e.length, 0);
  console.log(
    `词话      ${cihuaTotal} entries across ${cihuaByVolume.size} volumes — ` +
      `${linkedQuotes}/${totalQuotes} quoted poems linked to the corpus` +
      (ambiguousQuotes ? ` (${ambiguousQuotes} left unlinked as ambiguous)` : ""),
  );
  console.log(`格律 tunes ${gelvEntries.length}  白香词谱 entries ${baixiangEntries.length}`);
  const withPattern = tunes.filter((t) => t.sourceBooks.length > 0);
  const poemsCovered = withPattern.reduce((n, t) => n + t.poemCount, 0);
  console.log(
    `tunes     ${tunes.length} distinct — ${withPattern.length} have a 词谱 template, ` +
      `covering ${poemsCovered}/${allPoems.length} poems (${((poemsCovered / allPoems.length) * 100).toFixed(1)}%)`,
  );
  if (unmappedToneImages.size) {
    console.log(`  UNMAPPED tone-mark images: ${[...unmappedToneImages].join(", ")}`);
  }
  console.log(`charset   ${charset.size} distinct characters`);
  console.log(`warnings  ${warnings.length}`);
  for (const line of warnings.slice(0, 20)) console.log(`  warn: ${line}`);
  if (warnings.length > 20) console.log(`  … ${warnings.length - 20} more in etl-report.json`);
}

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 1) + "\n", "utf8");
}

main();
