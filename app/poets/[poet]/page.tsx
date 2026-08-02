import type { Metadata } from "next";
import Link from "@/app/_components/StaticLink";
import { notFound } from "next/navigation";
import { SectionHeading } from "@/app/_components/Annotations";
import { Numeral } from "@/app/_components/Numeral";
import { RareText, stripTokens } from "@/app/_components/RareText";
import {
  firstLine,
  getPoemsByPoet,
  getPoet,
  getPoets,
  getProseForPoet,
  poemHref,
} from "@/lib/content";

type Params = { poet: string };

export function generateStaticParams(): Params[] {
  return getPoets().map((p) => ({ poet: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { poet: id } = await params;
  const poet = getPoet(id);
  return poet ? { title: poet.name, description: `${poet.name}词集，共 ${poet.poemCount} 首。` } : {};
}

export default async function PoetPage({ params }: { params: Promise<Params> }) {
  const { poet: id } = await params;
  const poet = getPoet(id);
  if (!poet) notFound();

  const poems = getPoemsByPoet(poet.id);
  const prose = getProseForPoet(poet.id);

  // 卷 groupings in the order the book prints them.
  const juanOrder: string[] = [];
  const byJuan = new Map<string, typeof poems>();
  for (const p of poems) {
    let list = byJuan.get(p.juan);
    if (!list) {
      byJuan.set(p.juan, (list = []));
      juanOrder.push(p.juan);
    }
    list.push(p);
  }

  return (
    <div>
      <header>
        <h1 className="ci-page-title">{poet.name}</h1>
        <p className="mt-2 text-sm text-ink-faint">
          {poet.dynasty}
          {poet.lifespan ? ` · ${poet.lifespan}` : ""} · 收词 <Numeral value={poet.poemCount} /> 首
        </p>
      </header>

      {juanOrder.map((juan) => (
        <section key={juan} className="mt-12">
          <SectionHeading>{juan}</SectionHeading>
          <ul className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {(byJuan.get(juan) ?? []).map((poem) => (
              <li key={poem.id} className="deferred-list-item min-w-0">
                <Link
                  href={poemHref(poem)}
                  className="group flex items-baseline gap-2 py-1 text-[0.9375rem]"
                >
                  <span className="shrink-0 font-kai group-hover:text-cinnabar">
                    {poem.tune}
                  </span>
                  {poem.title && (
                    <span className="shrink-0 text-xs text-ink-soft">
                      <RareText>{poem.title}</RareText>
                    </span>
                  )}
                  <span className="truncate text-xs text-ink-faint">
                    {stripTokens(firstLine(poem))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {prose.map((doc) => (
        <section key={doc.id} className="mt-14">
          <SectionHeading>{doc.title}</SectionHeading>
          <div className="mt-4 space-y-3">
            {doc.blocks.map((block, i) =>
              block.type === "heading" ? (
                <h3 key={i} className="pt-3 font-kai text-lg">
                  {block.text}
                </h3>
              ) : (
                <p key={i} className="text-[0.9375rem] leading-7 text-ink-soft">
                  {block.source && (
                    <b className="mr-2 font-normal text-cinnabar">
                      <RareText>{block.source}</RareText>
                    </b>
                  )}
                  <RareText>{block.text}</RareText>
                </p>
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
