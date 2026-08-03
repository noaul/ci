import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { LibraryProvider } from "@/app/_components/library/LibraryContext";
import { SiteShell } from "@/app/_components/SiteShell";
import { SCREEN_FAIL_OPEN_MS } from "@/lib/journey/failopen";
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
 * Marks the document as scripted before the body paints — and takes the mark
 * back if the scripts never arrive.
 *
 * Everything that depends on JavaScript hides behind `.js`: the folding screen,
 * the journey behind it, the served reading it covers. If the bundle has not
 * hydrated by the time the timer fires, the mark comes off and the document
 * becomes what it always was underneath — a complete poem with working
 * navigation. A reader is never left in front of a door that will not open.
 */
const BOOTSTRAP = `document.documentElement.classList.add("js");window.setTimeout(function(){if(!window.__ciReady)document.documentElement.classList.remove("js")},${SCREEN_FAIL_OPEN_MS})`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The class below is written by the inline script before React hydrates;
    // suppressing here keeps that legitimate pre-paint mutation from reading
    // as a mismatch, and nothing else about the element is dynamic.
    <html lang="zh-Hans" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col antialiased">
        <Script
          id="ci-enhancement-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: BOOTSTRAP }}
        />
        <a
          href="#main-content"
          className="sr-only fixed left-4 top-4 z-[60] bg-paper-raised px-3 py-2 text-sm text-ink shadow focus:not-sr-only"
        >
          跳至正文
        </a>
        <LibraryProvider>
          <SiteShell>{children}</SiteShell>
        </LibraryProvider>
      </body>
    </html>
  );
}
