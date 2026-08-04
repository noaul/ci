"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { preload } from "react-dom";
import { LibraryDrawer } from "@/app/_components/library/LibraryDrawer";
import { PublishWork } from "@/app/_components/library/LibraryContext";
import { createCorpusClient, type CorpusClient } from "@/lib/journey/corpus-client";
import {
  type Deck,
  drawFromDeck,
  peekDeck,
  pickEntryIndex,
  restoreDeck,
  seedFrom,
} from "@/lib/journey/deck";
import {
  type JourneyState,
  initialJourneyState,
  intentFor,
  isLocked,
  journeyReducer,
} from "@/lib/journey/machine";
import {
  fromInteractive,
  hasTextSelection,
  isAdvanceKey,
  movedTooFar,
  shouldAdvance,
} from "@/lib/journey/pointer";
import { entryText, sceneAnnouncement, sceneFromEntry, sceneFromTheme } from "@/lib/journey/scene";
import {
  SCREEN_OPEN_MS,
  screenOpenDuration,
  transitionDuration,
  transitionSwapAt,
} from "@/lib/journey/timing";
import { planTransition, type TransitionFamily } from "@/lib/journey/transitions";
import type { StageTheme } from "@/lib/stage/types";
import { JourneyTransition } from "./JourneyTransition";
import { PoemScene } from "./PoemScene";
import { THRESHOLD_LINE, THRESHOLD_TITLE, ThresholdScreen } from "./ThresholdScreen";

const SCENE_KEY = "ci:journey:scene";
const SEED_KEY = "ci:journey:seed";
const CURSOR_KEY = "ci:journey:cursor";

const FAILED_FETCH = "此刻取不到下一阕。";

type ReadyWindow = Window & { __ciReady?: boolean; __ciHydrated?: boolean };

const readSession = (key: string): number | null => {
  try {
    const raw = window.sessionStorage.getItem(key);
    const value = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    // A private-browsing policy can deny storage without denying the page.
    return null;
  }
};

const writeSession = (key: string, value: number): void => {
  try {
    window.sessionStorage.setItem(key, String(value));
  } catch {
    // The journey still works entirely in memory.
  }
};

/**
 * The reading, from the shut screen to the whole book.
 *
 * 屏风 stands across the first view; one press opens it on one of four prepared
 * 词, its opening movement only; the next opens the rest of that poem with its
 * own climax; and after that every press turns to another complete poem drawn
 * from all three and a half thousand. The stage itself is the control — the
 * rules live in `pointer.ts`, the lifecycle in `machine.ts`, and neither of them
 * needs a browser to be checked.
 *
 * Nothing of the corpus is in this page's payload. The manifest is fetched
 * after the curated scene has opened, a shard when the reader first asks for
 * another poem, and the cover only ever starts once that poem is in hand — so a
 * weak connection leaves the reader with the poem they were already reading.
 */
