import type { Metadata } from "next";
import Link from "@/app/_components/StaticLink";
import { Numeral } from "@/app/_components/Numeral";
import { getPoet, getVolumes } from "@/lib/content";

export const metadata: Metadata = { title: "丛书总目" };

const KIND_LABEL: Record<string, string> = {
  anthology: "词集",
  cipu: "词谱",
  cihua: "词话",
};

export default function VolumesPage() {
  const volumes = getVolumes();
  return (
    <div>
      <h1 className="ci-page-title">丛书总目</h1>
      <p className="ci-page-lede">全二十二册，上海古籍出版社。词集十五种、词谱二种、词话词论五种。</p>
      <ol className="mt-8 divide-y divide-rule">
        {volumes.map((volume, i) => {
          const poets = volume.poetIds.map(getPoet).filter((p) => p !== undefined);
          const href = volume.kind === "cihua" ? `/books/${volume.id}/` : `/volumes/${volume.id}/`;
          return (
            <li key={volume.id} className="flex items-baseline gap-4 py-3.5">
              <span className="w-6 shrink-0 text-xs text-ink-faint">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <Link href={href} className="font-kai text-lg hover:text-cinnabar">
                  {volume.title}
                </Link>
                <span className="ml-2 text-xs text-ink-faint">
                  {KIND_LABEL[volume.kind] ?? volume.kind}
                </span>
                {poets.length > 0 && (
                  <span className="mt-0.5 block text-xs text-ink-faint">
                    {poets.map((p) => (
                      <Link
                        key={p.id}
                        href={`/poets/${p.id}/`}
                        className="mr-3 hover:text-cinnabar"
                      >
                        {p.name} <Numeral value={p.poemCount} />首
                      </Link>
                    ))}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
