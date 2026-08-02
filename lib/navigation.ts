export type NavCurrent = "page" | "location" | undefined;

/** Describe whether a primary link is the current page or its enclosing section. */
export function navCurrent(pathname: string, href: string): NavCurrent {
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (path === href) return "page";
  if (path.startsWith(href)) return "location";
  if (href === "/poets/" && path.startsWith("/poems/")) return "location";
  return undefined;
}
