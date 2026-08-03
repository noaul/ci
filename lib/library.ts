export type NavCurrent = "page" | "location" | undefined;

/** Describe whether a primary link is the current page or its enclosing section. */
export function navCurrent(pathname: string, href: string): NavCurrent {
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (path === href) return "page";
  if (path.startsWith(href)) return "location";
  if (href === "/poets/" && path.startsWith("/poems/")) return "location";
  return undefined;
}

/**
 * The whole book, as the drawer lists it.
 *
 * One navigation for the site, and the only one: the masthead carries a single
 * trigger, the threshold carries none at all, and every route reaches every
 * index from the same list rather than from a bar that has to be repeated in
 * the footer.
 */
export const LIBRARY_SECTIONS = [
  { href: "/poets/", label: "词人", note: "自晚唐迄清" },
  { href: "/tunes/", label: "词牌", note: "调名与格律谱" },
  { href: "/first-lines/", label: "首句", note: "按首字拼音" },
  { href: "/books/", label: "词话", note: "《人间词话》等五种" },
  { href: "/volumes/", label: "丛书", note: "全二十二册" },
  { href: "/about/", label: "关于", note: "底本与著作权" },
] as const;

/**
 * What the drawer knows about the poem in front of the reader.
 *
 * Published by the reading pages and by the journey, which changes it without
 * a navigation — so 本阕 follows the poem on the stage rather than the URL.
 */
export type CurrentWork = {
  /** 词牌·词题, or the name the curated scene is known by. */
  title: string;
  href: string;
  poet: string;
  poetHref: string;
  dynasty: string;
  tune: string;
  tuneHref: string | null;
  volume: string | null;
  volumeHref: string | null;
  /** ◎ 注释 waiting on the poem page. */
  notes: number;
  /** ◆ 历代辑评 waiting on the poem page. */
  commentary: number;
};

/** The anchors the reading page gives its apparatus. */
export const NOTES_ANCHOR = "notes";
export const COMMENTARY_ANCHOR = "commentary";

export type LibraryLink = {
  href: string;
  label: string;
  note?: string;
  current: NavCurrent;
};

export type LibraryGroup = {
  id: "work" | "library";
  title: string;
  links: LibraryLink[];
};

/**
 * The drawer's two groups: what the reader is holding, then the whole book.
 *
 * 本阕 appears only when there is a poem to describe, so the drawer on an index
 * page is not padded out with empty rows.
 */
export function buildLibraryGroups(
  pathname: string,
  work: CurrentWork | null,
): LibraryGroup[] {
  const groups: LibraryGroup[] = [];

  if (work) {
    const links: LibraryLink[] = [
      { href: work.href, label: work.title, note: `〔${work.dynasty}〕${work.poet}`, current: navCurrent(pathname, work.href) },
    ];
    const annotations = work.notes + work.commentary;
    if (annotations > 0) {
      links.push({
        href: `${work.href}#${work.notes > 0 ? NOTES_ANCHOR : COMMENTARY_ANCHOR}`,
        label: "注释与辑评",
        note: `${annotations} 条`,
        current: undefined,
      });
    }
    links.push({
      href: work.poetHref,
      label: work.poet,
      note: "词人",
      current: navCurrent(pathname, work.poetHref),
    });
    if (work.tuneHref) {
      links.push({
        href: work.tuneHref,
        label: work.tune,
        note: "词牌",
        current: navCurrent(pathname, work.tuneHref),
      });
    }
    if (work.volume && work.volumeHref) {
      links.push({
        href: work.volumeHref,
        label: work.volume,
        note: "出处",
        current: navCurrent(pathname, work.volumeHref),
      });
    }
    groups.push({ id: "work", title: "本阕", links });
  }

  groups.push({
    id: "library",
    title: "全书",
    links: LIBRARY_SECTIONS.map((section) => ({
      href: section.href,
      label: section.label,
      note: section.note,
      current: navCurrent(pathname, section.href),
    })),
  });

  return groups;
}
