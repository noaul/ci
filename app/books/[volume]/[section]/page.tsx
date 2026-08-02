import type { Metadata } from "next";
import Link from "@/app/_components/StaticLink";
import { notFound } from "next/navigation";
import { Numeral } from "@/app/_components/Numeral";
import { RareText } from "@/app/_components/RareText";
import {
  getBookVolumes,
  getCihuaEntriesBySection,
  getCihuaSections,
  getVolume,
  sectionSlug,
} from "@/lib/content";

type Params = { volume: string; section: string };

export function generateStaticParams(): Params[] {
  return getBookVolumes().flatMap((v) =>
    getCihuaSections(v.id).map((s) => ({ volume: v.id, section: sectionSlug(v.id, s) })),
  );
}

function resolve(volumeId: string, slug: string): string | undefined {
  return getCihuaSections(volumeId).find((s) => sectionSlug(volumeId, s) === slug);
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { volume, section } = await params;
  const name = resolve(volume, section);
  const title = getVolume(volume)?.title;
  return name ? { title: `${name} — ${title}` } : {};
}

export default async function BookSectionPage({ params }: { params: Promise<Params> }) {
  const { volume: volumeId, section: slug } = await params;
  const volume = getVolume(volumeId);
  const section = resolve(volumeId, slug);
  if (!volume || !section) notFound();

  const entries = getCihuaEntriesBySection(volumeId, section);
  const sections = getCihuaSections(volumeId);

  return (
    <div>
      <nav className="text-xs text-ink-faint">
        <Link href="/books/" className="hover:text-cinnabar">
          词话·词论
        </Link>
        <span className="mx-2" aria-hidden>
          ·
        </span>
        <Link href={`/books/${volumeId}/`} className="hover:text-cinnabar">
          {volume.title}
        </Link>
      </nav>

      <h1 className="ci-page-title mt-3">{section}</h1>
      <p className="mt-1 text-sm text-ink-faint">
        <Numeral value={entries.length} /> 则
      </p>

      <div className="mt-10 space-y-8">
        {entries.map((entry) => (
          <article
            key={entry.id}
            id={entry.id.split("/")[1]}
            className="deferred-prose-entry"
          >
            {(entry.ordinal || entry.heading) && (
              <h2 className="font-kai text-lg">
                {entry.ordinal && <span className="text-cinnabar">【{entry.ordinal}】</span>}
                {entry.heading && <span className="ml-1">{entry.heading}</span>}
              </h2>
            )}

            {entry.paragraphs.map((p, i) => (
              <p key={i} className="mt-2 leading-8 text-ink-soft">
                <RareText>{p}</RareText>
              </p>
            ))}

            {entry.quotes.map((quote, i) => (
              <figure key={i} className="ci-quote mt-4 py-1">
                <figcaption className="text-xs text-ink-faint">
                  {quote.poemId ? (
                    <Link href={`/poems/${quote.poemId}/`} className="hover:text-cinnabar">
                      {quote.title}
                      {quote.author && <span className="ml-2">{quote.author}</span>}
                      <span className="ml-2 text-cinnabar">→ 读全词</span>
                    </Link>
                  ) : (
                    <>
                      {quote.title}
                      {quote.author && <span className="ml-2">{quote.author}</span>}
                    </>
                  )}
                </figcaption>
                <div className="mt-1.5 font-kai text-lg leading-9">
                  {quote.lines.map((line, j) => (
                    <p key={j}>
                      <RareText>{line}</RareText>
                    </p>
                  ))}
                </div>
              </figure>
            ))}

            {entry.footnotes.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm leading-7 text-ink-faint">
                {entry.footnotes.map((note) => (
                  <li key={note.n}>
                    [{note.n}] <RareText>{note.text}</RareText>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>

      <nav className="mt-14 flex flex-wrap gap-x-4 gap-y-2 border-t border-rule pt-5 text-sm text-ink-soft">
        {sections.map((other) => (
          <Link
            key={other}
            href={`/books/${volumeId}/${sectionSlug(volumeId, other)}/`}
            className={other === section ? "text-cinnabar" : "hover:text-cinnabar"}
          >
            {other}
          </Link>
        ))}
      </nav>
    </div>
  );
}
