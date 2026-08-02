import type { Metadata } from "next";
import Link from "next/link";
import { getBookVolumes, getCihuaEntries, getCihuaSections } from "@/lib/content";

export const metadata: Metadata = { title: "词话·词论" };

/** Short notes on what each of the five prose volumes is. */
const BLURB: Record<string, string> = {
  "ren-jian-ci-hua": "王国维论词之作，标举「境界」说，为近代词学之枢纽。",
  "bai-yu-zhai-ci-hua": "清陈廷焯撰，主「沉郁」之说，逐条评骘唐宋以来诸家。",
  "ci-pin": "明杨慎撰，考词调源流、辨字句异同，多存佚闻。",
  "ci-shi": "刘毓盘撰，以史笔叙词之流变，为第一部词史专著。",
  "ci-xue-tong-lun": "吴梅撰，论平仄四声、词韵作法，兼评历代词家。",
};

export default function BooksPage() {
  const volumes = getBookVolumes();
  return (
    <div>
      <h1 className="text-2xl tracking-wide">词话·词论</h1>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-faint">
        丛书所收五种词学论著。所引词作凡见于本书者，皆已系联至该首词页。
      </p>

      <ul className="mt-8 divide-y divide-rule">
        {volumes.map((volume) => {
          const entries = getCihuaEntries(volume.id);
          const sections = getCihuaSections(volume.id);
          return (
            <li key={volume.id} className="py-4">
              <Link href={`/books/${volume.id}/`} className="group">
                <span className="font-kai text-xl group-hover:text-cinnabar">{volume.title}</span>
                <span className="ml-3 text-xs text-ink-faint">
                  {sections.length} 卷 · {entries.length} 则
                </span>
              </Link>
              {BLURB[volume.id] && (
                <p className="mt-1 text-sm leading-7 text-ink-soft">{BLURB[volume.id]}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
