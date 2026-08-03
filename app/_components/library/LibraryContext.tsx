"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CurrentWork } from "@/lib/library";

/**
 * Which poem the drawer's 本阕 group is about.
 *
 * A reading page knows this from its route, and the home journey changes it
 * without navigating anywhere at all — so the drawer reads it from here rather
 * than from the URL. The value arrives after hydration; without scripts the
 * drawer still opens and still lists the whole book, and a poem page already
 * prints its poet, 词牌 and 分册 in the page itself.
 */
const WorkContext = createContext<CurrentWork | null>(null);
const PublishContext = createContext<(work: CurrentWork | null) => void>(() => {});

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [work, setWork] = useState<CurrentWork | null>(null);
  return (
    <PublishContext.Provider value={setWork}>
      <WorkContext.Provider value={work}>{children}</WorkContext.Provider>
    </PublishContext.Provider>
  );
}

export const useCurrentWork = (): CurrentWork | null => useContext(WorkContext);

export const usePublishWork = (): ((work: CurrentWork | null) => void) =>
  useContext(PublishContext);

/**
 * Announce the poem this page is about, and take it back on the way out.
 *
 * Serialising the work is what keeps the effect from re-running on every
 * render: the pages build the object inline, so its identity changes even when
 * nothing about the poem has.
 */
export function PublishWork({ work }: { work: CurrentWork | null }) {
  const publish = usePublishWork();
  const serialised = work === null ? "" : JSON.stringify(work);
  const value = useMemo(
    () => (serialised === "" ? null : (JSON.parse(serialised) as CurrentWork)),
    [serialised],
  );

  useEffect(() => {
    publish(value);
    return () => publish(null);
  }, [publish, value]);

  return null;
}
