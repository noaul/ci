import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "历代名家词集精华录",
    template: "%s — 历代名家词集精华录",
  },
  description:
    "《历代名家词集精华录》全二十二册的在线读本：三千五百余首词，附历代辑评、注释、词谱格律与词话。",
};

const NAV = [
  { href: "/poets/", label: "词人" },
  { href: "/tunes/", label: "词牌" },
  { href: "/books/", label: "词话" },
  { href: "/volumes/", label: "丛书" },
  { href: "/first-lines/", label: "首句" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hans">
      <body className="min-h-screen antialiased">
        <header className="border-b border-rule">
          <div className="mx-auto flex max-w-5xl flex-wrap items-baseline gap-x-6 gap-y-2 px-5 py-4">
            <Link href="/" className="text-lg tracking-wide text-ink hover:text-cinnabar">
              历代名家词集精华录
            </Link>
            <nav className="flex gap-5 text-sm text-ink-soft">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-cinnabar">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-5 py-10">{children}</main>

        <footer className="mt-16 border-t border-rule">
          <div className="mx-auto max-w-5xl px-5 py-8 text-xs leading-relaxed text-ink-faint">
            <p>
              文本据《历代名家词集精华录》（全二十二册），上海古籍出版社。所收词作为公有领域作品；
              注释、辑评及各册导读之著作权归原作者与出版社所有。
            </p>
            <p className="mt-2">
              <Link href="/about/" className="hover:text-cinnabar">
                版权与出处说明
              </Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
