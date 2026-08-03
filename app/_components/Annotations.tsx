import { COMMENTARY_ANCHOR, NOTES_ANCHOR } from "@/lib/library";
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
    <section id={NOTES_ANCHOR} className="mt-10 scroll-mt-20">
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
    <section id={COMMENTARY_ANCHOR} className="mt-10 scroll-mt-20">
      <SectionHeading>辑评</SectionHeading>
      <div className="mt-3 space-y-4">
        {commentary.map((c, i) => (
          <figure key={i} className="ci-quote text-[0.9375rem] leading-7 text-ink-soft">
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

/**
 * A compact section mark — a cinnabar tick, the label, then a rule out to the
 * margin. Sized to sit under a page title without competing with it.
 */
export function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="ci-eyebrow">{children}</h2>;
}
