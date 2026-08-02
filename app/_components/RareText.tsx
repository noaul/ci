const TOKEN = /\{\{IMG:([^}]+)\}\}/g;

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
    if (index > last) parts.push(children.slice(last, index));
    parts.push(
      <img
        key={key++}
        src={`/glyphs/${m[1]}`}
        alt="[字]"
        className="inline-block h-[1em] w-auto translate-y-[0.08em] align-baseline dark:invert"
      />,
    );
    last = index + m[0].length;
  }
  if (last < children.length) parts.push(children.slice(last));

  return <>{parts}</>;
}

/** Plain-text fallback for titles and metadata, where an <img> cannot go. */
export function stripTokens(s: string): string {
  return s.replace(TOKEN, "□");
}
