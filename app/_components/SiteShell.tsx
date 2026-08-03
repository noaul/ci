"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { LibraryDrawer } from "@/app/_components/library/LibraryDrawer";
import Link from "@/app/_components/StaticLink";

/**
 * Everything around the reading, and nothing around the threshold.
 *
 * The home route is not a page with a header on it — it is a screen the reader
 * walks through, so it gets no masthead, no footer and no trigger until it has
 * opened one for itself. Every other route keeps the same compact masthead and
 * the same single drawer, on every viewport.
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    (window as Window & { __ciHydrated?: boolean }).__ciHydrated = true;
  }, []);

  if (pathname === "/") return <>{children}</>;

  return (
    <>
      <header className="ci-masthead">
        <Link href="/" className="ci-masthead-title">
          历代名家词集精华录
        </Link>
        <LibraryDrawer />
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl grow px-5 py-10">
        {children}
      </main>

      <footer className="ci-colophon">
        <p>
          文本据《历代名家词集精华录》（全二十二册），上海古籍出版社。所收词作为公有领域作品；
          注释、辑评及各册导读之著作权归原作者与出版社所有。
          <Link href="/about/" className="ml-2 whitespace-nowrap hover:text-cinnabar">
            版权与出处说明 →
          </Link>
        </p>
      </footer>
    </>
  );
}
