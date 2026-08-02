import type { Metadata } from "next";
import Link from "@/app/_components/StaticLink";
import { Numeral } from "@/app/_components/Numeral";
import { getTunes } from "@/lib/content";

export const metadata: Metadata = { title: "词牌" };

export default function TunesPage() {
  const tunes = getTunes().filter((t) => t.poemCount > 0 || t.sourceBooks.length > 0);
  const withTemplate = tunes.filter((t) => t.sourceBooks.length > 0);

  return (
    <div>
      <h1 className="ci-page-title">词牌</h1>
      <p className="ci-page-lede">
        共 <Numeral value={tunes.length} /> 调，其中 <Numeral value={withTemplate.length} />{" "}
        调可在《唐宋词格律》或《白香词谱》查得格律谱。按本书收词多寡排列。
      </p>

      <ul className="mt-8 divide-y divide-rule">
        {tunes.map((tune) => (
          <li key={tune.id} className="deferred-list-item">
            <Link
              href={`/tunes/${tune.id}/`}
              className="group flex items-baseline justify-between gap-4 py-3"
            >
              <span className="min-w-0">
                <span className="font-kai text-lg group-hover:text-cinnabar">
                  {tune.name}
                </span>
                {tune.charCount && (
                  <span className="ml-2 text-xs text-ink-faint">
                    <Numeral value={tune.charCount} />字
                  </span>
                )}
                {tune.aliases.length > 0 && (
                  <span className="ml-2 truncate text-xs text-ink-faint">
                    又名 {tune.aliases.slice(0, 3).join("、")}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-baseline gap-3 text-sm text-ink-soft">
                {tune.sourceBooks.length > 0 && (
                  <span
                    className="text-xs text-seal"
                    title={`格律见《${tune.sourceBooks.join("》《")}》`}
                  >
                    有谱
                  </span>
                )}
                <span>
                  <Numeral value={tune.poemCount} tabular /> 首
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
