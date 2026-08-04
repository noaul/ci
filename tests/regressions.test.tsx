import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { load } from "cheerio";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RareText } from "@/app/_components/RareText";
import { PoeticJourney } from "@/app/_components/journey/PoeticJourney";
import { ThresholdScreen } from "@/app/_components/journey/ThresholdScreen";
import VolumesPage from "@/app/volumes/page";
import { charCount } from "@/lib/content";
import { hasHan } from "@/pipeline/src/text";
import type { Poem } from "@/pipeline/src/types";
import { getStageThemes } from "@/lib/stage/themes";
import { pinyinInitial } from "@/pipeline/src/volumes";

test("missing rare-character assets render a text fallback instead of a broken image", () => {
  const html = renderToStaticMarkup(<RareText>{"甲{{IMG:missing-for-test.jpeg}}乙"}</RareText>);

  assert.doesNotMatch(html, /<img/);
  assert.match(html, /data-missing-glyph="missing-for-test\.jpeg"/);
  assert.match(html, />□</);
});

test("available rare-character assets reserve intrinsic space", () => {
  const html = renderToStaticMarkup(<RareText>{"{{IMG:00004.jpeg}}"}</RareText>);

  assert.match(html, /<img/);
  assert.match(html, /width="24"/);
  assert.match(html, /height="24"/);
  assert.match(html, /loading="lazy"/);
});

test("poem character counts include image-backed rare characters", () => {
  const poem = {
    stanzas: [["春㐀{{IMG:00004.jpeg}}水。"]],
  } as Poem;

  assert.equal(charCount(poem), 4);
});

test("an image-backed opening character stays in the fallback initial group", () => {
  assert.equal(pinyinInitial("{{IMG:00004.jpeg}}春水"), "#");
});

test("Han detection is stable across repeated calls", () => {
  assert.equal(hasHan("汉"), true);
  assert.equal(hasHan("汉"), true);
});

test("the volume index links collections and critical works to useful destinations", () => {
  const html = renderToStaticMarkup(<VolumesPage />);

  assert.match(html, /href="\/volumes\/wen-wei\/?"/);
  assert.match(html, /href="\/books\/ci-pin\/?"/);
});

test("the root layout exposes a keyboard skip link and main landmark target", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../app/_components/SiteShell.tsx", import.meta.url), "utf8");
  const journey = readFileSync(
    new URL("../app/_components/journey/PoeticJourney.tsx", import.meta.url),
    "utf8",
  );

  assert.match(layout, /href="#main-content"/);
  assert.match(`${shell}\n${journey}`, /<main[\s\S]*?id="main-content"/);
});

test("the enhancement bootstrap is managed before hydration instead of rendered as a raw script", () => {
  const source = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(source, /<Script[\s\S]*?strategy="beforeInteractive"/);
  assert.doesNotMatch(source, /<script\s+dangerouslySetInnerHTML/);
});

test("long mobile poems can grow the stage while an open drawer locks the page", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const stage = css.match(/(?:^|\n)\s*\.ci-stage\s*\{([^}]*)\}/s)?.[1];

  assert.ok(stage);
  assert.match(css, /html\[data-drawer-open\]\s*{[^}]*overflow:\s*hidden/s);
  assert.match(stage, /min-block-size:\s*100dvh/);
  assert.match(stage, /overflow:\s*visible/);
  assert.doesNotMatch(
    stage,
    /(?:^|;)\s*(?:height|block-size|max-height|max-block-size)\s*:/,
  );
  assert.match(css, /\.js \.ci-stage\s*{[^}]*align-content:\s*safe center/s);
  assert.match(
    css,
    /\.js \.ci-journey\[data-kind="corpus"\] \.ci-stage\s*,[\s\S]*?\.js \.ci-journey\[data-event="turned"\] \.ci-stage\s*\{[^}]*align-content:\s*start/s,
  );
  assert.match(css, /\.ci-drawer\[open\] \.ci-drawer-trigger\s*{[^}]*position:\s*fixed/s);
});

test("the immersive journey reaches every viewport edge without permanent black rails", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const stage = css.match(/(?:^|\n)\s*\.ci-stage\s*\{([^}]*)\}/s)?.[1];
  const html = renderToStaticMarkup(<ThresholdScreen />);

  assert.ok(stage);
  assert.match(stage, /inline-size:\s*100%/);
  assert.doesNotMatch(stage, /\bborder-inline(?:-(?:start|end))?\s*:/);
  assert.match(
    css,
    /\.ci-screen-leaf\[data-leaf="outer-left"\] \.ci-leaf-face\s*{[^}]*border-inline-start:\s*0/s,
  );
  assert.match(
    css,
    /\.ci-screen-leaf\[data-leaf="outer-right"\] \.ci-leaf-face\s*{[^}]*border-inline-end:\s*0/s,
  );
  assert.doesNotMatch(html, /ci-screen-rail|data-rail=/);
  assert.doesNotMatch(css, /\.ci-screen-rail\b/);
});

test("full poems use a distinct title and an unhurried reading rhythm", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.ci-stage\s*{[^}]*--stage-leading:\s*1\.95/s);
  assert.match(css, /\.ci-stage\s*{[^}]*--stage-stanza-gap:\s*1\.25em/s);
  assert.match(css, /\.ci-scene-title\s*{[^}]*font-family:\s*var\(--font-song\)/s);
  assert.match(css, /\.ci-scene-title\s*{[^}]*font-weight:\s*600/s);
  assert.match(css, /\.ci-scene-title::after\s*{[^}]*background-color:\s*var\(--scene-accent\)/s);
});

test("the living atmosphere is decorative and becomes still for reduced motion", () => {
  const journey = readFileSync(
    new URL("../app/_components/journey/PoeticJourney.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const html = renderToStaticMarkup(
    <PoeticJourney themes={getStageThemes()}>
      <p>fallback</p>
    </PoeticJourney>,
  );
  const $ = load(html);
  const ink = $(".ci-living-ink");
  const livingRules = [...css.matchAll(/([^{}]*\.ci-living-ink[^{}]*)\{([^}]*)\}/g)]
    .map((match) => match[2])
    .join("\n");

  assert.equal(ink.length, 1);
  assert.equal(ink.attr("aria-hidden"), "true");
  assert.equal(ink.find("a, button, input, select, textarea, [tabindex]").length, 0);
  assert.match(journey, /key=\{`ink-\$\{scene\.key\}`\}/);
  assert.match(css, /\.ci-living-ink\s*\{[^}]*pointer-events:\s*none/s);
  assert.doesNotMatch(livingRules, /\binfinite\b/);
  assert.ok(
    css.lastIndexOf(
      '.ci-journey:not([data-phase="threshold"]) .ci-living-ink::before,',
    ) > css.lastIndexOf('.ci-journey[data-scene="plum-rain"] .ci-living-ink::after'),
    "the running state must follow animation shorthands so they do not stay paused",
  );
  assert.match(css, /\.ci-journey\[data-kind="corpus"\] \.ci-living-ink::before/);
  for (const scene of ["cold-cicada", "lantern", "lotus-dusk", "plum-rain"]) {
    assert.match(css, new RegExp(`data-scene="${scene}"\\] \\.ci-living-ink`));
  }
  assert.match(
    css,
    /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.ci-living-ink,[\s\S]*?\.ci-living-ink::before,[\s\S]*?\.ci-living-ink::after\s*{[^}]*animation:\s*none;[^}]*transition:\s*none/s,
  );
});
