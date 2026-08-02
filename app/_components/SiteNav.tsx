"use client";

import { usePathname } from "next/navigation";
import Link from "@/app/_components/StaticLink";
import { navCurrent } from "@/lib/navigation";

export const NAV = [
  { href: "/poets/", label: "词人" },
  { href: "/tunes/", label: "词牌" },
  { href: "/books/", label: "词话" },
  { href: "/volumes/", label: "丛书" },
  { href: "/first-lines/", label: "首句" },
];

/**
 * The one navigation, marked with where the reader is.
 *
 * A poem page sits under its poet, a 词话 section under its book, so the mark
 * follows the path prefix rather than an exact match — otherwise the reader
 * loses their place as soon as they open anything.
 */
export function SiteNav({ label = "主导航" }: { label?: string }) {
  const pathname = usePathname() ?? "/";

  return (
    <nav aria-label={label} className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={navCurrent(pathname, item.href)}
          className="ci-nav-link"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
