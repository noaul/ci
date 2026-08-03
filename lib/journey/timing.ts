import { TRANSITION_SWAP_AT, type TransitionPlan } from "./transitions";

/**
 * The journey's clocks.
 *
 * These are the single source of truth: the component writes them into the
 * stage as custom properties, so the stylesheet that draws the motion and the
 * timer that ends the phase read the same numbers and cannot drift apart. A
 * `transitionend` would be the obvious source and is the wrong one — it never
 * arrives from a leaf whose transition was interrupted, it arrives four times
 * from four leaves, and under reduced motion there is nothing to end.
 */

/** The folding screen: inner leaves, then outer, then the scene resolving. */
export const SCREEN_OPEN_MS = 1300;

/** Reduced motion gets the same event as a short crossfade, not as a fold. */
export const SCREEN_OPEN_REDUCED_MS = 220;

/** A corpus turn under reduced motion: long enough to cover the swap. */
export const TRANSITION_REDUCED_MS = 180;

/**
 * How long the leaves stand open before the reader is left alone with the poem.
 * Nothing in the scene loops after this — the motion rests once the meaning has
 * arrived.
 */
export const SCREEN_SETTLE_MS = 420;

export const screenOpenDuration = (reduced: boolean): number =>
  reduced ? SCREEN_OPEN_REDUCED_MS : SCREEN_OPEN_MS;

export const transitionDuration = (plan: TransitionPlan, reduced: boolean): number =>
  reduced ? TRANSITION_REDUCED_MS : plan.duration;

/** When the incoming poem takes the stage, with the cover still over it. */
export const transitionSwapAt = (plan: TransitionPlan, reduced: boolean): number =>
  Math.round(transitionDuration(plan, reduced) * TRANSITION_SWAP_AT);
