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
  stageEvent,
  stageMetrics,
} from "@/lib/stage/select";
import {
  SCREEN_CLOSE_MS,
  SCREEN_FAIL_OPEN_MS,
  SCREEN_OPEN_MS,
  initialScreenState,
  screenDuration,
  screenReducer,
} from "@/lib/stage/screen";
import { getStageThemes } from "@/lib/stage/themes";

const CSS = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const homeMarkup = renderToStaticMarkup(<HomePage />);
const componentSource = readFileSync(
  new URL("../app/_components/stage/PoeticStage.tsx", import.meta.url),
  "utf8",
);
const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

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

// ---------------------------------------------------------- opening screen

test("the screen opens, closes around a pending scene, then reopens", () => {
  const closed = initialScreenState(0);
  assert.deepEqual(closed, {
    phase: "closed",
    activeIndex: 0,
    pendingIndex: null,
  });

  const opening = screenReducer(closed, { type: "ENTER" });
  assert.equal(opening.phase, "opening");

  const open = screenReducer(opening, { type: "OPEN_FINISHED" });
  assert.equal(open.phase, "open");

  const closing = screenReducer(open, { type: "SWAP", nextIndex: 2 });
  assert.equal(closing.phase, "closing");
  assert.equal(closing.activeIndex, 0, "the scene must not change before the screen closes");
  assert.equal(closing.pendingIndex, 2);

  const nextOpening = screenReducer(closing, { type: "CLOSE_FINISHED" });
  assert.deepEqual(nextOpening, {
    phase: "opening",
    activeIndex: 2,
    pendingIndex: null,
  });
  assert.equal(screenReducer(nextOpening, { type: "OPEN_FINISHED" }).phase, "open");
});

test("the screen state machine rejects re-entry and invalid swaps", () => {
  const closed = initialScreenState(1);
  assert.equal(screenReducer(closed, { type: "SWAP", nextIndex: 2 }), closed);

  const opening = screenReducer(closed, { type: "ENTER" });
  assert.equal(screenReducer(opening, { type: "ENTER" }), opening);
  assert.equal(screenReducer(opening, { type: "OPEN_FINISHED" }).phase, "open");

  const open = screenReducer(opening, { type: "OPEN_FINISHED" });
  for (const nextIndex of [-1, 1, 1.5, Number.NaN]) {
    assert.equal(screenReducer(open, { type: "SWAP", nextIndex }), open);
  }

  const closing = screenReducer(open, { type: "SWAP", nextIndex: 3 });
  assert.equal(screenReducer(closing, { type: "SWAP", nextIndex: 0 }), closing);
  assert.equal(screenReducer(closing, { type: "OPEN_FINISHED" }), closing);
});

test("a random scene may be drawn behind the screen without opening it", () => {
  const closed = initialScreenState(0);
  assert.deepEqual(screenReducer(closed, { type: "DRAW", nextIndex: 3 }), {
    phase: "closed",
    activeIndex: 3,
    pendingIndex: null,
  });

  const opening = screenReducer(closed, { type: "ENTER" });
  for (const phase of [opening, screenReducer(opening, { type: "OPEN_FINISHED" })]) {
    assert.equal(screenReducer(phase, { type: "DRAW", nextIndex: 2 }), phase);
  }
});

test("the incoming 词 is never on the stage while the screen is still shutting", () => {
  const open = screenReducer(screenReducer(initialScreenState(0), { type: "ENTER" }), {
    type: "OPEN_FINISHED",
  });

  for (let nextIndex = 1; nextIndex < 4; nextIndex++) {
    const closing = screenReducer(open, { type: "SWAP", nextIndex });
    assert.equal(closing.phase, "closing");
    assert.notEqual(closing.activeIndex, closing.pendingIndex);
    assert.equal(closing.activeIndex, open.activeIndex);

    // Only once the leaves are shut does the scene actually change hands, and
    // the stage reopens on it rather than standing open on nothing.
    const reopening = screenReducer(closing, { type: "CLOSE_FINISHED" });
    assert.equal(reopening.phase, "opening");
    assert.equal(reopening.activeIndex, nextIndex);
    assert.equal(reopening.pendingIndex, null);
  }
});

