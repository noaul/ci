import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "@/app/page";
import { firstLine, getPoemById, getSiteStats, getAllPoems, getPoets, getTunes, getVolumes } from "@/lib/content";
import { formatCount } from "@/lib/format";
import { displayLines, displayLinesOf } from "@/lib/poem-lines";
import {
  buildContinuationChoices,
  nearestByLength,
  pickEntryIndex,
  pickInitialIndex,
  pickNextIndex,
  scaleIndex,
  shuffle,
  stageMetrics,
} from "@/lib/stage/select";
import { getStageThemes } from "@/lib/stage/themes";

const CSS = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const homeMarkup = renderToStaticMarkup(<HomePage />);

/**
 * `next/link` normalises the trailing slash outside a Next request, while the
 * export writes it back in; match either so the assertion is about the target.
 */
const linkTo = (href: string) => new RegExp(`href="${href.replace(/\/$/, "")}/?"`);

/** The four works the stage is built on, and the headings they are known by. */
const SCENES = [
  { id: "cold-cicada", poemId: "liu-yong/0041-yu-lin-ling", heading: "雨霖铃·寒蝉凄切", poet: "柳永", opening: "寒蝉凄切。" },
  { id: "lantern", poemId: "xin-qiji/0013-qing-yu-an", heading: "青玉案·元夕", poet: "辛弃疾", opening: "东风夜放花千树。" },
  { id: "lotus-dusk", poemId: "li-qingzhao/0001-ru-meng-ling", heading: "如梦令·常记溪亭日暮", poet: "李清照", opening: "常记溪亭日暮，" },
  { id: "plum-rain", poemId: "he-zhu/0085-heng-tang-lu", heading: "青玉案·凌波不过横塘路", poet: "贺铸", opening: "凌波不过横塘路。" },
] as const;

// ---------------------------------------------------------------- corpus

test("the stage is built from the four corpus poems, not from copied text", () => {
  const themes = getStageThemes();

  assert.deepEqual(
    themes.map((theme) => theme.poemId),
    SCENES.map((scene) => scene.poemId),
  );

  for (const [i, scene] of SCENES.entries()) {
    const theme = themes[i]!;
    const poem = getPoemById(scene.poemId);
    assert.ok(poem, scene.poemId);

    assert.equal(theme.id, scene.id);
    assert.equal(theme.poet, scene.poet);
    assert.equal(theme.href, `/poems/${scene.poemId}/`);
    // Every line, in order, is the line the reading pages print.
    assert.deepEqual(theme.lines.map((line) => line.text), displayLinesOf(poem.stanzas));
    assert.equal(theme.lines[0]!.text, scene.opening);
    assert.equal(theme.lines[0]!.text, displayLines(poem.stanzas[0]!)[0]);
    assert.ok(firstLine(poem).startsWith(theme.lines[0]!.text.slice(0, 4)));
  }
});

test("每阕的 起 falls before its 转, and both are real lines of the poem", () => {
  for (const theme of getStageThemes()) {
    assert.ok(theme.pauseIndex >= 0, theme.poemId);
    assert.ok(theme.pauseIndex < theme.turnIndex, theme.poemId);
    assert.ok(theme.turnIndex < theme.lines.length, theme.poemId);
  }

  const turns = Object.fromEntries(getStageThemes().map((t) => [t.id, t.lines[t.turnIndex]!.text]));
  assert.match(turns["cold-cicada"]!, /^今宵酒醒何处/);
  assert.match(turns["lantern"]!, /蓦然回首/);
  assert.match(turns["lotus-dusk"]!, /^惊起一行鸥鹭/);
  assert.match(turns["plum-rain"]!, /^一川烟草/);
});

// ------------------------------------------------------- canonical heading

test("the canonical heading is editorial and never rewrites the corpus metadata", () => {
  const themes = getStageThemes();

  assert.deepEqual(
    themes.map((theme) => theme.heading),
    SCENES.map((scene) => scene.heading),
  );

  // 贺铸's poem is filed under 横塘路 with 青玉案 as its 词题. The heading says
  // 青玉案·凌波不过横塘路; the provenance must keep saying what the volume says.
  const plumRain = themes.find((theme) => theme.id === "plum-rain")!;
  const corpus = getPoemById(plumRain.poemId)!;
  assert.equal(plumRain.tune, "横塘路");
  assert.equal(plumRain.tune, corpus.tune);
  assert.equal(plumRain.title, "青玉案");
  assert.equal(plumRain.title, corpus.title);
  assert.equal(plumRain.tuneHref, "/tunes/heng-tang-lu/");
  assert.doesNotMatch(plumRain.tuneHref ?? "", /qing-yu-an/);

  // 辛弃疾's 青玉案 keeps its own tune route, which 贺铸's heading must not borrow.
  const lantern = themes.find((theme) => theme.id === "lantern")!;
  assert.equal(lantern.tune, "青玉案");
  assert.notEqual(lantern.tuneHref, plumRain.tuneHref);
});

