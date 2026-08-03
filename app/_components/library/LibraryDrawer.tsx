"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import Link from "@/app/_components/StaticLink";
import { buildLibraryGroups } from "@/lib/library";
import { useCurrentWork } from "./LibraryContext";

/**
 * The one navigation.
 *
 * A single trigger at the top right, and behind it the whole book: what the
 * reader is holding, then every index. Built on `<details>` on purpose — the
 * disclosure, the keyboard behaviour and the expanded state come from the
 * element itself, so the drawer opens for a reader whose scripts never arrived,
 * and the journey's "click anywhere" rule can recognise it as a control simply
 * by looking for the enclosing `<details>`.
 */
export function LibraryDrawer({ tone = "masthead" }: { tone?: "masthead" | "journey" }) {
  const pathname = usePathname() ?? "/";
  const work = useCurrentWork();
  const drawer = useRef<HTMLDetailsElement>(null);
  const inerted = useRef<HTMLElement[]>([]);
  const groups = buildLibraryGroups(pathname, work);

  const releaseBackground = useCallback(() => {
    for (const element of inerted.current) element.inert = false;
    inerted.current = [];
  }, []);

  const containBackground = useCallback((element: HTMLElement) => {
    const held: HTMLElement[] = [];
    let branch: HTMLElement | null = element;
    while (branch && branch !== document.body) {
      const parent: HTMLElement | null = branch.parentElement;
      if (!parent) break;
      for (const sibling of parent.children) {
        if (sibling === branch || !(sibling instanceof HTMLElement) || sibling.inert) continue;
        sibling.inert = true;
        held.push(sibling);
      }
      branch = parent;
    }
    inerted.current = held;
  }, []);

  const close = useCallback((restoreFocus = false) => {
    const element = drawer.current;
    if (!element?.open) return;
    element.open = false;
    if (restoreFocus) {
      window.requestAnimationFrame(() => element.querySelector<HTMLElement>("summary")?.focus());
    }
  }, []);

  // A route change is a finished errand: the drawer that sent the reader there
  // should not still be standing open over the page they asked for.
  useEffect(() => close(false), [close, pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const element = drawer.current;
      if (!element?.open) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = Array.from(
        element.querySelectorAll<HTMLElement>(
          "summary, a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close]);

  useEffect(
    () => () => {
      releaseBackground();
      document.documentElement.removeAttribute("data-drawer-open");
    },
    [releaseBackground],
  );

  const onToggle = useCallback(() => {
    const element = drawer.current;
    const open = element?.open === true;
    document.documentElement.toggleAttribute("data-drawer-open", open);
    if (open) {
      if (element) containBackground(element);
      window.requestAnimationFrame(() =>
        element?.querySelector<HTMLElement>(".ci-drawer-link")?.focus(),
      );
    } else {
      releaseBackground();
    }
  }, [containBackground, releaseBackground]);

  return (
    <details ref={drawer} className="ci-drawer" data-tone={tone} onToggle={onToggle}>
      <summary className="ci-drawer-trigger" aria-label="书目">
        <span className="ci-drawer-glyph" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </summary>

      {/* Dismisses the drawer without being a tab stop of its own; the trigger
          stays visible while open and closes it from the keyboard. */}
      <span className="ci-drawer-scrim" aria-hidden="true" onClick={() => close(true)} />

      <div className="ci-drawer-panel" role="dialog" aria-modal="true" aria-label="书目">
        <nav aria-label="书目内容">
          {groups.map((group) => (
            <section key={group.id} className="ci-drawer-group">
              <h2 className="ci-drawer-title">{group.title}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={`${group.id}:${link.href}`}>
                    <Link
                      href={link.href}
                      aria-current={link.current}
                      className="ci-drawer-link"
                      onClick={() => close(false)}
                    >
                      <span className="ci-drawer-label">{link.label}</span>
                      {link.note && <span className="ci-drawer-note">{link.note}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </div>
    </details>
  );
}
