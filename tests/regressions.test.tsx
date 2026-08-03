import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RareText } from "@/app/_components/RareText";
import VolumesPage from "@/app/volumes/page";
import { charCount } from "@/lib/content";
import { hasHan } from "@/pipeline/src/text";
import type { Poem } from "@/pipeline/src/types";
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
  assert.match(css, /html\[data-drawer-open\]\s*{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.ci-stage\s*{[^}]*overflow:\s*visible/s);
  assert.match(css, /\.js \.ci-stage\s*{[^}]*align-content:\s*safe center/s);
  assert.match(css, /\.ci-drawer\[open\] \.ci-drawer-trigger\s*{[^}]*position:\s*fixed/s);
});
