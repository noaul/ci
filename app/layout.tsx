import type { Metadata, Viewport } from "next";
import { Numeral } from "@/app/_components/Numeral";
import { SiteNav } from "@/app/_components/SiteNav";
import Link from "@/app/_components/StaticLink";
import { getSiteStats } from "@/lib/content";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "历代名家词集精华录",
    template: "%s — 历代名家词集精华录",
  },
  description:
    "《历代名家词集精华录》全二十二册的在线读本：三千五百余首词，附历代辑评、注释、词谱格律与词话。",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f2e8" },
    { media: "(prefers-color-scheme: dark)", color: "#16130f" },
  ],
};

/**
 * Marks the document as scripted before the body paints.
 *
 * Everything that depends on JavaScript being there — the home stage drawing
 * its scene after hydration — hides behind this class, so a reader without
 * scripts is served the plain, complete document and never a curtain that
 * will not rise.
 */
const MARK_SCRIPTED = 'document.documentElement.classList.add("js")';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const stats = getSiteStats();

  return (
    // The class below is written by the inline script before React hydrates;
    // suppressing here keeps that legitimate pre-paint mutation from reading
    // as a mismatch, and nothing else about the element is dynamic.
    <html lang="zh-Hans" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col antialiased">
        <script dangerouslySetInnerHTML={{ __html: MARK_SCRIPTED }} />

        <a
          href="#main-content"
          className="sr-only fixed left-4 top-4 z-50 bg-paper-raised px-3 py-2 text-sm text-ink shadow focus:not-sr-only"
        >
          跳至正文
        </a>

        <header className="border-b border-rule">
          <div className="mx-auto flex max-w-5xl flex-wrap items-baseline gap-x-6 gap-y-2 px-5 py-4">
            <Link href="/" className="font-kai text-lg text-ink hover:text-cinnabar">
              历代名家词集精华录
            </Link>
            <SiteNav />
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl grow px-5 py-10">
          {children}
        </main>

        <footer className="mt-16 border-t border-rule">
          <div className="mx-auto max-w-5xl px-5 py-8">
            <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
              <SiteNav label="页脚导航" />
              <p className="text-xs text-ink-faint">
                共 <Numeral value={stats.poems} /> 首词 · <Numeral value={stats.poets} /> 家 ·{" "}
                <Numeral value={stats.volumes} /> 册
              </p>
            </div>

            <p className="mt-5 max-w-3xl text-xs leading-relaxed text-ink-faint">
              文本据《历代名家词集精华录》（全二十二册），上海古籍出版社。所收词作为公有领域作品；
              注释、辑评及各册导读之著作权归原作者与出版社所有。
              <Link href="/about/" className="ml-2 whitespace-nowrap hover:text-cinnabar">
                版权与出处说明 →
              </Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
