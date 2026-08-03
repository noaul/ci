import type { RarePart } from "@/lib/rare";

/**
 * Render already-split text: runs of characters, and the rare glyphs the
 * source book had to print as pictures.
 *
 * Deliberately free of Node imports so the reading pages and the client-side
 * journey draw a rare character exactly the same way — the only difference is
 * who decided the asset was there.
 */
export function RareParts({ parts }: { parts: RarePart[] }) {
  return (
    <>
      {parts.map((part, i) =>
        part.kind === "text" ? (
          part.text
        ) : part.available ? (
          <img
            key={i}
            src={`/glyphs/${part.file}`}
            alt="罕见字"
            title={`原书字形（${part.file}）`}
            width={24}
            height={24}
            loading="lazy"
            decoding="async"
            className="inline-block h-[1em] w-auto translate-y-[0.08em] align-baseline dark:invert"
          />
        ) : (
          <span
            key={i}
            role="img"
            aria-label="原书字形资源缺失"
            title={`原书字形资源缺失：${part.file || "未知文件"}`}
            data-missing-glyph={part.file || "unknown"}
            className="inline-block min-w-[1em] text-center text-cinnabar"
          >
            □
          </span>
        ),
      )}
    </>
  );
}
