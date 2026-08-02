import { displayLines } from "@/lib/poem-lines";
import { RareText } from "./RareText";

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
