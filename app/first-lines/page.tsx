import type { Metadata } from "next";
import Link from "@/app/_components/StaticLink";
import { Numeral } from "@/app/_components/Numeral";
import { getFirstLineInitials, getFirstLines, getFirstLinesByInitial } from "@/lib/content";

export const metadata: Metadata = { title: "首句索引" };

/**
 * 首句索引 — the traditional way into a ci collection.
 *
 * A reader almost always remembers the opening line rather than the 词牌. The
 * corpus is split by pinyin initial so each page stays small; listing all
 * 3,500 first lines at once produced a multi-megabyte document.
 */
export default function FirstLinesPage() {
  const initials = getFirstLineInitials();
  const total = getFirstLines().length;

  return (
    <div>
      <h1 className="ci-page-title">首句索引</h1>
      <p className="ci-page-lede">
        共 <Numeral value={total} /> 首，按首句首字拼音分部。
      </p>

      <ul className="mt-8 grid grid-cols-2 gap-x-8 sm:grid-cols-3 lg:grid-cols-4">
        {initials.map((initial) => (
          <li key={initial}>
            <Link
              href={`/first-lines/${initial === "#" ? "other" : initial.toLowerCase()}/`}
              className="ci-cell group"
            >
              <span className="text-xl group-hover:text-cinnabar">{initial}</span>
              <span className="text-xs text-ink-faint">
                <Numeral value={getFirstLinesByInitial(initial).length} tabular />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
