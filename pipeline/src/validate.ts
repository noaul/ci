import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { CihuaEntry } from "./profiles/cihua.js";
import { type BaixiangEntry, type GelvEntry, TONE_MARKS, baixiangCharCount } from "./profiles/cipu.js";
import { IMAGE_TOKEN_RE } from "./text.js";
import type { Poem, Volume } from "./types.js";

const OUT_DIR = "content";

/**
 * Per-volume poem counts, cross-checked against a raw count of <h2> headings in
 * the EPUB. These are regression anchors: a parser change that silently drops
 * or invents poems will trip here rather than reaching the site.
 */
const EXPECTED_COUNTS: Record<string, number> = {
  "wen-wei": 126, "li-yu": 155, "liu-yong": 217, "er-yan": 398, "ouyang-xiu": 241,
  "su-shi": 344, "huang-tingjian": 188, "qin-guan": 96, "he-zhu": 284,
  "zhou-bangyan": 187, "li-qingzhao": 66, "lu-you": 145, "jiang-kui": 84,
  "xin-qiji": 629, "nalan": 348,
};

const failures: string[] = [];
const notes: string[] = [];

function check(ok: boolean, message: string): void {
  if (!ok) failures.push(message);
}

const volumes: Volume[] = readJson("volumes.json");
const poems: Poem[] = volumes
  .filter((v) => v.poemCount > 0)
  .flatMap((v) => readJson(join("poems", `${v.id}.json`)) as Poem[]);

// ---- counts -----------------------------------------------------------------
check(
  poems.length >= 3300 && poems.length <= 3600,
  `poem count ${poems.length} outside expected 3300–3600`,
);
for (const [id, expected] of Object.entries(EXPECTED_COUNTS)) {
  const actual = volumes.find((v) => v.id === id)?.poemCount ?? 0;
  check(actual === expected, `volume ${id}: expected ${expected} poems, got ${actual}`);
}

// ---- structural integrity ---------------------------------------------------
const MARKER_LEAK = /[◎◆]|【注释】/;
let emptyStanzas = 0;
let emptyTune = 0;
let leaked = 0;
let unresolvedRepeat = 0;

for (const p of poems) {
  if (p.stanzas.length === 0 || p.stanzas.every((s) => s.every((l) => !l.trim()))) {
    emptyStanzas++;
    if (emptyStanzas <= 3) notes.push(`  empty stanzas: ${p.id} [${p.sourceFile}]`);
  }
  if (!p.tune.trim()) emptyTune++;
  if (p.tune === "又") {
    unresolvedRepeat++;
    notes.push(`  unresolved 又: ${p.id} [${p.sourceFile}]`);
  }
  for (const stanza of p.stanzas) {
    for (const line of stanza) {
      if (MARKER_LEAK.test(line)) {
        leaked++;
        if (leaked <= 5) notes.push(`  marker leaked into body: ${p.id} — ${line.slice(0, 40)}`);
      }
    }
  }
}

check(emptyStanzas === 0, `${emptyStanzas} poems have no body text`);
check(emptyTune === 0, `${emptyTune} poems have an empty 词牌`);
check(leaked === 0, `${leaked} stanza lines contain an annotation marker`);
check(unresolvedRepeat === 0, `${unresolvedRepeat} poems still carry the placeholder tune 又`);

// ---- annotation attribution -------------------------------------------------
// Annotations are either quoted material with a 出处, or an editorial gloss the
// volume's own editor wrote (no external source by nature). Both count as
// correctly parsed; what would signal a broken splitter is a note that still
// carries an unextracted trailing citation.
const annotations = poems.flatMap((p) => [...p.notes, ...p.commentary]);
const attributed = annotations.filter((a) => a.source).length;
const glossed = annotations.filter((a) => !a.source && a.headword).length;
const accounted = (attributed + glossed) / annotations.length;
const rate = attributed / annotations.length;

const missedCitations = annotations.filter((a) => !a.source && /（[^（）]{1,60}）$/.test(a.text));
check(
  missedCitations.length === 0,
  `${missedCitations.length} annotations still end in an unextracted （出处）`,
);
missedCitations.slice(0, 5).forEach((a) => notes.push(`  missed citation: …${a.text.slice(-40)}`));
check(
  accounted >= 0.9,
  `only ${(accounted * 100).toFixed(1)}% of ${annotations.length} annotations are either sourced or a gloss (want ≥90%)`,
);

