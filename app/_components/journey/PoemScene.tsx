import type { CSSProperties } from "react";
import { RareParts } from "@/app/_components/RareParts";
import type { Scene } from "@/lib/journey/scene";
import { parseRare } from "@/lib/rare";

/**
 * The poem on the stage.
 *
 * One shape for both kinds of reading: the curated scene shows its 词境 and its
 * motifs and stops at its own pause line the first time; a poem drawn from the
 * book arrives whole. Lines already open keep the stagger they were revealed
 * with, so the opening movement reads as one gesture rather than eight.
 */
export function PoemScene({
  scene,
  shown,
  from,
  climax,
}: {
  scene: Scene;
  /** Lines standing open, counted from the first. */
  shown: number;
  /** First line of the batch that opened them — drives the stagger. */
  from: number;
  /** True once the prepared scene has reached its 转. */
  climax: boolean;
}) {
  const stanzas = groupByStanza(scene.lines);

  return (
    <div className="ci-scene-text">
      {scene.eyebrow.length > 0 && (
        <p className="ci-scene-marks">
          {scene.eyebrow.map((mark, i) => (
            <span key={mark} className={i === 0 ? "ci-scene-name" : "ci-motif"}>
              {mark}
            </span>
          ))}
        </p>
      )}

      <h2 className="ci-scene-title">
        <RareParts parts={parseRare(scene.title)} />
      </h2>
      <p className="ci-scene-byline">
        {scene.dynasty && `〔${scene.dynasty}〕`}
        {scene.poet}
      </p>

      <div key={scene.key} className="ci-poem">
        {stanzas.map((stanza, s) => (
          <p key={s} className="ci-stanza" data-opens={s > 0 || undefined}>
            {stanza.map(({ text, index }) => {
              const open = index < shown;
              return (
                <span
                  key={index}
                  className="ci-line"
                  data-shown={open || undefined}
                  data-turn={(climax && index === scene.turnIndex) || undefined}
                  style={{ "--ci-order": Math.max(0, index - from) } as CSSProperties}
                >
                  <span className="ci-line-text" aria-hidden={!open || undefined}>
                    <RareParts parts={parseRare(text)} />
                  </span>
                </span>
              );
            })}
          </p>
        ))}
      </div>

      {/* Marked 余韵 so it is never mistaken for the volume's own 注释. */}
      {climax && scene.aftertaste && (
        <p className="ci-aftertaste">
          <span className="ci-aftertaste-label">余韵</span>
          {scene.aftertaste}
        </p>
      )}
    </div>
  );
}

/** Lines regrouped into the 片 they were printed in. */
function groupByStanza(lines: Scene["lines"]): { text: string; index: number }[][] {
  const groups: { text: string; index: number }[][] = [];
  lines.forEach((line, index) => {
    if (index === 0 || line.opens) groups.push([]);
    groups[groups.length - 1]?.push({ text: line.text, index });
  });
  return groups;
}