export function PoeticJourney({
  themes,
  children,
}: {
  themes: StageTheme[];
  /** The served reading, for a browser that never runs any of this. */
  children: React.ReactNode;
}) {
  preload("/images/threshold-song-landscape.webp", {
    as: "image",
    fetchPriority: "high",
  });

  const first = themes[0] as StageTheme;
  const [state, dispatch] = useReducer(journeyReducer, 0, initialJourneyState);
  const [enhanced, setEnhanced] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [message, setMessage] = useState("");

  const root = useRef<HTMLElement>(null);
  const drawn = useRef(false);
  const busy = useRef(false);
  const deck = useRef<Deck | null>(null);
  const corpus = useRef<CorpusClient | null>(null);
  const position = useRef<number | null>(null);
  const history = useRef<readonly TransitionFamily[]>([]);
  const origin = useRef({ x: 0.5, y: 0.5 });
  const pointer = useRef<{
    x: number;
    y: number;
    interactive: boolean;
    locked: boolean;
  } | null>(null);

  const theme = themes[state.featured] ?? first;
  const scene = useMemo(
    () => (state.poem ? sceneFromEntry(state.poem) : sceneFromTheme(theme)),
    [state.poem, theme],
  );

  // The scene is already behind the leaves while they are still moving, so the
  // opening movement is read as the doorway forms rather than after it.
  const opening = state.phase === "opening";
  const preview = opening || state.phase === "featuredPreview";
  const climax =
    scene.kind === "featured" &&
    (state.phase === "featuredFull" || state.phase === "transitioning");
  const shown = preview ? scene.pauseIndex + 1 : scene.lines.length;
  const stagger = state.phase === "featuredFull" ? scene.pauseIndex + 1 : 0;
  const staged = state.phase !== "threshold";
  const reading = staged && !opening;

  history.current = state.history;

  // Watched rather than sampled once: a reader who turns motion off part-way
  // through must not be left waiting on a fold that is no longer running.
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    setReduced(query.matches);
    const onChange = (change: MediaQueryListEvent) => setReduced(change.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  /*
   * Take over the page — but only if the page is still waiting for us.
   *
   * The bootstrap in the document head marks the document scripted and starts a
   * timer; if this component has not arrived by the time it fires, the mark is
   * removed and the served reading stands on its own. Arriving after that is
   * arriving too late, and shutting a screen over a reader who is already
   * reading would be worse than never opening one.
   */
  useLayoutEffect(() => {
    const readyWindow = window as ReadyWindow;
    const bootstrapped = document.documentElement.classList.contains("js");
    // A client-side return from another route happens after the document-level
    // fail-open timer. The app is already healthy in that case, so raise the
    // enhancement mark again; on a genuinely late first hydration, leave the
    // served poem alone as promised.
    if (!bootstrapped && !readyWindow.__ciHydrated) return;
    document.documentElement.classList.add("js");
    readyWindow.__ciReady = true;
    setEnhanced(true);
    if (drawn.current) return;
    drawn.current = true;

    const previous = readSession(SCENE_KEY);
    const next = pickEntryIndex(themes.length, previous, Math.random());
    dispatch({ type: "DRAW", featured: next });
    writeSession(SCENE_KEY, next);
  }, [themes.length]);

  useEffect(() => {
    pointer.current = null;
  }, [state.loading, state.phase]);

  /*
   * One clock ends the fold, reading its length from the same constant the
   * stylesheet is given. A `transitionend` never arrives from an interrupted
   * leaf, arrives four times from four of them, and does not exist at all when
   * the reader has asked for less motion.
   */
  useEffect(() => {
    if (state.phase !== "opening") return;
    const timer = window.setTimeout(
      () => dispatch({ type: "OPENED" }),
      screenOpenDuration(reduced),
    );
    return () => window.clearTimeout(timer);
  }, [reduced, state.phase]);

  // The cover hands the stage over half way through, and lifts at the end.
  useEffect(() => {
    if (state.phase !== "transitioning" || !state.transition) return;
    const total = transitionDuration(state.transition, reduced);
    const swap = window.setTimeout(() => {
      dispatch({ type: "COMMIT" });
      window.scrollTo({ top: 0, behavior: "auto" });
    }, transitionSwapAt(state.transition, reduced));
    const settle = window.setTimeout(() => dispatch({ type: "SETTLE" }), total);
    return () => {
      window.clearTimeout(swap);
      window.clearTimeout(settle);
    };
  }, [reduced, state.phase, state.transition]);

  // The leaves have finished moving: hand focus into the reading so the keys
  // that turn the page reach it, and name what is standing there.
  useEffect(() => {
    if (state.phase !== "featuredPreview") return;
    root.current?.focus({ preventScroll: true });
  }, [state.phase]);

  useEffect(() => {
    if (state.error) {
      setMessage(`${state.error} 可重试。`);
      return;
    }
    if (reading) setMessage(sceneAnnouncement(scene));
  }, [reading, scene, state.error]);

  /*
   * The book starts arriving only once the curated scene is open — never before,
   * so nothing competes with the fold, and never in the initial payload.
   */
  useEffect(() => {
    if (state.phase !== "featuredPreview") return;
    let cancelled = false;
    const warm = () => {
      const client = (corpus.current ??= createCorpusClient());
      void client
        .manifest()
        .then((manifest) => {
          if (cancelled) return;
          deck.current ??= restoreDeck(
            manifest.total,
            readSession(SEED_KEY) ?? seedFrom(Math.random()),
            readSession(CURSOR_KEY) ?? 0,
          );
          writeSession(SEED_KEY, deck.current.seed);
          client.prefetch(peekDeck(deck.current));
        })
        .catch(() => {
          // Nothing is on show yet; the first real draw reports the failure.
        });
    };

    const idle = window.requestIdleCallback?.(warm, { timeout: 1200 }) ?? window.setTimeout(warm, 400);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [state.phase]);

  const turn = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    dispatch({ type: "REQUEST" });

    try {
      const client = (corpus.current ??= createCorpusClient());
      const manifest = await client.manifest();
      deck.current ??= restoreDeck(
        manifest.total,
        readSession(SEED_KEY) ?? seedFrom(Math.random()),
        readSession(CURSOR_KEY) ?? 0,
      );

      const currentId = state.poem?.id ?? theme.poemId;
      let draw = drawFromDeck(deck.current, position.current, seedFrom(Math.random()));
      let poem = await client.entry(draw.index);
      if (poem.id === currentId) {
        // The curated scene is in the book too, and its position in the deck is
        // not known until it is dealt. One more draw settles it.
        draw = drawFromDeck(draw.deck, draw.index, seedFrom(Math.random()));
        poem = await client.entry(draw.index);
      }

      deck.current = draw.deck;
      position.current = draw.index;
      writeSession(SEED_KEY, draw.deck.seed);
      writeSession(CURSOR_KEY, draw.deck.cursor);

      dispatch({
        type: "COVER",
        poem,
        transition: planTransition({
          id: poem.id,
          text: entryText(poem),
          history: history.current,
          origin: origin.current,
        }),
      });
      client.prefetch(peekDeck(draw.deck));
    } catch {
      dispatch({ type: "FAIL", message: FAILED_FETCH });
    } finally {
      busy.current = false;
    }
  }, [state.poem, theme.poemId]);

  const advance = useCallback(() => {
    switch (intentFor(state)) {
      case "enter":
        dispatch({ type: "ENTER" });
        return;
      case "reveal":
        dispatch({ type: "REVEAL" });
        return;
      case "next":
        void turn();
        return;
      case "none":
        return;
    }
  }, [state, turn]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    pointer.current = {
      x: event.clientX,
      y: event.clientY,
      interactive: fromInteractive(event.target),
      locked: isLocked(state),
    };
  }, [state]);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const down = pointer.current;
      pointer.current = null;

      const activation = {
        primary:
          event.button === 0 &&
          event.isPrimary &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey,
        interactive: (down?.interactive ?? false) || fromInteractive(event.target),
        textSelected: hasTextSelection(window.getSelection()),
        moved: down ? movedTooFar(down, { x: event.clientX, y: event.clientY }) : true,
        locked: (down?.locked ?? true) || isLocked(state),
      };
      if (!shouldAdvance(activation)) return;

      if (window.innerWidth > 0 && window.innerHeight > 0) {
        origin.current = {
          x: event.clientX / window.innerWidth,
          y: event.clientY / window.innerHeight,
        };
      }
      if (document.activeElement === document.body) root.current?.focus({ preventScroll: true });
      advance();
    },
    [advance, state],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.repeat || !isAdvanceKey(event.key) || fromInteractive(event.target)) return;
      if (isLocked(state)) return;
      event.preventDefault();
      origin.current = { x: 0.5, y: 0.5 };
      advance();
    },
    [advance, state],
  );

  return (
    <main
      ref={root}
      id="main-content"
      tabIndex={reading ? 0 : -1}
      className="ci-journey"
      aria-label={reading ? "词境，按回车、空格或右方向键继续" : undefined}
      aria-keyshortcuts={reading ? "Enter Space ArrowRight" : undefined}
      aria-busy={state.loading || undefined}
      data-phase={state.phase}
      data-scene={scene.sceneId ?? undefined}
      data-event={climax ? "turned" : "reading"}
      data-kind={scene.kind}
      data-enhanced={enhanced || undefined}
      data-loading={state.loading || undefined}
      style={
        {
          "--fold-dur": `${enhanced ? screenOpenDuration(reduced) : SCREEN_OPEN_MS}ms`,
        } as CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        pointer.current = null;
      }}
      onKeyDown={onKeyDown}
    >
      <h1 className="sr-only">历代名家词集精华录</h1>

      <div className="ci-stage">
        <div className="ci-stage-art" aria-hidden="true">
          <span key={`frame-${scene.key}`} className="ci-scene-frame">
            <span className="ci-stage-picture" />
          </span>
          <span key={`air-${scene.key}`} className="ci-scene-atmosphere" />
          <span key={`event-${scene.key}`} className="ci-scene-event" />
          <span key={`ink-${scene.key}`} className="ci-living-ink" aria-hidden="true" />
        </div>

        {enhanced && staged && (
          <div className="ci-stage-veil">
            <PoemScene scene={scene} shown={shown} from={stagger} climax={climax} />
            {reading && state.error && (
              <p className="ci-retry" role="alert">
                {state.error}
                <button type="button" className="ci-retry-button" onClick={() => void turn()}>
                  重试
                </button>
              </p>
            )}
          </div>
        )}

        {state.phase === "transitioning" && state.transition && (
          <JourneyTransition
            plan={state.transition}
            duration={transitionDuration(state.transition, reduced)}
          />
        )}

        <ThresholdScreen />

        {/*
          The door: one real button across the whole screen, so a pointer opens
          it anywhere on the face and Enter or Space open it from the keyboard
          with no handler of our own. It leaves the tree once it is spent rather
          than going inert under the reader's focus.
        */}
        {enhanced && state.phase === "threshold" && (
          <button type="button" className="ci-threshold-entry" onClick={() => dispatch({ type: "ENTER" })}>
            <span className="sr-only">
              {THRESHOLD_TITLE}　{THRESHOLD_LINE}
            </span>
          </button>
        )}
      </div>

      <LibraryDrawer tone="journey" />

      <PublishWork work={reading ? scene.work : null} />

      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>

      {/* The served reading. Hidden while scripts hold the stage, and the only
          thing on the page if they never take it. */}
      <div className="ci-served">{children}</div>
    </main>
  );
}

/** Kept beside the reducer so a test can name the phases the journey exposes. */
export type { JourneyState };
