import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeading } from "@/app/_components/Annotations";
import { RareText } from "@/app/_components/RareText";
import {
  getBookVolumes,
  getCihuaEntriesBySection,
  getCihuaSections,
  getProseForVolume,
  getVolume,
  sectionSlug,
} from "@/lib/content";

type Params = { volume: string };

export function generateStaticParams(): Params[] {
  return getBookVolumes().map((v) => ({ volume: v.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { volume: id } = await params;
  const volume = getVolume(id);
  return volume ? { title: volume.title } : {};
}

export default async function BookPage({ params }: { params: Promise<Params> }) {
  const { volume: id } = await params;
  const volume = getVolume(id);
  if (!volume) notFound();

  const sections = getCihuaSections(volume.id);
  const prose = getProseForVolume(volume.id);

  return (
    <div>
      <header>
        <h1 className="font-kai text-3xl tracking-wide">{volume.title}</h1>
        <p className="mt-2 text-sm text-ink-faint">
          {sections.length} 卷 ·{" "}
          {sections.reduce((n, s) => n + getCihuaEntriesBySection(volume.id, s).length, 0)} 则
        </p>
      </header>

      <ul className="mt-8 divide-y divide-rule">
        {sections.map((section) => (
          <li key={section}>
            <Link
              href={`/books/${volume.id}/${sectionSlug(volume.id, section)}/`}
              className="group flex items-baseline justify-between gap-4 py-3"
            >
              <span className="font-kai text-lg group-hover:text-cinnabar">{section}</span>
              <span className="shrink-0 text-sm text-ink-soft">
                {getCihuaEntriesBySection(volume.id, section).length} 则
              </span>
            </Link>
          </li>
        ))}
      </ul>

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
                <p key={i} className="leading-8 text-ink-soft">
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
