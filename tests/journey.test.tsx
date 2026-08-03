import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PoemScene } from "@/app/_components/journey/PoemScene";
import { getCorpusEntries } from "@/lib/corpus/entries";
import type { CorpusEntry } from "@/lib/corpus/shards";
import { drawFromDeck, makeDeck, restoreDeck } from "@/lib/journey/deck";
import {
  initialJourneyState,
  intentFor,
  isLocked,
  journeyReducer,
  type JourneyState,
} from "@/lib/journey/machine";
import { isAdvanceKey, movedTooFar, shouldAdvance } from "@/lib/journey/pointer";
import { sceneFromEntry } from "@/lib/journey/scene";
import {
  planTransition,
  rememberFamily,
  TRANSITION_FAMILIES,
  TRANSITION_MAX_MS,
  TRANSITION_MIN_MS,
  type TransitionPlan,
} from "@/lib/journey/transitions";
import { getStageThemes } from "@/lib/stage/themes";

const poem: CorpusEntry = {
  id: "test-poet/test-poem",
  tune: "如梦令",
  title: null,
  poet: "词人",
  poetId: "test-poet",
  dynasty: "宋",
  volume: "测试词集",
  volumeId: "test-volume",
  tuneId: "ru-meng-ling",
  lines: ["第一句。", "第二句。"],
  opens: [1],
  notes: 0,
  commentary: 0,
};

const transition: TransitionPlan = {
  family: "mist",
  direction: "forward",
  depth: 2,
  duration: 560,
  origin: { x: 0.5, y: 0.5 },
};

test("the four curated entries and their opening/turn lines come from the corpus", () => {
  const themes = getStageThemes();
  assert.equal(themes.length, 4);
  assert.equal(themes[0]?.poemId, "liu-yong/0041-yu-lin-ling");
  assert.equal(themes[3]?.poemId, "he-zhu/0085-heng-tang-lu");

  for (const theme of themes) {
    assert.ok(theme.pauseIndex >= 0, theme.id);
    assert.ok(theme.pauseIndex < theme.turnIndex, theme.id);
    assert.ok(theme.turnIndex < theme.lines.length, theme.id);
  }
});

test("the journey walks threshold, one preview, the same full poem, then corpus poems", () => {
  let state: JourneyState = initialJourneyState();
  assert.equal(intentFor(state), "enter");

  state = journeyReducer(state, { type: "DRAW", featured: 3 });
  state = journeyReducer(state, { type: "ENTER" });
  assert.equal(state.phase, "opening");
  assert.equal(isLocked(state), true);

  state = journeyReducer(state, { type: "OPENED" });
  assert.equal(state.phase, "featuredPreview");
  assert.equal(intentFor(state), "reveal");

  state = journeyReducer(state, { type: "REVEAL" });
  assert.equal(state.phase, "featuredFull");
  assert.equal(state.featured, 3, "revealing must not redraw the prepared poem");

  state = journeyReducer(state, { type: "REQUEST" });
  assert.equal(state.loading, true);
  assert.equal(intentFor(state), "none");

  state = journeyReducer(state, { type: "COVER", poem, transition });
  assert.equal(state.phase, "transitioning");
  assert.equal(state.poem, null, "the incoming poem stays pending until the cover is opaque");

  state = journeyReducer(state, { type: "COMMIT" });
  assert.equal(state.poem?.id, poem.id);
  state = journeyReducer(state, { type: "SETTLE" });
  assert.equal(state.phase, "corpusFull");
  assert.equal(intentFor(state), "next");
});

test("a failed draw leaves the current reading in place and can be requested again", () => {
  let state = journeyReducer(initialJourneyState(), { type: "ENTER" });
  state = journeyReducer(state, { type: "OPENED" });
  state = journeyReducer(state, { type: "REVEAL" });
  state = journeyReducer(state, { type: "REQUEST" });
  state = journeyReducer(state, { type: "FAIL", message: "暂不可取" });
  assert.equal(state.phase, "featuredFull");
  assert.equal(state.loading, false);
  assert.equal(state.error, "暂不可取");
  assert.equal(intentFor(state), "next");
});

test("the corpus deck shows every entry once and restores the exact post-exclusion order", () => {
  const total = 3508;
  let deck = makeDeck(total, 20260803);
  let current: number | null = null;
  const seen = new Set<number>();

  for (let i = 0; i < total; i += 1) {
    const draw = drawFromDeck(deck, current, 77);
    assert.equal(seen.has(draw.index), false, `repeat at draw ${i}`);
    seen.add(draw.index);
    current = draw.index;
    deck = draw.deck;
  }
  assert.equal(seen.size, total);

  const fresh = makeDeck(2, 7);
  const exhausted = { ...makeDeck(2, 1), cursor: 2 };
  const boundary = drawFromDeck(exhausted, fresh.order[0] ?? null, 7);
  assert.deepEqual(
    restoreDeck(boundary.deck.total, boundary.deck.seed, boundary.deck.cursor),
    boundary.deck,
  );
});

test("transition families vary without consecutive repeats and keep bounded timing", () => {
  let history: (typeof TRANSITION_FAMILIES)[number][] = [];
  let previous: (typeof TRANSITION_FAMILIES)[number] | null = null;

  for (let i = 0; i < 24; i += 1) {
    const plan = planTransition({
      id: `poem-${i}`,
      text: "风雨烟水灯月旧梦长亭",
      history,
      origin: { x: i / 23, y: 1 - i / 23 },
    });
    assert.notEqual(plan.family, previous);
    assert.ok(plan.duration >= TRANSITION_MIN_MS && plan.duration <= TRANSITION_MAX_MS);
    assert.ok(plan.origin.x >= 0 && plan.origin.x <= 1);
    history = rememberFamily(history, plan.family);
    previous = plan.family;
  }
});

test("pointer and keyboard guards reject drags, locks, modifiers, and unrelated keys", () => {
  assert.equal(movedTooFar({ x: 0, y: 0 }, { x: 11, y: 0 }), true);
  assert.equal(movedTooFar({ x: 0, y: 0 }, { x: 8, y: 8 }), false);
  assert.equal(
    shouldAdvance({ primary: true, interactive: false, textSelected: false, moved: false, locked: false }),
    true,
  );
  for (const field of ["primary", "interactive", "textSelected", "moved", "locked"] as const) {
    const activation = { primary: true, interactive: false, textSelected: false, moved: false, locked: false };
    if (field === "primary") activation.primary = false;
    else activation[field] = true;
    assert.equal(shouldAdvance(activation), false, field);
  }
  assert.equal(isAdvanceKey("Enter"), true);
  assert.equal(isAdvanceKey(" "), true);
  assert.equal(isAdvanceKey("ArrowRight"), true);
  assert.equal(isAdvanceKey("ArrowLeft"), false);
});

test("image-backed rare glyphs remain visible in corpus journey titles", () => {
  const entry = getCorpusEntries().find((item) => item.id === "xin-qiji/0269-yu-mei-ren");
  assert.ok(entry);
  const scene = sceneFromEntry(entry);
  assert.match(scene.title, /\{\{IMG:00243\.jpeg\}\}/);
  assert.doesNotMatch(scene.title, /□/);

  const html = renderToStaticMarkup(
    <PoemScene scene={scene} shown={scene.lines.length} from={0} climax={false} />,
  );
  assert.match(html, /src="\/glyphs\/00243\.jpeg"/);
});
