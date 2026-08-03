"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Numeral } from "@/app/_components/Numeral";
import Link from "@/app/_components/StaticLink";
import {
  buildContinuationChoices,
  nearestByLength,
  pickEntryIndex,
  pickNextIndex,
  stageEvent,
} from "@/lib/stage/select";
import {
  SCREEN_CLOSE_MS,
  SCREEN_OPEN_MS,
  initialScreenState,
  screenDuration,
  screenReducer,
} from "@/lib/stage/screen";
import type { StageHint, StageMetrics, StageTheme } from "@/lib/stage/types";

/** Continuations offered at the 转, and how wide a net the decoys come from. */
const CHOICE_COUNT = 3;
const CHOICE_POOL = 8;
const LAST_SCENE_KEY = "ci:last-scene";

type Reveal = {
  /** Lines standing open, counted from the first. */
  count: number;
  /** First line of the batch that opened them — drives the stagger. */
  from: number;
};

const opening = (theme: StageTheme): Reveal => ({ count: theme.pauseIndex + 1, from: 0 });

/**
 * The home stage: a four-panel screen standing shut across the first view, and
 * behind it one of four 词, read the way a 词 is built — 起 opens by itself, 顿
 * waits on the reader, 转 asks the reader to supply it, and 余味 stays behind
 * after the last line.
 *
 * The poem is server-rendered whole, so it is in the HTML and readable with no
 * JavaScript at all. When scripts do run, the `.js` class the document carries
 * raises the screen in front of the stage and veils the content for the frame it
 * takes to hydrate; the scene is drawn behind the shut screen, so what React
 * renders first is identical on both sides and nothing needs suppressing. The
 * frame reserves height for the longest of the four, so a 慢词 and a 小令 stand
 * in the same space.
 */