// ---- rare-character tokens --------------------------------------------------
const tokens = new Set<string>();
for (const file of jsonFiles(OUT_DIR)) {
  const haystack = readFileSync(file, "utf8");
  for (const m of haystack.matchAll(IMAGE_TOKEN_RE)) tokens.add(m[1]!);
}
const unsafeTokens = [...tokens].filter((file) => !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(file));
check(unsafeTokens.length === 0, `unsafe rare-character filenames: ${unsafeTokens.join(", ")}`);
const missingGlyphs = [...tokens].filter((file) => !existsSync(join("public", "glyphs", file)));
if (missingGlyphs.length > 0) {
  notes.push(`  ${missingGlyphs.length} rare-character assets unavailable; site renders □ fallbacks`);
}

// ---- golden files -----------------------------------------------------------
type Golden = {
  label: string;
  find: (p: Poem) => boolean;
  expect: Partial<{
    tune: string; title: string | null; notes: number; commentary: number;
    stanzaCount: number; prefaceStartsWith: string; firstLineStartsWith: string;
    firstNoteSource: string;
  }>;
};

const GOLDEN: Golden[] = [
  {
    label: "温庭筠 菩萨蛮 小山重叠金明灭",
    find: (p) => p.poetId === "wen-tingyun" && !!p.stanzas[0]?.[0]?.startsWith("小山重叠"),
    expect: { tune: "菩萨蛮", notes: 2, commentary: 20, stanzaCount: 2, firstNoteSource: "浦江清《词的讲解》" },
  },
  {
    label: "苏轼 行香子 丹阳寄述古",
    find: (p) => p.poetId === "su-shi" && p.title === "丹阳寄述古",
    expect: { tune: "行香子", notes: 4, commentary: 1, stanzaCount: 2, firstLineStartsWith: "携手江村" },
  },
  {
    label: "辛弃疾 摸鱼儿 (小序)",
    find: (p) => p.poetId === "xin-qiji" && p.tune === "摸鱼儿" && !!p.preface?.startsWith("淳熙己亥"),
    expect: { tune: "摸鱼儿", notes: 1, commentary: 3, stanzaCount: 2, prefaceStartsWith: "淳熙己亥，自湖北漕移湖南" },
  },
  {
    label: "李清照 声声慢 (line-per-paragraph layout)",
    find: (p) => p.poetId === "li-qingzhao" && p.tune === "声声慢",
    expect: { tune: "声声慢", stanzaCount: 2, firstLineStartsWith: "寻寻觅觅" },
  },
  {
    label: "陆游 断句 (single-line fragment)",
    find: (p) => p.poetId === "lu-you" && p.tune === "断句",
    expect: { stanzaCount: 1, commentary: 1, firstLineStartsWith: "飞上锦裀红绉" },
  },
];

for (const g of GOLDEN) {
  const matches = poems.filter(g.find);
  if (matches.length !== 1) {
    failures.push(`golden "${g.label}": expected exactly 1 match, found ${matches.length}`);
    continue;
  }
  const p = matches[0]!;
  const e = g.expect;
  const fail = (msg: string) => failures.push(`golden "${g.label}": ${msg}`);
  if (e.tune !== undefined && p.tune !== e.tune) fail(`tune ${p.tune} ≠ ${e.tune}`);
  if (e.title !== undefined && p.title !== e.title) fail(`title ${p.title} ≠ ${e.title}`);
  if (e.notes !== undefined && p.notes.length !== e.notes) fail(`notes ${p.notes.length} ≠ ${e.notes}`);
  if (e.commentary !== undefined && p.commentary.length !== e.commentary) {
    fail(`commentary ${p.commentary.length} ≠ ${e.commentary}`);
  }
  if (e.stanzaCount !== undefined && p.stanzas.length !== e.stanzaCount) {
    fail(`stanzas ${p.stanzas.length} ≠ ${e.stanzaCount}`);
  }
  if (e.prefaceStartsWith && !p.preface?.startsWith(e.prefaceStartsWith)) {
    fail(`preface does not start with ${e.prefaceStartsWith}`);
  }
  if (e.firstLineStartsWith && !p.stanzas[0]?.[0]?.startsWith(e.firstLineStartsWith)) {
    fail(`first line does not start with ${e.firstLineStartsWith}`);
  }
  if (e.firstNoteSource && p.notes[0]?.source !== e.firstNoteSource) {
    fail(`first note source ${p.notes[0]?.source} ≠ ${e.firstNoteSource}`);
  }
}

