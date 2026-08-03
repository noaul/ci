/**
 * What counts as "the reader asked for the next poem".
 *
 * Reading is the whole surface, so the stage itself is the control — which
 * means the rules for *not* advancing carry the weight. A link, a drawer, a
 * selected line, a scroll that began as a touch, a turn already in flight:
 * every one of these is someone doing something other than turning the page.
 */

/** Anything that answers a click on its own account. */
export const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  "details",
  "dialog",
  "[role='button']",
  "[role='link']",
  "[role='menuitem']",
  "[role='dialog']",
  "[contenteditable='']",
  "[contenteditable='true']",
  "[data-no-advance]",
].join(", ");

/** How far a pointer may travel and still be a tap rather than a drag. */
export const POINTER_SLOP = 10;

export type Point = { x: number; y: number };

export function movedTooFar(from: Point, to: Point, slop = POINTER_SLOP): boolean {
  return Math.abs(to.x - from.x) > slop || Math.abs(to.y - from.y) > slop;
}

export type Activation = {
  /** A primary, non-modified activation — not a right-click or a shortcut. */
  primary: boolean;
  /** The event started on a control that has its own answer. */
  interactive: boolean;
  /** The reader has text selected and is presumably reading or copying it. */
  textSelected: boolean;
  /** The pointer travelled: a scroll or a drag, not a tap. */
  moved: boolean;
  /** A turn is already running, or the next poem is not here yet. */
  locked: boolean;
};

export function shouldAdvance(activation: Activation): boolean {
  return (
    activation.primary &&
    !activation.interactive &&
    !activation.textSelected &&
    !activation.moved &&
    !activation.locked
  );
}

/** Keys that turn the page. */
export function isAdvanceKey(key: string): boolean {
  return key === "Enter" || key === " " || key === "Spacebar" || key === "ArrowRight";
}

/** True when the event began inside something that answers clicks itself. */
export function fromInteractive(target: EventTarget | null): boolean {
  const element =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  return element?.closest(INTERACTIVE_SELECTOR) != null;
}

/** True when the reader has a live, non-empty selection. */
export function hasTextSelection(selection: Selection | null): boolean {
  if (!selection || selection.isCollapsed) return false;
  return selection.toString().trim().length > 0;
}
