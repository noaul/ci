import type { BaixiangChar } from "@/pipeline/src/profiles/cipu";

/** Legend for 白香词谱's tone marks, as observed across all 100 entries. */
export const TONE_LEGEND: Record<string, { label: string; className: string }> = {
  平: { label: "平声", className: "text-ink-faint" },
  仄: { label: "仄声", className: "text-ink-faint" },
  "〇": { label: "可平可仄（此处用平）", className: "text-seal" },
  "●": { label: "可平可仄（此处用仄）", className: "text-seal" },
  "◎": { label: "平韵", className: "text-cinnabar" },
  "△": { label: "仄韵", className: "text-cinnabar" },
  "①": { label: "平韵（第一部）", className: "text-cinnabar" },
  "②": { label: "平韵（第二部）", className: "text-cinnabar" },
  "△¹": { label: "仄韵（第一部）", className: "text-cinnabar" },
  "△²": { label: "仄韵（第二部）", className: "text-cinnabar" },
  去: { label: "宜用去声", className: "text-seal" },
};

/**
 * The example poem with its 平仄 template above each character.
 *
 * This is the one thing the printed 词谱 can show and a plain text file cannot:
 * every character paired with what the tune requires of it, and the rhyme
 * positions picked out in cinnabar.
 */
export function ToneTemplate({ stanzas }: { stanzas: BaixiangChar[][] }) {
  return (
    <div className="space-y-4">
      {stanzas.map((stanza, i) => (
        <p key={i} className="flex flex-wrap gap-x-0.5 gap-y-2">
          {stanza.map((c, j) => {
            const legend = c.tone ? TONE_LEGEND[c.tone] : undefined;
            return (
              <span key={j} className="inline-flex w-[1.15em] flex-col items-center leading-none">
                <span
                  className={`h-[1.1em] text-[0.6em] ${legend?.className ?? "text-transparent"}`}
                  title={legend?.label}
                >
                  {c.tone ?? ""}
                </span>
                <span className="font-kai text-[1.35rem] text-ink">{c.ch}</span>
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}

export function ToneLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint">
      {Object.entries(TONE_LEGEND).map(([mark, { label, className }]) => (
        <li key={mark}>
          <span className={className}>{mark}</span> {label}
        </li>
      ))}
    </ul>
  );
}