export function PoeticStage({
  themes,
  metrics,
  hint,
}: {
  themes: StageTheme[];
  metrics: StageMetrics;
  hint: StageHint;
}) {
  const first = themes[0] as StageTheme;
  const [screen, dispatchScreen] = useReducer(screenReducer, 0, initialScreenState);
  const [phase, setPhase] = useState<"initial" | "reading">("initial");
  const [reveal, setReveal] = useState<Reveal>(() => ({ count: first.lines.length, from: 0 }));
  /** Bumped whenever a reading restarts, so the reveal plays again. */
  const [run, setRun] = useState(0);
  const [missed, setMissed] = useState<readonly string[]>([]);
  const [message, setMessage] = useState("");
  const [enhanced, setEnhanced] = useState(false);
  const [reduced, setReduced] = useState(false);
  const drawn = useRef(false);
  const lead = useRef<HTMLButtonElement>(null);
  const stage = useRef<HTMLElement>(null);

  const theme = themes[screen.activeIndex] ?? first;
  const complete = reveal.count >= theme.lines.length;
  const asking = phase === "reading" && reveal.count === theme.turnIndex;
  const event = stageEvent(reveal.count, theme.turnIndex);
  const headingId = useId();

  const resetReading = useCallback(
    (next: number) => {
      setReveal(opening(themes[next] as StageTheme));
      setMissed([]);
      try {
        window.sessionStorage.setItem(LAST_SCENE_KEY, String(next));
      } catch {
        // Storage may be unavailable; scene switching still works in memory.
      }
    },
    [themes],
  );

  // Watched rather than sampled once: a reader who turns motion off part-way
  // through must not be left waiting on a swing that is no longer running.
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    setReduced(query.matches);
    const onChange = (change: MediaQueryListEvent) => setReduced(change.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // The scene is drawn on entry rather than at build time: a reload should be
  // able to land anywhere, which a statically exported page cannot decide. It is
  // drawn while the screen is still shut, so nothing of it is on show yet.
  useLayoutEffect(() => {
    const failedStages = (
      window as typeof window & { __ciStageFailedOpen?: WeakSet<Element> }
    ).__ciStageFailedOpen;

    // Once the CSS safety opening has begun, the served poem has become the
    // reading. A late bundle must not shut the leaves over it again.
    if (stage.current && failedStages?.has(stage.current)) return;

    setEnhanced(true);
    if (drawn.current) return;
    drawn.current = true;

    let previous: number | null = null;
    try {
      const stored = window.sessionStorage.getItem(LAST_SCENE_KEY);
      previous = stored === null ? null : Number(stored);
    } catch {
      // A private browsing policy can deny storage without denying the page.
    }
    const next = pickEntryIndex(themes.length, previous, Math.random());
    resetReading(next);
    dispatchScreen({ type: "DRAW", nextIndex: next });
    setPhase("reading");
  }, [resetReading, themes.length]);

  /*
   * One clock, keyed to the phase, is the only thing that ends a swing.
   *
   * A `transitionend` would be the obvious source and is the wrong one: it never
   * arrives from a hidden leaf or an interrupted swing, it arrives twice from
   * four of them, and under reduced motion there is no transition to end. A
   * timer that reads its length from the same constants the stylesheet is given
   * cannot disagree with the animation, and cannot fail to fire.
   */
  useEffect(() => {
    if (screen.phase !== "opening" && screen.phase !== "closing") return;
    const closing = screen.phase === "closing";
    const pending = screen.pendingIndex;

    const timer = window.setTimeout(() => {
      // The incoming scene is committed while the screen still covers it.
      if (closing && pending !== null) resetReading(pending);
      dispatchScreen(closing ? { type: "CLOSE_FINISHED" } : { type: "OPEN_FINISHED" });
    }, screenDuration(screen.phase, reduced));

    return () => window.clearTimeout(timer);
  }, [reduced, resetReading, screen.pendingIndex, screen.phase]);

  // Once the leaves have finished moving, hand focus into the reading. The
  // reveal itself restarts at the opening edge (see enterScene below), so the 起
  // is visible while the doorway is forming rather than beginning after it.
  useEffect(() => {
    if (screen.phase !== "open") return;
    setMessage(`${theme.poet}《${theme.heading}》`);
    lead.current?.focus({ preventScroll: true });
  }, [screen.phase, theme.heading, theme.poet]);

  // Decoys are real lines from the other three scenes, matched to the answer's
  // measure so the choice is about the poem rather than about line length.
  const choices = useMemo(() => {
    if (!asking) return null;
    const answer = theme.lines[theme.turnIndex]?.text ?? "";
    const pool = themes.flatMap((other, i) =>
      i === screen.activeIndex ? [] : other.lines.map((line) => line.text),
    );
    return buildContinuationChoices(
      answer,
      nearestByLength(answer, pool, CHOICE_POOL),
      CHOICE_COUNT,
      Math.random,
    );
  }, [asking, run, screen.activeIndex, theme, themes]);

  /*
   * 换一阕 shuts the screen, swaps behind it, and opens again. Focus moves to the
   * stage itself first: the control that was just pressed is about to go inert
   * with the rest of the poem, and focus would otherwise fall to the document.
   * The announcement says only that the screen has closed — naming the incoming
   * 词 here would hand a screen reader the opening the leaves are hiding.
   */
  const switchScene = useCallback(() => {
    if (screen.phase !== "open") return;
    const next = pickNextIndex(themes.length, screen.activeIndex, Math.random());
    dispatchScreen({ type: "SWAP", nextIndex: next });
    setMessage("屏风合拢。");
    stage.current?.focus({ preventScroll: true });
  }, [screen.activeIndex, screen.phase, themes.length]);

  const enterScene = useCallback(() => {
    if (screen.phase !== "closed") return;
    // The randomly drawn reading was prepared behind the shut screen. Remount
    // its visual layers exactly as the leaves begin to part so none of the 起 is
    // spent invisibly during hydration.
    stage.current?.focus({ preventScroll: true });
    setRun((n) => n + 1);
    dispatchScreen({ type: "ENTER" });
  }, [screen.phase]);

  const advance = useCallback(() => {
    if (complete) {
      resetReading(screen.activeIndex);
      setRun((n) => n + 1);
      setMessage(`重读：${theme.scene}`);
      return;
    }
    setReveal({ count: reveal.count + 1, from: reveal.count });
    setMissed([]);
    setMessage(theme.lines[reveal.count]?.text ?? "");
  }, [complete, resetReading, reveal.count, screen.activeIndex, theme]);

  // 全篇 disables itself once there is nothing left to open. A button that
  // goes disabled under the reader's own finger would drop focus to the body,
  // so the lead control takes it.
  const revealAll = useCallback(() => {
    if (complete) return;
    setReveal({ count: theme.lines.length, from: reveal.count });
    setMissed([]);
    setMessage(`全篇已展开，共 ${theme.lines.length} 句。`);
    lead.current?.focus({ preventScroll: true });
  }, [complete, reveal.count, theme]);

  const choose = useCallback(
    (line: string) => {
      const answer = theme.lines[theme.turnIndex]?.text ?? "";
      if (line !== answer) {
        setMissed((seen) => (seen.includes(line) ? seen : [...seen, line]));
        setMessage("不是这一句。再听上一句的收处。");
        return;
      }
      setReveal({ count: theme.turnIndex + 1, from: theme.turnIndex });
      setMissed([]);
      setMessage(answer);
      lead.current?.focus({ preventScroll: true });
    },
    [theme],
  );

  const stanzas = useMemo(() => groupByStanza(theme.lines), [theme]);
  const shut = enhanced && screen.phase !== "open";

  return (
    <section
      ref={stage}
      tabIndex={-1}
      aria-labelledby={shut ? undefined : headingId}
      aria-label={shut ? "词境屏风" : undefined}
      data-scene={theme.id}
      data-phase={phase}
      data-screen={screen.phase}
      data-event={event}
      data-complete={complete || undefined}
      data-enhanced={enhanced || undefined}
      className="ci-stage"
      style={
        {
          "--stage-rows": metrics.rows,
          "--stage-breaks": metrics.stanzaBreaks,
          "--screen-open-dur": `${reduced ? 0 : SCREEN_OPEN_MS}ms`,
          "--screen-close-dur": `${reduced ? 0 : SCREEN_CLOSE_MS}ms`,
        } as CSSProperties
      }
    >
      {/* Keyed on the reading, so a scene's one climax plays again on 重读. */}
      <div className="ci-stage-art" aria-hidden="true">
        <span key={`frame-${theme.id}-${run}`} className="ci-scene-frame">
          <span className="ci-stage-picture" />
        </span>
        <span key={`air-${theme.id}-${run}`} className="ci-scene-atmosphere" />
        <span key={`event-${theme.id}-${run}`} className="ci-scene-event" />
      </div>

      <div className="ci-veil ci-stage-content" inert={shut || undefined}>
        <p className="ci-scene">
          <span className="ci-scene-name">{theme.scene}</span>
          {theme.motifs.map((motif) => (
            <span key={motif} className="ci-motif">
              {motif}
            </span>
          ))}
        </p>

        <h2 id={headingId} className="ci-stage-title">
          {/* The heading goes to the poem, and only there — 贺铸's 词牌 route
              belongs to 横塘路, which is what the provenance below links to. */}
          <Link href={theme.href}>{theme.heading}</Link>
        </h2>
        <p className="ci-stage-byline">
          〔{theme.dynasty}〕
          <Link href={theme.poetHref}>{theme.poet}</Link>
        </p>

        <div key={`${theme.id}-${run}`} className="ci-poem">
          {stanzas.map((stanza, s) => (
            <p key={s} className="ci-stanza" data-opens={s > 0 || undefined}>
              {stanza.map(({ text, index: i }) => {
                const shown = i < reveal.count;
                return (
                  <span
                    key={i}
                    className="ci-line"
                    data-shown={shown || undefined}
                    data-turn={i === theme.turnIndex || undefined}
                    style={{ "--ci-order": Math.max(0, i - reveal.from) } as CSSProperties}
                  >
                    <span className="ci-line-text" aria-hidden={!shown || undefined}>
                      {text}
                    </span>
                    {asking && choices && i === theme.turnIndex && (
                      <span className="ci-choices" role="group" aria-label="接下一句">
                        <span className="ci-choices-label" aria-hidden>
                          接下一句
                        </span>
                        {choices.map((choice) => (
                          <button
                            key={choice}
                            type="button"
                            className="ci-choice"
                            data-missed={missed.includes(choice) || undefined}
                            onClick={() => choose(choice)}
                          >
                            {choice}
                          </button>
                        ))}
                      </span>
                    )}
                  </span>
                );
              })}
            </p>
          ))}
        </div>

        {/* Marked 余韵 so it is never mistaken for the volume's own 注释. */}
        <p className="ci-aftertaste">
          {complete ? (
            <>
              <span className="ci-aftertaste-label">余韵</span>
              {theme.aftertaste}
            </>
          ) : (
            ""
          )}
        </p>

        <div className="ci-controls">
          {enhanced && (
            <div className="ci-control-group">
              <button
                ref={lead}
                type="button"
                className="ci-button ci-button-lead"
                onClick={advance}
              >
                {asking ? "揭晓" : complete ? "重读" : "续"}
              </button>
              <button type="button" className="ci-button" disabled={complete} onClick={revealAll}>
                全篇
              </button>
              <button
                type="button"
                className="ci-button"
                onClick={switchScene}
                aria-label={`换一阕，离开${theme.scene}`}
              >
                换一阕
              </button>
            </div>
          )}
          <Link href={theme.href} className="ci-stage-read">
            注释与辑评 <Numeral value={theme.noteCount + theme.commentaryCount} /> 条
            <span aria-hidden> →</span>
          </Link>
        </div>

        <details className="ci-provenance">
          <summary>本阕出处</summary>
          {/* The volume's own filing, not the heading above it. */}
          <ul>
            <li>
              <span>词牌</span>
              {theme.tuneHref ? <Link href={theme.tuneHref}>{theme.tune}</Link> : <b>{theme.tune}</b>}
            </li>
            {theme.title && (
              <li>
                <span>词题</span>
                <b>{theme.title}</b>
              </li>
            )}
            <li>
              <span>分册</span>
              <Link href={theme.volumeHref}>{theme.volumeTitle}</Link>
            </li>
            <li>
              <span>注释</span>
              <b>
                <Numeral value={theme.noteCount} /> 条 · 辑评 <Numeral value={theme.commentaryCount} />{" "}
                条
              </b>
            </li>
          </ul>
        </details>
      </div>

      {/*
        The door. A real button, so Enter and Space open the screen without a
        keyboard handler of our own, and so it leaves the tree — rather than
        going disabled or hidden under the reader's focus — once it is spent.
      */}
      {enhanced && screen.phase === "closed" && (
        <button
          type="button"
          className="ci-screen-trigger"
          onClick={enterScene}
        >
          <span className="ci-screen-enter">入词</span>
        </button>
      )}

      {/*
        Decoration, and deliberately mute: the face carries the collection and
        its measure, never the 词 standing behind it. The outer rails stay after
        the leaves have folded away, so the stage keeps its doorway.
      */}
      <div className="ci-screen" aria-hidden="true">
        <span className="ci-screen-panel" data-screen-panel="outer-left" />
        <span className="ci-screen-panel" data-screen-panel="inner-left" />
        <span className="ci-screen-panel" data-screen-panel="inner-right" />
        <span className="ci-screen-panel" data-screen-panel="outer-right" />
        <span className="ci-screen-rail" data-screen-rail="left" />
        <span className="ci-screen-rail" data-screen-rail="right" />
        <span className="ci-screen-inscription">
          <span className="ci-screen-brand">历代名家词集精华录</span>
          <span className="ci-screen-measure">
            <Numeral value={hint.poems} /> 首 · <Numeral value={hint.volumes} /> 册
          </span>
        </span>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>
    </section>
  );
}

/** Lines regrouped into the 片 they were printed in. */
function groupByStanza(lines: StageTheme["lines"]): { text: string; index: number }[][] {
  const groups: { text: string; index: number }[][] = [];
  lines.forEach((line, index) => {
    if (index === 0 || line.opensStanza) groups.push([]);
    groups[groups.length - 1]?.push({ text: line.text, index });
  });
  return groups;
}
