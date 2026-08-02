import type { Metadata } from "next";
import Link from "@/app/_components/StaticLink";
import { notFound } from "next/navigation";
import { SectionHeading } from "@/app/_components/Annotations";
import { Numeral } from "@/app/_components/Numeral";
import { RareText, stripTokens } from "@/app/_components/RareText";
import { ToneLegend, ToneTemplate } from "@/app/_components/ToneTemplate";
import { firstLine, getPoemById, getTune, getTunes, poemHref } from "@/lib/content";

type Params = { tune: string };

export function generateStaticParams(): Params[] {
  return getTunes()
    .filter((t) => t.poemCount > 0 || t.sourceBooks.length > 0)
    .map((t) => ({ tune: t.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { tune: id } = await params;
  const tune = getTune(id);
  return tune
    ? { title: `词牌 ${tune.name}`, description: tune.description ?? `${tune.name}，本书收录 ${tune.poemCount} 首。` }
    : {};
}

export default async function TunePage({ params }: { params: Promise<Params> }) {
  const { tune: id } = await params;
  const tune = getTune(id);
  if (!tune) notFound();

  const poems = tune.poemIds.map(getPoemById).filter((p) => p !== undefined);

  return (
    <div>
      <header>
        <h1 className="ci-page-title">{tune.name}</h1>
        <p className="mt-2 text-sm text-ink-faint">
          {tune.charCount && (
            <>
              <Numeral value={tune.charCount} />字 ·{" "}
            </>
          )}
          本书收录 <Numeral value={tune.poemCount} /> 首
          {tune.category && <> · {tune.category}</>}
        </p>
        {tune.aliases.length > 0 && (
          <p className="mt-1 text-sm text-ink-soft">又名 {tune.aliases.join("、")}</p>
        )}
        {tune.relatedTune && (
          <p className="mt-1 text-sm text-ink-soft">
            《唐宋词格律》将此调附于{" "}
            <Link href={`/tunes/${tune.relatedTune.id}/`} className="text-cinnabar hover:underline">
              {tune.relatedTune.name}
            </Link>{" "}
            条下，然字数有别，此处别为一调。
          </p>
        )}
      </header>

      {tune.description && (
        <p className="mt-6 leading-8 text-ink-soft">
          <RareText>{tune.description}</RareText>
        </p>
      )}

      {tune.patterns.length > 0 && (
        <section className="mt-12">
          <SectionHeading>格律（唐宋词格律）</SectionHeading>
          <div className="mt-5 space-y-8">
            {tune.patterns.map((pattern, i) => (
              <div key={i}>
                <h3 className="text-sm text-seal">{pattern.label}</h3>
                <p className="mt-2 break-all font-kai text-lg leading-9 text-ink-soft">
                  {pattern.tones}
                </p>
                {pattern.examples.map((ex, j) => (
                  <figure key={j} className="ci-quote mt-4">
                    <figcaption className="text-xs text-ink-faint">{ex.label}</figcaption>
                    <p className="mt-1 font-kai text-lg leading-9">
                      {[...ex.text].map((ch, k) => (
                        <span
                          key={k}
                          className={
                            ex.rhymeIndexes.includes(k)
                              ? "text-cinnabar"
                              : ex.breakIndexes.includes(k)
                                ? "underline decoration-seal underline-offset-4"
                                : undefined
                          }
                        >
                          {ch}
                        </span>
                      ))}
                    </p>
                    {ex.author && <p className="mt-1 text-xs text-ink-faint">—— {ex.author}</p>}
                  </figure>
                ))}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-ink-faint">
            例词中<span className="text-cinnabar">朱色</span>为韵脚，
            <span className="underline decoration-seal underline-offset-4">加线</span>为句。
          </p>
        </section>
      )}

      {tune.baixiang && (
        <section className="mt-14">
          <SectionHeading>词谱（白香词谱）</SectionHeading>
          {tune.baixiang.variants.map((variant, i) => (
            <div key={i} className="mt-6">
              <h3 className="text-sm text-ink-soft">
                {variant.label ?? `${tune.baixiang!.name}${tune.baixiang!.title ? `·${tune.baixiang!.title}` : ""}`}
                {variant.author && (
                  <span className="ml-2 text-xs text-ink-faint">{variant.author}</span>
                )}
              </h3>
              <div className="mt-3">
                <ToneTemplate stanzas={variant.stanzas} />
              </div>
            </div>
          ))}
          <div className="mt-5">
            <ToneLegend />
          </div>

          {tune.baixiang.notes.length > 0 && (
            <ul className="mt-6 space-y-1.5 text-[0.9375rem] leading-7 text-ink-soft">
              {tune.baixiang.notes.map((note) => (
                <li key={note.n}>
                  <span className="mr-1 text-ink-faint">[{note.n}]</span>
                  <RareText>{note.text}</RareText>
                </li>
              ))}
            </ul>
          )}
          {tune.baixiang.analysis && (
            <div className="mt-6">
              <h3 className="text-sm text-seal">评析</h3>
              <p className="mt-2 leading-8 text-ink-soft">
                <RareText>{tune.baixiang.analysis}</RareText>
              </p>
            </div>
          )}
          {tune.baixiang.remark && (
            <div className="mt-6">
              <h3 className="text-sm text-seal">说明</h3>
              <p className="mt-2 leading-8 text-ink-soft">
                <RareText>{tune.baixiang.remark}</RareText>
              </p>
            </div>
          )}
        </section>
      )}

      {poems.length > 0 && (
        <section className="mt-14">
          <SectionHeading>
            本书所收（
            <Numeral value={poems.length} /> 首）
          </SectionHeading>
          <ul className="mt-4 divide-y divide-rule">
            {poems.map((poem) => (
              <li key={poem.id} className="deferred-list-item">
                <Link href={poemHref(poem)} className="group flex items-baseline gap-3 py-2.5">
                  <span className="w-16 shrink-0 text-sm text-ink-faint">{poem.poet}</span>
                  {poem.title && (
                    <span className="shrink-0 text-sm text-ink-soft">
                      <RareText>{poem.title}</RareText>
                    </span>
                  )}
                  <span className="truncate text-[0.9375rem] group-hover:text-cinnabar">
                    {stripTokens(firstLine(poem))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
