import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFirstLineInitials, getFirstLinesByInitial } from "@/lib/content";

type Params = { initial: string };

const toSlug = (initial: string) => (initial === "#" ? "other" : initial.toLowerCase());
const fromSlug = (slug: string) => (slug === "other" ? "#" : slug.toUpperCase());

export function generateStaticParams(): Params[] {
  return getFirstLineInitials().map((initial) => ({ initial: toSlug(initial) }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { initial } = await params;
  return { title: `首句索引 ${fromSlug(initial)}` };
}

export default async function FirstLineGroupPage({ params }: { params: Promise<Params> }) {
  const { initial: slug } = await params;
  const initial = fromSlug(slug);
  const entries = getFirstLinesByInitial(initial);
  if (entries.length === 0) notFound();

  const initials = getFirstLineInitials();

  return (
    <div>
      <nav className="text-xs text-ink-faint">
        <Link href="/first-lines/" className="hover:text-cinnabar">
          首句索引
        </Link>
      </nav>

      <h1 className="mt-3 text-2xl">
        {initial}
        <span className="ml-3 text-sm text-ink-faint">{entries.length} 首</span>
      </h1>

      <nav className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-soft">
        {initials.map((other) => (
          <Link
            key={other}
            href={`/first-lines/${toSlug(other)}/`}
            className={other === initial ? "text-cinnabar" : "hover:text-cinnabar"}
          >
            {other}
          </Link>
        ))}
      </nav>

      <ul className="mt-8 grid gap-x-8 sm:grid-cols-2">
        {entries.map((entry) => (
          <li key={entry.id} className="deferred-list-item min-w-0">
            <Link
              href={`/poems/${entry.id}/`}
              className="group flex items-baseline gap-2 py-1 text-sm"
            >
              <span className="truncate group-hover:text-cinnabar">{entry.line}</span>
              <span className="shrink-0 text-xs text-ink-faint">
                {entry.tune}·{entry.poet}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
