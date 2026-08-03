import { PoeticJourney } from "@/app/_components/journey/PoeticJourney";
import Link from "@/app/_components/StaticLink";
import { LIBRARY_SECTIONS } from "@/lib/library";
import { getStageThemes } from "@/lib/stage/themes";

/**
 * 入词.
 *
 * Not an index with a picture on it: a screen the reader walks through. The
 * document the server sends carries the threshold and one complete 词 — the
 * first is what a browser with scripts shows, the second is what a browser
 * without them shows, and neither ever leaves the reader looking at a door
 * that will not open.
 */
export default function HomePage() {
  const themes = getStageThemes();
  const served = themes[0];
  if (!served) throw new Error("The journey has no prepared scene to serve.");

  return (
    <PoeticJourney themes={themes}>
      <article className="ci-served-poem">
        <p className="ci-served-marks">
          {served.scene}
          {served.motifs.map((motif) => (
            <span key={motif} className="ci-motif">
              {motif}
            </span>
          ))}
        </p>
        <h2 className="ci-served-title">
          <Link href={served.href}>{served.heading}</Link>
        </h2>
        <p className="ci-served-byline">
          〔{served.dynasty}〕
          <Link href={served.poetHref}>{served.poet}</Link>
        </p>

        <div className="ci-served-body">
          {served.lines.map((line, i) => (
            <p key={i} data-opens={line.opensStanza || undefined}>
              {line.text}
            </p>
          ))}
        </div>

        <nav aria-label="书目" className="ci-served-nav">
          {LIBRARY_SECTIONS.map((section) => (
            <Link key={section.href} href={section.href}>
              {section.label}
            </Link>
          ))}
        </nav>
      </article>
    </PoeticJourney>
  );
}