test("the served heading links to the poem and nowhere else", () => {
  const first = getStageThemes()[0]!;
  const heading = homeMarkup.match(/<h2 id="[^"]*" class="ci-stage-title">.*?<\/h2>/s)?.[0] ?? "";

  assert.match(heading, linkTo(first.href));
  assert.ok(heading.includes(first.heading), heading);
  assert.doesNotMatch(heading, /\/tunes\//);
});

test("the editorial remark is marked 余韵 so it cannot pass as corpus text", () => {
  assert.match(homeMarkup, /class="ci-aftertaste-label">余韵</);
  const aftertaste = getStageThemes()[0]!.aftertaste;
  assert.ok(homeMarkup.includes(aftertaste), "aftertaste missing from the served stage");
  // It is our sentence, so it must not be a line of the poem it sits under.
  for (const theme of getStageThemes()) {
    assert.ok(!theme.lines.some((line) => line.text.includes(theme.aftertaste)), theme.poemId);
  }
});

// ------------------------------------------------------------- selection

test("an entry lands inside the scene list for any sample in [0, 1)", () => {
  const samples = [0, 0.0001, 0.24, 0.25, 0.49, 0.5, 0.75, 0.9999, 1, Number.NaN];
  for (const sample of samples) {
    const index = pickInitialIndex(4, sample);
    assert.ok(Number.isInteger(index) && index >= 0 && index < 4, `${sample} → ${index}`);
  }
  assert.equal(scaleIndex(1, 0.9), 0);
  assert.equal(scaleIndex(0, 0.9), 0);
});

test("a switch never repeats the scene the reader is already looking at", () => {
  for (let count = 2; count <= 6; count++) {
    for (let current = 0; current < count; current++) {
      const reached = new Set<number>();
      for (let step = 0; step < 200; step++) {
        const next = pickNextIndex(count, current, step / 200);
        assert.notEqual(next, current, `count=${count} current=${current}`);
        reached.add(next);
      }
      // Every other scene stays reachable — no scene is quietly stranded.
      assert.equal(reached.size, count - 1);
    }
  }
});

test("no run of switches repeats consecutively, whatever the randomness does", () => {
  const randoms = [0, 0.33, 0.34, 0.66, 0.67, 0.99, 0.5, 0.1, 0.9];
  let current = pickInitialIndex(4, 0.8);
  for (const random of [...randoms, ...randoms, ...randoms]) {
    const next = pickNextIndex(4, current, random);
    assert.notEqual(next, current);
    current = next;
  }
});

test("a returning reader never opens on the scene stored from this session", () => {
  for (let previous = 0; previous < 4; previous++) {
    for (const random of [0, 0.24, 0.25, 0.5, 0.75, 0.9999]) {
      assert.notEqual(pickEntryIndex(4, previous, random), previous);
    }
  }

  assert.equal(pickEntryIndex(4, null, 0.75), pickInitialIndex(4, 0.75));
});

test("a switch tolerates an out-of-range current index", () => {
  for (const current of [-1, 4, 99, 1.5, Number.NaN]) {
    const next = pickNextIndex(4, current, 0.5);
    assert.ok(next >= 0 && next < 4, `${current} → ${next}`);
  }
});

// ------------------------------------------------------------ 接下一句

test("接下一句 offers the poem's own line among lines from the other scenes", () => {
  const themes = getStageThemes();
  const answer = themes[0]!.lines[themes[0]!.turnIndex]!.text;
  const pool = themes.slice(1).flatMap((theme) => theme.lines.map((line) => line.text));

  for (const random of [() => 0, () => 0.5, () => 0.99, Math.random]) {
    const choices = buildContinuationChoices(answer, pool, 3, random);
    assert.equal(choices.length, 3);
    assert.equal(choices.filter((choice) => choice === answer).length, 1);
    assert.equal(new Set(choices).size, 3);
    for (const choice of choices) {
      assert.ok(choice === answer || pool.includes(choice), choice);
    }
  }
});

test("接下一句 degrades rather than throws when the pool is thin", () => {
  assert.deepEqual(buildContinuationChoices("甲", [], 3, () => 0), ["甲"]);
  assert.deepEqual(buildContinuationChoices("甲", ["甲", "甲"], 3, () => 0), ["甲"]);
  assert.equal(buildContinuationChoices("甲", ["乙"], 3, () => 0).length, 2);
});

test("decoys are drawn nearest the answer's measure, so length gives nothing away", () => {
  const pool = ["一二三", "一二三四五六七八九十", "一二三四", "一二三四五"];
  assert.deepEqual(nearestByLength("一二三四", pool, 2), ["一二三", "一二三四五"]);
  // Deterministic: the same request twice gives the same order.
  assert.deepEqual(nearestByLength("一二三四", pool, 3), nearestByLength("一二三四", pool, 3));
  assert.ok(!nearestByLength("一二三四", pool, 4).includes("一二三四"));
});

test("shuffling keeps every member exactly once", () => {
  const items = ["甲", "乙", "丙", "丁"];
  for (const random of [() => 0, () => 0.99, Math.random]) {
    assert.deepEqual([...shuffle(items, random)].sort(), [...items].sort());
  }
});

// -------------------------------------------------------------- metrics

test("the stage reserves the tallest scene's measure, so a switch moves nothing", () => {
  const themes = getStageThemes();
  const metrics = stageMetrics(themes);

  assert.equal(metrics.rows, Math.max(...themes.map((theme) => theme.lines.length)));
  assert.equal(metrics.rows, 10);
  assert.equal(metrics.stanzaBreaks, 1);
  assert.match(homeMarkup, /--stage-rows:10/);
  assert.match(homeMarkup, /--stage-breaks:1/);

  // The reserve is held in CSS above the logical line count, with room for the
  // lines that wrap at 320–390px and for the 接下一句 line-up.
  const slack = Number(CSS.match(/--stage-slack:\s*([\d.]+)/)?.[1]);
  assert.ok(slack >= 1 && slack <= 1.25, `--stage-slack is ${slack}`);
  assert.match(CSS, /\.ci-poem\s*{[^}]*min-height:\s*calc\(/);
});

test("each scene carries its own raster artwork and restarts a meaningful motion", () => {
  assert.match(homeMarkup, /class="ci-stage-art"/);
  assert.match(homeMarkup, /class="ci-stage-picture"/);

  for (const scene of SCENES) {
    const file = new URL(`../public/stage/${scene.id}.webp`, import.meta.url);
    assert.ok(existsSync(file), `missing artwork for ${scene.id}`);
    assert.match(
      CSS,
      new RegExp(`\\.ci-stage\\[data-scene="${scene.id}"\\][\\s\\S]*?--scene-art:\\s*url\\("/stage/${scene.id}\\.webp"\\)`),
    );
  }

  assert.match(CSS, /\.ci-stage-picture\s*{[^}]*animation:\s*var\(--art-anim\)/s);
  assert.doesNotMatch(homeMarkup, /<svg/i);
});

test("the home heading stays semantic without spending a blank visual band", () => {
  assert.match(homeMarkup, /<h1 class="sr-only">历代名家词集精华录<\/h1>/);
});

// ------------------------------------------------------- counts and type

test("counts come from one live source and one formatter", () => {
  const stats = getSiteStats();

  assert.equal(stats.poems, getAllPoems().length);
  assert.equal(stats.poets, getPoets().length);
  assert.equal(stats.volumes, getVolumes().length);
  assert.equal(stats.tunes, getTunes().filter((tune) => tune.poemCount > 0).length);
  assert.equal(
    stats.annotations,
    getAllPoems().reduce((n, poem) => n + poem.notes.length + poem.commentary.length, 0),
  );

  assert.equal(formatCount(3508), "3,508");
  assert.equal(formatCount(22), "22");
  assert.equal(formatCount(0), "0");
});

test("the inline count and the column below it are the same number, set the same way", () => {
  const stats = getSiteStats();
  const poems = formatCount(stats.poems);

  // The sentence and the 词作 column both print it, both through <Numeral>.
  assert.equal(homeMarkup.split(`class="ci-numeral">${poems}<`).length - 1, 1);
  assert.ok(homeMarkup.includes(`class="ci-numeral ci-numeral-tabular">${poems}<`));
  assert.ok(homeMarkup.includes(`class="ci-numeral ci-numeral-tabular">${formatCount(stats.poets)}<`));
  assert.ok(homeMarkup.includes(`class="ci-numeral ci-numeral-tabular">${formatCount(stats.volumes)}<`));
  assert.doesNotMatch(homeMarkup, /3\.508|3 508/);
});

test("the four columns are equal and share one label and value axis", () => {
  assert.equal(homeMarkup.match(/class="ci-stat"/g)?.length, 4);
  assert.equal(homeMarkup.match(/class="ci-stat-label"/g)?.length, 4);
  assert.equal(homeMarkup.match(/class="ci-stat-value"/g)?.length, 4);

  assert.match(CSS, /\.ci-stats\s*{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(CSS, /\.ci-stat\s*{[^}]*grid-template-rows:\s*subgrid/);
  // A count carries no type of its own, so it cannot break the line it sits on.
  assert.doesNotMatch(CSS, /\.ci-numeral\s*{[^}]*font-(size|family|weight)/);
  assert.match(CSS, /\.ci-numeral\s*{[^}]*font-variant-numeric:\s*lining-nums/);
  assert.match(CSS, /\.ci-numeral-tabular\s*{[^}]*tabular-nums/);
});

test("no type scales with the viewport, and nothing is letterspaced", () => {
  for (const [, value] of CSS.matchAll(/font-size:([^;]+);/g)) {
    assert.doesNotMatch(value!, /vw/, `viewport-scaled font-size: ${value!.trim()}`);
    assert.doesNotMatch(value!, /clamp\(/, `fluid font-size: ${value!.trim()}`);
  }
  for (const [, value] of CSS.matchAll(/letter-spacing:([^;]+);/g)) {
    assert.equal(value!.trim(), "0", `letter-spacing must be 0, found ${value!.trim()}`);
  }
  // Responsive type is stepped at breakpoints instead.
  assert.match(CSS, /@media \(min-width: 390px\)\s*{\s*\.ci-poem/);
  assert.match(CSS, /@media \(min-width: 640px\)/);
});

test("motion is opt-out and the reveal still works without it", () => {
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)/);
  const reduced = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduced, /animation-name:\s*ci-plain/);
  assert.match(reduced, /animation-delay:\s*0ms/);
});

// -------------------------------------------------- served accessibility

test("the served stage is a complete, readable poem before any script runs", () => {
  const first = getStageThemes()[0]!;

  for (const line of first.lines) {
    assert.ok(homeMarkup.includes(line.text), `missing line ${line.text}`);
  }
  // Nothing is hidden from assistive technology in the served state …
  assert.doesNotMatch(homeMarkup, /aria-hidden="true"[^>]*>寒蝉凄切/);
  // … and 全篇 is genuinely unavailable, not a live control that does nothing.
  assert.match(homeMarkup, /<button[^>]*disabled=""[^>]*>全篇<\/button>/);
  assert.doesNotMatch(homeMarkup, /aria-disabled/);
});

test("the stage is a named region with real controls and a polite live region", () => {
  assert.match(homeMarkup, /<section[^>]*aria-labelledby="[^"]+"[^>]*class="ci-stage"/);
  assert.match(homeMarkup, /data-scene="cold-cicada"/);
  assert.match(homeMarkup, /data-phase="initial"/);
  assert.match(homeMarkup, /role="status" aria-live="polite"/);

  // Served whole, the lead control offers 重读 — 续 and 揭晓 are the labels it
  // takes once a scene has been drawn and the poem is standing part-open.
  for (const label of ["重读", "全篇", "换一阕"]) {
    assert.ok(
      homeMarkup.includes(`>${label}</button>`),
      `no control labelled ${label} in the served stage`,
    );
  }
  const component = readFileSync(
    new URL("../app/_components/stage/PoeticStage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(component, /asking \? "揭晓" : complete \? "重读" : "续"/);
  assert.match(homeMarkup, /aria-label="换一阕，离开[^"]+"/);
  assert.equal(homeMarkup.match(/<button(?![^>]*type="button")/g), null);
});

test("a correct continuation hands keyboard focus back to the lead control", () => {
  const component = readFileSync(
    new URL("../app/_components/stage/PoeticStage.tsx", import.meta.url),
    "utf8",
  );
  const choose = component.slice(component.indexOf("const choose"), component.indexOf("// Tapping"));
  assert.match(choose, /lead\.current\?\.focus\(\)/);
});

test("the home page keeps every way into the book one link away", () => {
  for (const href of [
    "/poets/",
    "/tunes/",
    "/books/",
    "/volumes/",
    "/first-lines/",
    "/about/",
    getStageThemes()[0]!.href,
  ]) {
    assert.match(homeMarkup, linkTo(href), `no link to ${href}`);
  }
  // Annotation stays secondary: routed to the poem page, or folded away.
  assert.match(homeMarkup, /<details class="ci-provenance"/);
  assert.match(homeMarkup, /注释与辑评/);
});

test("the reader is not taught the interface in prose", () => {
  for (const tutorial of ["点击", "单击", "轻触", "请按", "提示：", "如何使用"]) {
    assert.ok(!homeMarkup.includes(tutorial), `tutorial prose on the home page: ${tutorial}`);
  }
});
