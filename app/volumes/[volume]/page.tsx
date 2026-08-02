import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeading } from "@/app/_components/Annotations";
import { RareText } from "@/app/_components/RareText";
import { getPoet, getVolume, getVolumes, getProseForVolume } from "@/lib/content";

type Params = { volume: string };

export function generateStaticParams(): Params[] {
  return getVolumes().map((v) => ({ volume: v.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { volume: id } = await params;
  const volume = getVolume(id);
  return volume ? { title: volume.title } : {};
}

export default async function VolumePage({ params }: { params: Promise<Params> }) {
  const { volume: id } = await params;
  const volume = getVolume(id);
  if (!volume) notFound();

  const poets = volume.poetIds.map(getPoet).filter((p) => p !== undefined);
  const prose = getProseForVolume(volume.id);

  return (
    <div>
      <header>
        <h1 className="font-kai text-3xl">{volume.title}</h1>
        {volume.label !== volume.title && (
          <p className="mt-1 text-sm text-ink-faint">{volume.label}</p>
        )}
        <p className="mt-2 text-sm text-ink-faint">
          第 {volume.order + 1} 册
          {volume.poemCount > 0 && <> · 收词 {volume.poemCount} 首</>}
        </p>
      </header>

      {poets.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
          {poets.map((poet) => (
            <li key={poet.id}>
              <Link href={`/poets/${poet.id}/`} className="group">
                <span className="font-kai text-lg group-hover:text-cinnabar">{poet.name}</span>
                <span className="ml-2 text-xs text-ink-faint">{poet.poemCount} 首</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

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
