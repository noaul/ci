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
  assert.doesNotMatch(html, /ci-screen-rail|data-rail=/);
  assert.doesNotMatch(css, /\.ci-screen-rail\b/);
});

/**
 * 屏风 — a structural reading of the opening screen. These tests read the
 * stylesheet and the markup, because what a reader reported — a black stripe
 * down the middle, a landscape drawn tall and thin — is a property of the
 * declarations, not of any one moment of the animation. Whether a pixel is ever
 * black at any frame is a rendering question, settled by the browser
 * screenshots and pixel sampling that release QA runs outside this file. These
 * tests neither perform that pass nor stand in for it; they read source only.
 */

const stylesheet = (): string =>
  readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

/** Every declaration block written for exactly `selector`, in source order. */
const rulesFor = (css: string, selector: string): string[] => {
  const escaped = selector.replace(/[.[\]()"*+?^$|\\]/g, "\\$&");
  const bodies = [...css.matchAll(new RegExp(`(?:^|[\\n,])\\s*${escaped}\\s*\\{([^{}]*)\\}`, "gs"))]
    .map((match) => match[1]);
  assert.ok(bodies.length > 0, `the stylesheet must still declare ${selector}`);
  return bodies;
};

/** A declaration block written for exactly `selector`, taken at its own brace. */
const ruleFor = (css: string, selector: string): string => rulesFor(css, selector)[0];

/**
 * The body of exactly `@keyframes name`, taken at its own closing brace, so a
 * check for one frame can never read a frame belonging to a later animation.
 */
const keyframesFor = (css: string, name: string): string => {
  const start = css.search(new RegExp(`@keyframes\\s+${name}\\s*\\{`));
  assert.ok(start >= 0, `the stylesheet must still declare @keyframes ${name}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}" && (depth -= 1) === 0) return css.slice(open + 1, i);
  }
  throw new Error(`@keyframes ${name} is never closed`);
};

test("the screen parts in two, each panel hung on its own wall and leaving through it", () => {
  const css = stylesheet();
  const $ = load(renderToStaticMarkup(<ThresholdScreen />));

  assert.equal($(".ci-screen-curtain").length, 2, "the screen parts in two");
  assert.equal($('.ci-screen-curtain[data-side="left"]').length, 1);
  assert.equal($('.ci-screen-curtain[data-side="right"]').length, 1);
  assert.equal(
    $(".ci-screen > *").first().attr("class"),
    "ci-screen-glow",
    "the light is drawn before the panels, so it lies over the uncovered scene and under them",
  );
  // Not just the base rule: a later dark-scheme or reduced-motion block written
  // for the same selector would paint the surface back in, over the poem.
  const screens = rulesFor(css, ".js .ci-screen");
  assert.ok(
    screens.some((rule) => /background-color:\s*transparent/.test(rule)),
    "the screen has no surface of its own; the poem behind it is what the parting reveals",
  );
  for (const rule of screens) {
    for (const [, value] of rule.matchAll(/background(?:-color|-image)?:\s*([^;}]+)/g)) {
      assert.ok(
        /^(?:transparent|none)$/.test(value.trim()),
        `no rule for the screen may give it a surface, and one writes ${value.trim()}`,
      );
    }
  }

  for (const [side, wall, away] of [
    ["left", "inset-inline-start", "-100%"],
    ["right", "inset-inline-end", "100%"],
  ] as const) {
    const panel = ruleFor(css, `.ci-screen-curtain[data-side="${side}"]`);
    assert.match(panel, new RegExp(`${wall}:\\s*0`), `the ${side} panel hangs on the ${side} wall`);
    assert.match(
      css,
      new RegExp(
        `\\.ci-screen-curtain\\[data-side="${side}"\\]\\s*\\{[^{}]*animation:\\s*ci-curtain-open-${side}\\b[^;]*\\b(?:both|forwards)\\b`,
        "s",
      ),
      `the ${side} panel's exit is attached to it and holds where it ends; without a forwards fill it snaps back over the poem`,
    );
    const frames = keyframesFor(css, `ci-curtain-open-${side}`);
    assert.match(
      frames,
      /0%\s*\{[^}]*transform:\s*translateX\(0\)\s*[;}]/,
      `the ${side} panel starts where it hangs; an offset first frame jumps the join open`,
    );
    assert.match(
      frames,
      new RegExp(`100%\\s*\\{[^}]*translateX\\(${away}\\)`),
      `the ${side} panel leaves outward, to its own wall`,
    );
  }
});

test("the landscape crosses the closed screen as one painting, at its own proportions", () => {
  const css = stylesheet();
  const art = ruleFor(css, ".ci-curtain-art");

  assert.match(
    art,
    /background-size:\s*cover\s*[;}]/,
    "the scene is fitted whole; a size given as two lengths sets width and height apart and tears it out of shape",
  );
  assert.match(art, /background-position:\s*center/, "both halves are cropped about the same centre");

  // Each half carries the whole scene — a layer as wide as the screen — so both
  // copies land on the same rectangle and the painting runs through the join.
  const panel = Number(ruleFor(css, ".ci-screen-curtain").match(/width:\s*([\d.]+)%/)?.[1]);
  const scene = Number(art.match(/width:\s*([\d.]+)%/)?.[1]);
  assert.ok(panel >= 50, `the halves meet or overlap at the middle, not leave a gap (${panel}%)`);
  assert.ok(
    Math.abs(panel * scene - 1e4) < 1,
    `each half's picture must span the whole screen, not its own half of it (${panel}% x ${scene}%)`,
  );

  for (const [side, wall] of [["left", "inset-inline-start"], ["right", "inset-inline-end"]] as const) {
    const copy = ruleFor(css, `.ci-screen-curtain[data-side="${side}"] .ci-curtain-art`);
    assert.match(copy, new RegExp(`${wall}:\\s*0`), `the ${side} copy is pinned to its own wall`);
    assert.doesNotMatch(
      copy,
      /background-position/,
      `moving the ${side} half's crop parts the scene at the join instead of continuing it`,
    );
  }
});

