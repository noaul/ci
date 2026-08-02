"use client";

import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
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
} from "@/lib/stage/select";
import type { StageMetrics, StageTheme } from "@/lib/stage/types";

/** Continuations offered at the 转, and how wide a net the decoys come from. */
const CHOICE_COUNT = 3;
const CHOICE_POOL = 8;
/** A pointer that travels further than this was selecting text, not tapping. */
const DRAG_SLOP = 8;
const LAST_SCENE_KEY = "ci:last-scene";

type Reveal = {
  /** Lines standing open, counted from the first. */
  count: number;
  /** First line of the batch that opened them — drives the stagger. */
  from: number;
};

const opening = (theme: StageTheme): Reveal => ({ count: theme.pauseIndex + 1, from: 0 });

/**
 * The home stage: one of four 词, read the way a 词 is built — 起 opens by
 * itself, 顿 waits on the reader, 转 asks the reader to supply it, and 余味
 * stays behind after the last line.
 *
 * The poem is server-rendered whole, so it is in the HTML and readable with no
 * JavaScript at all. When scripts do run, the `.js` class the document carries
 * veils the stage for the frame it takes to hydrate, and the scene is drawn
 * then — which is why what React renders first is identical on both sides and
 * nothing needs suppressing. The frame reserves height for the longest of the
 * four, so a 慢词 and a 小令 stand in the same space.
 */
export function PoeticStage({ themes, metrics }: { themes: StageTheme[]; metrics: StageMetrics }) {
  const first = themes[0] as StageTheme;
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"initial" | "reading">("initial");
  const [reveal, setReveal] = useState<Reveal>(() => ({ count: first.lines.length, from: 0 }));
  /** Bumped whenever a reading restarts, so the reveal plays again. */
  const [run, setRun] = useState(0);
  const [missed, setMissed] = useState<readonly string[]>([]);
  const [message, setMessage] = useState("");

  const theme = themes[index] ?? first;
  const complete = reveal.count >= theme.lines.length;
  const asking = phase === "reading" && reveal.count === theme.turnIndex;
  const headingId = useId();

  const open = useCallback(
    (next: number) => {
      setIndex(next);
      setReveal(opening(themes[next] as StageTheme));
      setMissed([]);
      setRun((n) => n + 1);
      try {
        window.sessionStorage.setItem(LAST_SCENE_KEY, String(next));
      } catch {
        // Storage may be unavailable; scene switching still works in memory.
      }
    },
    [themes],
  );

  // The scene is drawn on entry rather than at build time: a reload should be
  // able to land anywhere, which a statically exported page cannot decide.
  useEffect(() => {
    let previous: number | null = null;
    try {
      const stored = window.sessionStorage.getItem(LAST_SCENE_KEY);
      previous = stored === null ? null : Number(stored);
    } catch {
      // A private browsing policy can deny storage without denying the page.
    }
    open(pickEntryIndex(themes.length, previous, Math.random()));
    setPhase("reading");
  }, [open, themes.length]);

  // Decoys are real lines from the other three scenes, matched to the answer's
  // measure so the choice is about the poem rather than about line length.
  const choices = useMemo(() => {
    if (!asking) return null;
    const answer = theme.lines[theme.turnIndex]?.text ?? "";
    const pool = themes.flatMap((other, i) =>
      i === index ? [] : other.lines.map((line) => line.text),
    );
    return buildContinuationChoices(
      answer,
      nearestByLength(answer, pool, CHOICE_POOL),
      CHOICE_COUNT,
      Math.random,
    );
  }, [asking, index, run, theme, themes]);

  const switchScene = useCallback(() => {
    const next = pickNextIndex(themes.length, index, Math.random());
    const scene = themes[next] as StageTheme;
    open(next);
    setMessage(`已换：${scene.poet}《${scene.heading}》`);
  }, [index, open, themes]);

  const advance = useCallback(() => {
    if (complete) {
      open(index);
      setMessage(`重读：${theme.scene}`);
      return;
    }
    setReveal({ count: reveal.count + 1, from: reveal.count });
    setMissed([]);
    setMessage(theme.lines[reveal.count]?.text ?? "");
  }, [complete, index, open, reveal.count, theme]);

  // 全篇 disables itself once there is nothing left to open. A button that
  // goes disabled under the reader's own finger would drop focus to the body,
  // so the lead control takes it.
  const lead = useRef<HTMLButtonElement>(null);
  const revealAll = useCallback(() => {
    if (complete) return;
    setReveal({ count: theme.lines.length, from: reveal.count });
    setMissed([]);
    setMessage(`全篇已展开，共 ${theme.lines.length} 句。`);
    lead.current?.focus();
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
      lead.current?.focus();
    },
    [theme],
  );

  // Tapping the stage turns to another scene — but a tap that lands on a
  // control, or that was really a drag across the text, must not.
  const down = useRef({ x: 0, y: 0, dragged: false });
  const onPointerDown = (event: ReactPointerEvent) => {
    down.current = { x: event.clientX, y: event.clientY, dragged: false };
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    down.current.dragged =
      Math.hypot(event.clientX - down.current.x, event.clientY - down.current.y) > DRAG_SLOP;
  };
  const onClick = (event: ReactMouseEvent) => {
    if (event.defaultPrevented || down.current.dragged) return;
    if ((event.target as HTMLElement | null)?.closest("a, button, summary, [data-stage-keep]")) {
      return;
    }
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim() !== "") return;
    switchScene();
  };

  const stanzas = useMemo(() => groupByStanza(theme.lines), [theme]);

  return (
    <section
      aria-labelledby={headingId}
      data-scene={theme.id}
      data-phase={phase}
      className="ci-stage"
      style={
        {
          "--stage-rows": metrics.rows,
          "--stage-breaks": metrics.stanzaBreaks,
        } as CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onClick={onClick}
    >
      <div className="ci-stage-art" aria-hidden="true">
        <span key={theme.id} className="ci-stage-picture" />
      </div>
      <div className="ci-veil">
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

        <div className="ci-controls" data-stage-keep>
          <div className="ci-control-group">
            <button ref={lead} type="button" className="ci-button ci-button-lead" onClick={advance}>
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
          <Link href={theme.href} className="ci-stage-read">
            注释与辑评 <Numeral value={theme.noteCount + theme.commentaryCount} /> 条
            <span aria-hidden> →</span>
          </Link>
        </div>

        <details className="ci-provenance" data-stage-keep>
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
