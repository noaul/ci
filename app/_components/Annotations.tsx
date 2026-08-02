import type { Annotation } from "@/pipeline/src/types";
import { RareText } from "./RareText";

/**
 * ◎ notes — allusion sources and the editor's own word glosses.
 *
 * Set compactly, like a reference apparatus: a glossed headword leads its
 * entry in cinnabar, a quoted allusion carries its 出处 inline.
 */
export function NoteList({ notes }: { notes: Annotation[] }) {
  if (notes.length === 0) return null;
  return (
    <section className="mt-10">
      <SectionHeading>注释</SectionHeading>
      <ul className="mt-3 space-y-2.5">
        {notes.map((note, i) => (
          <li key={i} className="text-[0.9375rem] leading-7 text-ink-soft">
            {note.headword && (
              <b className="font-normal text-cinnabar">{note.headword}</b>
            )}
            <RareText>
              {note.headword ? note.text.slice(note.headword.length) : note.text}
            </RareText>
            {note.source && (
              <cite className="ml-1 not-italic text-ink-faint">
                （<RareText>{note.source}</RareText>）
              </cite>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * ◆ 历代辑评 — collected criticism, from Song colophons to 20th-century scholars.
 *
 * Given as separate quoted voices rather than a run-on list: each is a distinct
 * critic reading the same poem, and the attribution is the point.
 */
export function CommentaryList({ commentary }: { commentary: Annotation[] }) {
  if (commentary.length === 0) return null;
  return (
    <section className="mt-10">
      <SectionHeading>辑评</SectionHeading>
      <div className="mt-3 space-y-4">
        {commentary.map((c, i) => (
          <figure
            key={i}
            className="border-l-2 border-rule pl-4 text-[0.9375rem] leading-7 text-ink-soft"
          >
            <blockquote className="whitespace-pre-line">
              <RareText>{c.text}</RareText>
            </blockquote>
            {c.source && (
              <figcaption className="mt-1.5 text-[0.8125rem] text-ink-faint">
                —— <RareText>{c.source}</RareText>
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-sm tracking-[0.25em] text-ink-faint">
      <span>{children}</span>
      <span aria-hidden className="h-px flex-1 bg-rule" />
    </h2>
  );
}
