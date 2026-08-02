import type { Metadata } from "next";
import Link from "@/app/_components/StaticLink";
import { notFound } from "next/navigation";
import { CommentaryList, NoteList } from "@/app/_components/Annotations";
import { Numeral } from "@/app/_components/Numeral";
import { PoemBody } from "@/app/_components/PoemBody";
import { RareText, stripTokens } from "@/app/_components/RareText";
import {
  charCount,
  getAllPoems,
  getNeighbours,
  getPoem,
  getPoet,
  getTuneByName,
  getVolume,
  poemHref,
} from "@/lib/content";

type Params = { poet: string; slug: string };

export function generateStaticParams(): Params[] {
  return getAllPoems().map((p) => {
    const [poet = "", slug = ""] = p.id.split("/");
    return { poet, slug };
  });
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { poet, slug } = await params;
  const poem = getPoem(poet, slug);
  if (!poem) return {};
  const title = `${poem.tune}${poem.title ? `·${stripTokens(poem.title)}` : ""}`;
  return {
    title: `${title} — ${poem.poet}`,
    description: stripTokens(poem.stanzas.flat().join("")).slice(0, 80),
  };
}

export default async function PoemPage({ params }: { params: Promise<Params> }) {
  const { poet: poetId, slug } = await params;
  const poem = getPoem(poetId, slug);
  if (!poem) notFound();

  const poet = getPoet(poem.poetId);
  const volume = getVolume(poem.volumeId);
  const tune = getTuneByName(poem.tune);
  const { prev, next } = getNeighbours(poem);

  return (
    <article>
      <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
        <Link href={`/poets/${poem.poetId}/`} className="hover:text-cinnabar">
          {poem.poet}
        </Link>
        <span aria-hidden>·</span>
        <span>{poem.juan}</span>
        {volume && (
          <>
            <span aria-hidden>·</span>
            <Link href={`/volumes/${volume.id}/`} className="hover:text-cinnabar">
              {volume.title}
            </Link>
          </>
        )}
      </nav>

      <header className="mt-4">
        <h1 className="font-kai text-3xl sm:text-4xl">
          {tune ? (
            <Link href={`/tunes/${tune.id}/`} className="hover:text-cinnabar">
              {poem.tune}
            </Link>
          ) : (
            poem.tune
          )}
          {poem.title && (
            <span className="ml-3 text-xl text-ink-soft sm:text-2xl">
              <RareText>{poem.title}</RareText>
            </span>
          )}
        </h1>
        <p className="mt-2 text-sm text-ink-faint">
          {poet && (
            <>
              〔{poet.dynasty}〕{poet.name}
            </>
          )}
          <span className="mx-2" aria-hidden>
            ·
          </span>
          <Numeral value={charCount(poem)} />字
          {poem.tuneRepeated && (
            <>
              <span className="mx-2" aria-hidden>
                ·
              </span>
              <span title="原书作「又」，承前一首词调">调同前首</span>
            </>
          )}
        </p>
      </header>

      {poem.preface && (
        <p className="ci-quote mt-6 font-kai text-[0.9375rem] leading-8 text-ink-soft">
          <RareText>{poem.preface}</RareText>
        </p>
      )}

      <div className="mt-8">
        <PoemBody stanzas={poem.stanzas} />
      </div>

      {tune && (tune.sourceBooks.length > 0 || tune.poemCount > 1) && (
        <section className="ci-panel mt-10 text-sm leading-7 text-ink-soft">
          <Link href={`/tunes/${tune.id}/`} className="text-cinnabar hover:underline">
            词牌「{tune.name}」
          </Link>
          {tune.charCount && (
            <span className="ml-3">
              <Numeral value={tune.charCount} />字
            </span>
          )}
          {tune.poemCount > 1 && (
            <span className="ml-3">
              本书收录 <Numeral value={tune.poemCount} /> 首
            </span>
          )}
          {tune.sourceBooks.length > 0 && (
            <span className="ml-3 text-ink-faint">格律见《{tune.sourceBooks.join("》《")}》</span>
          )}
        </section>
      )}

      <NoteList notes={poem.notes} />
      <CommentaryList commentary={poem.commentary} />

      <nav className="mt-14 flex items-stretch justify-between gap-4 border-t border-rule pt-5 text-sm">
        {prev ? (
          <Link href={poemHref(prev)} className="group max-w-[45%] text-left">
            <span className="block text-xs text-ink-faint">前一首</span>
            <span className="block truncate group-hover:text-cinnabar">
              {prev.tune}
              {prev.title ? `·${stripTokens(prev.title)}` : ""}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={poemHref(next)} className="group max-w-[45%] text-right">
            <span className="block text-xs text-ink-faint">后一首</span>
            <span className="block truncate group-hover:text-cinnabar">
              {next.tune}
              {next.title ? `·${stripTokens(next.title)}` : ""}
            </span>
          </Link>
        )}
      </nav>
    </article>
  );
}