test("the centre light is a fixed translucent wash, and both it and the seam end at nothing", () => {
  const css = stylesheet();
  const glow = ruleFor(css, ".ci-screen-glow");

  assert.match(glow, /background-image:\s*radial-gradient/, "the light opens from the middle outward");
  assert.doesNotMatch(
    glow,
    /var\(--color-paper|var\(--color-ink|currentColor/,
    "a themed token resolves to near-black under prefers-color-scheme: dark, which is the one thing this may not be",
  );
  assert.doesNotMatch(glow, /rgb\(|#[0-9a-f]{3,6}\b/i, "an opaque stop would replace the scene rather than wash it");

  // The exact warm translucent stops now in place. Written out rather than
  // matched by shape, so `black`, a full alpha, or an ink token cannot pass
  // here; what these values look like on screen is a matter for pixel QA.
  assert.match(
    glow,
    /rgba\(255,\s*241,\s*214,\s*0\.6\)\s*0%,\s*rgba\(255,\s*227,\s*180,\s*0\.32\)\s*42%,\s*rgba\(255,\s*214,\s*156,\s*0\.11\)\s*72%,\s*transparent\s*100%/,
    "the wash is warm light thinning to nothing, at the stops the opening was tuned to",
  );
  assert.match(
    ruleFor(css, ".ci-screen-seam"),
    /transparent,\s*rgba\(255,\s*243,\s*219,\s*0\.92\)\s*16%\s*84%,\s*transparent/,
    "the seam is a warm hairline fading out at both ends, never a dark line down the middle",
  );
  for (const side of ["left", "right"] as const) {
    assert.match(
      ruleFor(css, `.ci-screen-curtain[data-side="${side}"]::after`),
      new RegExp(
        `to ${side},\\s*rgba\\(255,\\s*236,\\s*198,\\s*0\\.2\\)\\s*0%,` +
          `\\s*rgba\\(255,\\s*236,\\s*198,\\s*0\\.06\\)\\s*5%,\\s*transparent\\s*16%`,
      ),
      `the ${side} panel's inner edge is lit from the join outward; a dark stop there is the black stripe`,
    );
  }

  for (const frames of ["ci-glow-open", "ci-seam-flare"]) {
    assert.match(
      keyframesFor(css, frames),
      /100%\s*\{[^}]*opacity:\s*0\s*[;}]/,
      `${frames} must spend itself entirely, or it is left lying over a poem already being read`,
    );
  }
  // The seam is a hairline at the very middle: once the panels part, anything
  // left of it is a line floating over the poem, so it must be spent early.
  const seamFactor = /ci-seam-flare\s+calc\(var\(--fold-dur\)\s*\*\s*(0?\.\d+)\)/.exec(css);
  assert.ok(seamFactor, "the seam flare must be a fraction of the curtain duration");
  assert.ok(
    Number(seamFactor[1]) <= 0.15,
    `the seam outlasts the panels' first move at ${seamFactor[1]} of the curtain duration`,
  );

  assert.doesNotMatch(css, /\.ci-leaf-(?:face|back)\b/, "the folding leaves are gone; their rules go with them");
});

test("with reduced motion the screen leaves nothing standing over the poem", () => {
  const css = stylesheet();

  // The panels are gone in a millisecond; the phase they belong to runs on
  // afterwards. Whatever the stylesheet leaves standing then is a flash.
  assert.match(
    css,
    /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.ci-screen-curtain\[data-side="left"\],[\s\S]{0,200}?\.ci-screen-curtain\[data-side="right"\]\s*\{[^{}]*animation-duration:\s*1ms/,
    "a panel must not still be sliding when motion is turned down",
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.ci-screen-curtain\[data-side="left"\],[\s\S]{0,200}?\.ci-screen-curtain\[data-side="right"\]\s*\{[^{}]*animation-delay:\s*0ms/,
    "a delay left in place holds the panels closed over the poem long after their millisecond is spent",
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.ci-screen-glow,[\s\S]{0,200}?\.ci-screen-seam\s*\{[^{}]*animation:\s*none;[^{}]*opacity:\s*0\s*[;}]/,
    "the light and the seam end at nothing rather than run a one-millisecond flare",
  );
  assert.match(
    ruleFor(css, ".js .ci-screen"),
    /overflow:\s*hidden/,
    "the screen clips the panels it has sent to the walls, or they stand on the page beside the poem",
  );
});

test("the stage contains the opening's overflow without ever capping a poem", () => {
  const css = stylesheet();

  assert.match(ruleFor(css, ".ci-stage"), /overflow:\s*visible/, "a poem longer than the viewport must be free to grow");
  assert.match(
    ruleFor(css, '.js .ci-journey[data-phase="opening"] .ci-stage'),
    /overflow:\s*clip/,
    "while the artwork resolves out of a scale its box reaches past the foot of the viewport, and the scrollbar that appears for those few frames narrows the layout and jitters the stage sideways",
  );
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
