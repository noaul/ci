import { RareText } from "./RareText";

/**
 * Split a 片 printed as one continuous block into display lines.
 *
 * Most volumes set a whole 片 as a single paragraph; 李清照 and 李煜 preserve the
 * printed line breaks. Breaking the former after 。？！ gives every volume the
 * same reading rhythm without inventing breaks the source does not imply.
 */
function displayLines(stanza: string[]): string[] {
  if (stanza.length > 1) return stanza;
  const line = stanza[0] ?? "";
  const parts = line.split(/(?<=[。？！])/).filter((s) => s.trim());
  return parts.length > 0 ? parts : [line];
}

export function PoemBody({ stanzas, vertical = false }: { stanzas: string[][]; vertical?: boolean }) {
  return (
    <div
      className={
        vertical
          ? "vertical-poem mx-auto flex gap-8 font-kai text-2xl leading-[2]"
          : "space-y-5 font-kai text-xl leading-[2.1] sm:text-2xl"
      }
    >
      {stanzas.map((stanza, i) => (
        <p key={i} className={vertical ? "" : "text-ink"}>
          {displayLines(stanza).map((line, j) => (
            <span key={j} className="block">
              <RareText>{line}</RareText>
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