// ---- 词谱 volumes -----------------------------------------------------------
const gelv: GelvEntry[] = readJson(join("cipu", "tang-song-ci-ge-lv.json"));
const baixiang: BaixiangEntry[] = readJson(join("cipu", "bai-xiang-ci-pu.json"));

check(gelv.length === 153, `唐宋词格律: expected 153 tune entries, got ${gelv.length}`);
check(baixiang.length === 100, `白香词谱: expected 100 entries, got ${baixiang.length}`);
check(
  gelv.every((g) => g.patterns.some((p) => p.tones)),
  `${gelv.filter((g) => !g.patterns.some((p) => p.tones)).length} 唐宋词格律 entries have no tone template`,
);
check(
  gelv.every((g) => g.patterns.some((p) => p.examples.some((e) => e.text))),
  `${gelv.filter((g) => !g.patterns.some((p) => p.examples.some((e) => e.text))).length} 唐宋词格律 entries have no example poem`,
);

// Every character of a 白香词谱 poem must carry a tone mark; only punctuation
// may be untoned. An untoned 漢字 means prose leaked into the ruby run.
const HAN_CHAR = /[一-鿿]/;
const allChars = (b: BaixiangEntry) => b.variants.flatMap((v) => v.stanzas.flat());
const untoned = baixiang.filter((b) => allChars(b).some((c) => !c.tone && HAN_CHAR.test(c.ch)));
check(untoned.length === 0, `${untoned.length} 白香词谱 entries contain untoned characters: ${untoned.map((b) => b.name).join(", ")}`);

const KNOWN_TONES = new Set(TONE_MARKS as readonly string[]);
const strayTones = new Set<string>();
for (const b of baixiang) for (const c of allChars(b)) if (c.tone && !KNOWN_TONES.has(c.tone)) strayTones.add(c.tone);
check(strayTones.size === 0, `unknown tone marks in 白香词谱: ${[...strayTones].join(" ")}`);
check(
  baixiang.filter((b) => b.analysis).length === baixiang.length,
  `${baixiang.filter((b) => !b.analysis).length} 白香词谱 entries lost their 【评析】`,
);

// The ruby is inverted — <rb> holds the tone mark and <rt> the character. If a
// refactor ever swaps them, this reads back as gibberish.
const yijiangnan = baixiang.find((b) => b.name === "忆江南");
if (!yijiangnan) failures.push("golden 白香词谱 忆江南: not found");
else {
  const main = yijiangnan.variants[0];
  check(
    !!main?.text.startsWith("多少恨，昨夜梦魂中。"),
    `golden 忆江南: text reads "${main?.text.slice(0, 12)}…" — rb/rt inversion may be backwards`,
  );
  check(
    !!main?.tones.startsWith("平●仄●仄仄平◎"),
    `golden 忆江南: tones read "${main?.tones.slice(0, 8)}…"`,
  );
  check(yijiangnan.title === "怀旧", `golden 忆江南: title ${yijiangnan.title} ≠ 怀旧`);
  check(yijiangnan.notes.length === 3, `golden 忆江南: ${yijiangnan.notes.length} notes ≠ 3`);
  check(main?.author === "〔南唐〕李煜", `golden 忆江南: author ${main?.author}`);
}

// 声声慢 carries two alternate 体 after its main example — the case that
// exposed variants being concatenated into one poem.
const shengsheng = baixiang.find((b) => b.name === "声声慢");
check(
  shengsheng?.variants.length === 3,
  `golden 声声慢: expected 3 variants (main + 平韵格 + 仄韵格), got ${shengsheng?.variants.length}`,
);
check(
  baixiangCharCount(shengsheng!) === 97,
  `golden 声声慢: main example has ${baixiangCharCount(shengsheng!)} characters, expected 97`,
);

const shiliuzi = gelv.find((g) => g.name === "十六字令");
if (!shiliuzi) failures.push("golden 唐宋词格律 十六字令: not found");
else {
  check(
    shiliuzi.aliases.join(",") === "苍梧谣,归字谣",
    `golden 十六字令: aliases [${shiliuzi.aliases.join(",")}]`,
  );
  const ex = shiliuzi.patterns[0]?.examples[0];
  check(ex?.text === "天！休使圆蟾照客眠。人何在？桂影自婵娟。", `golden 十六字令: example text "${ex?.text}"`);
  check(ex?.author === "蔡伸", `golden 十六字令: example author ${ex?.author}`);
  check(
    ex?.rhymeIndexes.join(",") === "0,8,18",
    `golden 十六字令: rhyme positions [${ex?.rhymeIndexes.join(",")}]`,
  );
}