test("a close that has nothing pending cannot swap the stage out from under itself", () => {
  const open = screenReducer(screenReducer(initialScreenState(2), { type: "ENTER" }), {
    type: "OPEN_FINISHED",
  });

  for (const state of [initialScreenState(2), open]) {
    assert.equal(screenReducer(state, { type: "CLOSE_FINISHED" }), state);
  }
});

test("only a swinging phase spends time, and reduced motion spends none", () => {
  assert.equal(screenDuration("opening", false), SCREEN_OPEN_MS);
  assert.equal(screenDuration("closing", false), SCREEN_CLOSE_MS);
  assert.ok(SCREEN_OPEN_MS > 0 && SCREEN_CLOSE_MS > 0);

  // Reduced motion finishes at once — the lifecycle still runs through every
  // state, so nothing can be left stranded mid-swing.
  assert.equal(screenDuration("opening", true), 0);
  assert.equal(screenDuration("closing", true), 0);

  for (const reduced of [true, false]) {
    assert.equal(screenDuration("closed", reduced), 0);
    assert.equal(screenDuration("open", reduced), 0);
  }
});

// ------------------------------------------------------------------ 转

test("the 转 marker is read off the reveal alone, never off the poem being finished", () => {
  for (const theme of getStageThemes()) {
    const { turnIndex } = theme;
    assert.equal(stageEvent(turnIndex - 1, turnIndex), "reading", theme.id);
    assert.equal(stageEvent(turnIndex, turnIndex), "turn", theme.id);
    assert.equal(stageEvent(turnIndex + 1, turnIndex), "turned", theme.id);
    // Whatever else the reading does, it never falls back out of the 转.
    assert.equal(stageEvent(theme.lines.length, turnIndex), "turned", theme.id);
  }
});

