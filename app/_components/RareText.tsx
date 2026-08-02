import { readdirSync } from "node:fs";
import { join } from "node:path";

const TOKEN = /\{\{IMG:([^}]+)\}\}/g;
const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const availableGlyphs = (() => {
  try {
    return new Set(
      readdirSync(join(process.cwd(), "public", "glyphs"), { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name),
    );
  } catch {
    return new Set<string>();
  }
})();

/**
 * Render text that may contain rare-character image tokens.
 *
 * Around 90 characters fall outside the ebook's embedded font and are printed
 * as images. They are kept as {{IMG:file}} tokens through the pipeline and
 * rendered inline here at the surrounding text's size, so a line like
 * 宋傅[藻]《东坡纪年录》 reads correctly even before a Unicode mapping exists.
 */
export function RareText({ children }: { children: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const m of children.matchAll(TOKEN)) {
    const index = m.index ?? 0;
    const file = m[1] ?? "";
    if (index > last) parts.push(children.slice(last, index));
    if (SAFE_FILE.test(file) && availableGlyphs.has(file)) {
      parts.push(
        <img
          key={key++}
          src={`/glyphs/${file}`}
          alt="罕见字"
          title={`原书字形（${file}）`}
          width={24}
          height={24}
          loading="lazy"
          decoding="async"
          className="inline-block h-[1em] w-auto translate-y-[0.08em] align-baseline dark:invert"
        />,
      );
    } else {
      parts.push(
        <span
          key={key++}
          role="img"
          aria-label="原书字形资源缺失"
          title={`原书字形资源缺失：${file || "未知文件"}`}
          data-missing-glyph={file || "unknown"}
          className="inline-block min-w-[1em] text-center text-cinnabar"
        >
          □
        </span>,
      );
    }
    last = index + m[0].length;
  }
  if (last < children.length) parts.push(children.slice(last));

  return <>{parts}</>;
}

/** Plain-text fallback for titles and metadata, where an <img> cannot go. */
export function stripTokens(s: string): string {
  return s.replace(TOKEN, "□");
}