// ---- 词话 volumes -----------------------------------------------------------
const CIHUA_COUNTS: Record<string, number> = {
  "ren-jian-ci-hua": 183, "bai-yu-zhai-ci-hua": 739, "ci-pin": 324,
  "ci-shi": 13, "ci-xue-tong-lun": 17,
};

const cihua = readdirSync(join(OUT_DIR, "cihua"))
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => readJson<CihuaEntry[]>(join("cihua", f)));

for (const [id, expected] of Object.entries(CIHUA_COUNTS)) {
  const actual = cihua.filter((e) => e.volumeId === id).length;
  check(actual === expected, `词话 ${id}: expected ${expected} entries, got ${actual}`);
}

const emptyEntries = cihua.filter(
  (e) => e.paragraphs.length === 0 && e.quotes.length === 0 && !e.heading,
);
check(emptyEntries.length === 0, `${emptyEntries.length} 词话 entries have no content`);

const quotes = cihua.flatMap((e) => e.quotes);
const linkedQuotes = quotes.filter((q) => q.poemId);
check(
  linkedQuotes.every((q) => poems.some((p) => p.id === q.poemId)),
  "some 词话 quotes point at a poem id that does not exist",
);

// 人间词话's opening entry quotes 欧阳修《蝶恋花》, which the book also prints
// under 冯延巳《鹊踏枝》 — the link must survive that ambiguity.
const first = cihua.find((e) => e.volumeId === "ren-jian-ci-hua" && e.ordinal === "壹");
if (!first) failures.push("golden 人间词话【壹】: not found");
else {
  check(
    first.paragraphs[0]?.startsWith("词以境界为最上") === true,
    `golden 人间词话【壹】: text reads "${first.paragraphs[0]?.slice(0, 12)}…"`,
  );
  const quote = first.quotes[0];
  check(quote?.title === "蝶恋花", `golden 人间词话【壹】: quote title ${quote?.title}`);
  check(
    quote?.poemId?.startsWith("ouyang-xiu/") === true,
    `golden 人间词话【壹】: 蝶恋花 quote resolved to ${quote?.poemId} (expected an 欧阳修 poem)`,
  );
  check(first.footnotes.length === 1, `golden 人间词话【壹】: ${first.footnotes.length} footnotes ≠ 1`);
}

// ---- 又 resolution ----------------------------------------------------------
const ouyang: Poem[] = readJson(join("poems", "ouyang-xiu.json"));
const repeats = ouyang.filter((p) => p.tuneRepeated);
check(repeats.length > 0, "欧阳修 volume has no 又 entries — resolution probably misfired");
check(
  repeats.every((p) => p.tune !== "又"),
  "some 又 entries in 欧阳修 were left unresolved",
);

// ---- report -----------------------------------------------------------------
console.log(`poems            ${poems.length}`);
console.log(
  `annotations      ${annotations.length} — ${attributed} sourced (${(rate * 100).toFixed(1)}%), ` +
    `${glossed} editorial glosses, ${annotations.length - attributed - glossed} unclassified`,
);
console.log(`repeated tunes   ${poems.filter((p) => p.tuneRepeated).length} resolved from 又`);
console.log(`distinct tunes   ${new Set(poems.map((p) => p.tune)).size}`);
console.log(`词谱             ${gelv.length} 唐宋词格律 + ${baixiang.length} 白香词谱 entries`);
console.log(
  `词话             ${cihua.length} entries — ${linkedQuotes.length}/${quotes.length} quotes linked to poems`,
);
console.log(
  `rare-char images ${tokens.size} referenced — ${tokens.size - missingGlyphs.length} assets, ` +
    `${missingGlyphs.length} fallbacks`,
);
for (const n of notes) console.log(n);

if (failures.length) {
  console.error(`\nFAILED ${failures.length} check(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("\nAll checks passed.");

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(OUT_DIR, rel), "utf8")) as T;
}

function jsonFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return jsonFiles(path);
    return entry.isFile() && entry.name.endsWith(".json") ? [path] : [];
  });
}