test("元夕 and 如梦令 still reach their climax, though their 转 is the last line", () => {
  const themes = getStageThemes();
  const ending = themes.filter((theme) => theme.turnIndex === theme.lines.length - 1);

  // Both close *on* the line the reader is asked to supply. Deriving the 转 from
  // completion would mean supplying it ended the poem instead of turning it, and
  // half the stage would have no climax at all.
  assert.deepEqual(
    ending.map((theme) => theme.id),
    ["lantern", "lotus-dusk"],
  );

  for (const theme of ending) {
    const supplied = theme.turnIndex + 1;
    assert.equal(supplied, theme.lines.length, theme.id);
    assert.equal(stageEvent(supplied, theme.turnIndex), "turned", theme.id);
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
  assert.match(CSS, /\.ci-choices\s*{[^}]*z-index:\s*[1-9]/s);
  assert.match(CSS, /\.ci-choice\s*{[^}]*min-height:\s*1\.5625rem/s);
});

test("each scene carries its own raster artwork and restarts a meaningful motion", () => {
  assert.match(homeMarkup, /class="ci-stage-art"/);
  assert.match(homeMarkup, /class="ci-stage-picture"/);

  for (const scene of SCENES) {
    const artwork = scene.id === "lotus-dusk" ? "lotus-dusk-v2" : scene.id;
    const file = new URL(`../public/stage/${artwork}.webp`, import.meta.url);
    assert.ok(existsSync(file), `missing artwork for ${scene.id}`);
    assert.match(
      CSS,
      new RegExp(`\\.ci-stage\\[data-scene="${scene.id}"\\][\\s\\S]*?--scene-art:\\s*url\\("/stage/${artwork}\\.webp"\\)`),
    );
  }

  assert.match(CSS, /\.ci-stage-picture\s*{[^}]*animation:\s*var\(--art-anim\)/s);
  assert.ok(existsSync(new URL("../public/stage/lotus-dusk-v2.webp", import.meta.url)));
  assert.ok(existsSync(new URL("../public/stage/lotus-birds-v2.webp", import.meta.url)));
  assert.match(CSS, /background-image:\s*url\("\/stage\/lotus-birds-v2\.webp"\)/);
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

  // The screen's measure, the sentence, and the 词作 column all print it, and
  // all three go through <Numeral> — nothing on the page hand-sets a figure.
  assert.equal(homeMarkup.split(`class="ci-numeral">${poems}<`).length - 1, 2);
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
  // … and enhanced commands are absent rather than dead controls.
  assert.doesNotMatch(homeMarkup, /class="ci-control-group"/);
  assert.doesNotMatch(homeMarkup, /<button/);
});

test("the stage is a named region whose enhancement uses real controls and a polite live region", () => {
  assert.match(homeMarkup, /<section[^>]*aria-labelledby="[^"]+"[^>]*class="ci-stage"/);
  assert.match(homeMarkup, /data-scene="cold-cicada"/);
  assert.match(homeMarkup, /data-phase="initial"/);
  assert.match(homeMarkup, /role="status" aria-live="polite"/);

  // The served document has no dead commands. Enhancement mounts native
  // buttons, and the lead changes label with the reading state.
  for (const label of ["重读", "全篇", "换一阕"]) {
    assert.ok(
      componentSource.includes(label),
      `no enhanced control labelled ${label}`,
    );
  }
  assert.match(componentSource, /enhanced && \(\s*<div className="ci-control-group">/s);
  assert.match(componentSource, /asking \? "揭晓" : complete \? "重读" : "续"/);
  assert.match(componentSource, /aria-label={`换一阕，离开\$\{theme\.scene\}`}/);
  assert.equal(componentSource.match(/<button(?![\s\S]*?type="button")/g), null);
});

test("the scripted entry is one real button in front of a decorative four-panel screen", () => {
  assert.match(homeMarkup, /class="ci-screen" aria-hidden="true"/);
  assert.equal(homeMarkup.match(/data-screen-panel="[^"]+"/g)?.length, 4);
  assert.equal(homeMarkup.match(/data-screen-rail="[^"]+"/g)?.length, 2);
  assert.match(homeMarkup, /data-screen="closed"/);
  assert.match(homeMarkup, /data-phase="initial"/);

  // The button is enhanced-only: no-JS and hydration failure never receive a
  // dead full-stage control. Once mounted it is a native button, so Enter and
  // Space need no custom keyboard handler, and it exists only while closed.
  assert.doesNotMatch(homeMarkup, /ci-screen-trigger/);
  assert.match(componentSource, /enhanced && screen\.phase === "closed"/);
  assert.match(componentSource, /<button\s+type="button"\s+className="ci-screen-trigger"/s);
  assert.match(componentSource, /className="ci-screen-enter">\s*入词/s);
  assert.match(
    CSS,
    /\.ci-screen-trigger:focus-visible\s*{[^}]*outline:\s*none[^}]*box-shadow:\s*[^}]*inset/s,
  );
  assert.match(
    componentSource,
    /const enterScene[\s\S]*?stage\.current\?\.focus\(\{ preventScroll: true \}\)/,
  );
});

test("without scripts there is no screen at all, only the poem the server sent", () => {
  // Both the door and the leaves are dark by default and lit only under `.js`,
  // so a reader without scripts is never handed a curtain that will not rise.
  assert.match(CSS, /\.ci-screen\s*{[^}]*display:\s*none/s);
  assert.match(CSS, /\.ci-screen-trigger\s*{[^}]*display:\s*none/s);
  assert.match(CSS, /\.js \.ci-screen\s*{[^}]*display:\s*block/s);
  assert.match(CSS, /\.js \.ci-screen-trigger\s*{[^}]*display:\s*flex/s);

  // And the served document hands the reader a live, complete poem.
  assert.doesNotMatch(homeMarkup, /<div class="ci-veil ci-stage-content" inert/);
  assert.doesNotMatch(homeMarkup, /class="ci-control-group"/);
  for (const line of getStageThemes()[0]!.lines) {
    assert.ok(homeMarkup.includes(line.text), `missing line ${line.text}`);
  }
});

test("the closed face names the collection and never the 词 waiting behind it", () => {
  const start = homeMarkup.indexOf('<div class="ci-screen"');
  const face = homeMarkup.slice(start, homeMarkup.indexOf("</div>", start) + 6);

  assert.ok(face.includes("历代名家词集精华录"), face);
  // The 余韵 is promised on the face itself: the collection's own measure.
  assert.ok(face.includes(formatCount(getSiteStats().poems)), face);
  assert.ok(face.includes(formatCount(getSiteStats().volumes)), face);

  // Nothing of any scene reaches it — not the one drawn, and not the one a
  // 换一阕 has queued up behind the leaves.
  for (const theme of getStageThemes()) {
    for (const secret of [
      theme.scene,
      theme.heading,
      theme.poet,
      theme.dynasty,
      theme.tune,
      theme.volumeTitle,
      theme.title ?? "",
    ]) {
      if (secret === "") continue;
      assert.ok(!face.includes(secret), `the closed screen gives away ${secret}`);
    }
  }

  // The face is drawn in paper and ink alone: a leaf carrying the scene's own
  // colour would say which of the four is behind it before it opened.
  const panel = CSS.slice(CSS.indexOf(".ci-screen-panel {"));
  assert.doesNotMatch(panel.slice(0, panel.indexOf("}")), /--scene-accent|--scene-art/);
});

test("the leaves fold on their own hinges, and the doorway survives the opening", () => {
  // Four hinges, four angles — each leaf carries its own opened transform, so
  // one rule swings them and the reverse of it shuts them again.
  assert.equal(CSS.match(/--panel-open:[^;]*rotateY\(/g)?.length, 4);
  assert.match(
    CSS,
    /\[data-screen="opening"\] \.ci-screen-panel,\s*\.js \.ci-stage\[data-screen="open"\] \.ci-screen-panel\s*{[^}]*transform:\s*var\(--panel-open\)/s,
  );
  // The stage already clips and isolates; asking children for their own 3D
  // contexts would flatten the shared fold. Ignore prose comments here.
  const declarations = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(declarations, /transform-style:\s*preserve-3d/);

  // The rails are what is left of the screen once the leaves have gone. They
  // stay narrower than the page gutter, so they can never reach the controls.
  const rail = CSS.slice(CSS.indexOf(".ci-screen-rail {"));
  assert.match(rail.slice(0, rail.indexOf("}")), /width:\s*var\(--screen-rail\)/);
  assert.match(CSS, /--screen-rail:\s*0\.5rem/);
  assert.match(CSS, /\[data-screen="open"\] \.ci-screen-rail\s*{[^}]*opacity:\s*1/s);

  // The screen itself is never hidden outright — that would take the rails with
  // it — and it never takes a pointer.
  assert.doesNotMatch(CSS, /\.ci-screen\s*{[^}]*visibility:\s*hidden/s);
  assert.match(CSS, /\.js \.ci-screen\s*{[^}]*pointer-events:\s*none/s);
});

test("a screen raised by scripts that never arrive folds away on its own", () => {
  // One shared delay drives the leaves and veil, while the inline bootstrap
  // records animation start so late hydration cannot shut an opening screen.
  assert.equal(SCREEN_FAIL_OPEN_MS, 2400);
  assert.match(layoutSource, /--ci-stage-fail-delay/);
  assert.match(layoutSource, /animationstart/);
  assert.match(layoutSource, /__ciStageFailedOpen=new WeakSet/);
  assert.match(componentSource, /failedStages\?\.has\(stage\.current\)\) return/);
  assert.match(
    CSS,
    /\.js \.ci-stage\[data-phase="initial"\] \.ci-screen-panel\s*{[^}]*animation:\s*ci-screen-failopen[^}]*--ci-stage-fail-delay/s,
  );
  assert.match(CSS, /@keyframes ci-screen-failopen\s*{[^@]*transform:\s*var\(--panel-open\)/);
  assert.match(
    CSS,
    /\.ci-stage\[data-phase="initial"\] \.ci-screen::before\s*{[^}]*animation:\s*ci-screen-recede/s,
  );
  assert.match(
    CSS,
    /\.js \.ci-stage\[data-phase="initial"\] \.ci-veil\s*{[^}]*visibility:\s*hidden[^}]*--ci-stage-fail-delay/s,
  );

  const reduced = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduced, /\.ci-screen-panel/);
  // Reduced motion shortens the fail-open; it must never cancel it, or a reader
  // who has asked for less motion would be the one left behind a shut door.
  assert.match(reduced, /\.ci-screen-enter,/);
  assert.match(reduced, /\.ci-screen::before\s*{[^}]*animation-duration:\s*1ms/s);
  assert.doesNotMatch(reduced, /\.ci-screen-panel[^{]*{[^}]*animation:\s*none/s);
});

test("each scene keeps exactly one climax, hung off the 转 and not off the ending", () => {
  const block = (id: string) => {
    const start = CSS.indexOf(`.ci-stage[data-scene="${id}"] {`);
    assert.ok(start > -1, `no palette block for ${id}`);
    return CSS.slice(start, CSS.indexOf("}", start));
  };

  for (const scene of SCENES) {
    const palette = block(scene.id);
    // Where the climax happens, in the artwork's own frame.
    assert.match(palette, /--event-x:\s*\d+%/, scene.id);
    assert.match(palette, /--event-y:\s*\d+%/, scene.id);
    assert.match(palette, /--event-glow:\s*#[0-9a-f]{6}/, scene.id);

    // And it fires on the 转 — never on the poem simply having finished.
    assert.ok(
      CSS.includes(`[data-event="turned"][data-scene="${scene.id}"]`),
      `no 转 climax for ${scene.id}`,
    );
  }

  assert.doesNotMatch(CSS, /\[data-event="complete"\]/);
  // 贺铸's three depths: grass behind, catkins across, rain in front.
  const plumRain = '[data-event="turned"][data-scene="plum-rain"]';
  assert.ok(CSS.includes(`${plumRain}\n    .ci-scene-atmosphere`), "no 烟草 layer");
  assert.ok(CSS.includes(`${plumRain}\n    .ci-scene-event::before`), "no 风絮 layer");
  assert.ok(CSS.includes(`${plumRain}\n    .ci-scene-event::after`), "no 梅雨 layer");
});

test("the stage opens on the first view and shows the collection under its edge", () => {
  // A floor, not a height: the poem's own reserve still fixes the frame, so all
  // four scenes go on occupying exactly the same space.
  assert.match(CSS, /--stage-floor:\s*calc\(100svh/);
  assert.match(CSS, /min-block-size:\s*min\(var\(--stage-floor\)/);
  assert.doesNotMatch(CSS, /\.ci-stage\s*{[^}]*\bheight:\s*100/s);
  assert.match(homeMarkup, /class="-mt-10"/);
  assert.match(homeMarkup, /class="mt-4 space-y-14 sm:mt-0"/);
  assert.match(CSS, /@media \(max-width: 639px\)[\s\S]*?\.ci-controls,[\s\S]*?flex-wrap:\s*nowrap/);
});

test("a correct continuation hands keyboard focus back to the lead control", () => {
  const choose = componentSource.slice(
    componentSource.indexOf("const choose"),
    componentSource.indexOf("const stanzas"),
  );
  assert.match(choose, /lead\.current\?\.focus\(\{ preventScroll: true \}\)/);
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
