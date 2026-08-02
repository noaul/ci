import type { Metadata } from "next";
import Link from "@/app/_components/StaticLink";
import { Numeral } from "@/app/_components/Numeral";
import { getPoets } from "@/lib/content";

export const metadata: Metadata = { title: "词人" };

export default function PoetsPage() {
  const poets = getPoets();
  return (
    <div>
      <h1 className="ci-page-title">词人</h1>
      <p className="ci-page-lede">
        按丛书次第排列，自晚唐迄清，共 <Numeral value={poets.length} /> 家。
      </p>
      <ul className="mt-8 divide-y divide-rule">
        {poets.map((poet) => (
          <li key={poet.id} className="deferred-list-item">
            <Link
              href={`/poets/${poet.id}/`}
              className="group flex items-baseline justify-between gap-4 py-3.5"
            >
              <span>
                <span className="font-kai text-xl group-hover:text-cinnabar">
                  {poet.name}
                </span>
                <span className="ml-3 text-xs text-ink-faint">
                  {poet.dynasty}
                  {poet.lifespan ? ` ${poet.lifespan}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-sm text-ink-soft">
                <Numeral value={poet.poemCount} tabular /> 首
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
