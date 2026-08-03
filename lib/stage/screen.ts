export type ScreenPhase = "closed" | "opening" | "open" | "closing";

/**
 * How long the leaves take to swing. These are the single source of truth: the
 * component writes them into the stage as custom properties, so the stylesheet
 * that draws the motion and the clock that ends the phase cannot drift apart.
 */
export const SCREEN_OPEN_MS = 900;
export const SCREEN_CLOSE_MS = 700;
export const SCREEN_FAIL_OPEN_MS = 2400;

/**
 * How long a phase lasts. Resting phases take no time at all, and a reader who
 * has asked for less motion finishes every transition at once — the lifecycle
 * still runs through every state, it just spends nothing on the way.
 */
export function screenDuration(phase: ScreenPhase, reduced: boolean): number {
  if (phase !== "opening" && phase !== "closing") return 0;
  if (reduced) return 0;
  return phase === "opening" ? SCREEN_OPEN_MS : SCREEN_CLOSE_MS;
}

export type ScreenState = {
  phase: ScreenPhase;
  activeIndex: number;
  pendingIndex: number | null;
};

export type ScreenAction =
  | { type: "DRAW"; nextIndex: number }
  | { type: "ENTER" }
  | { type: "OPEN_FINISHED" }
  | { type: "SWAP"; nextIndex: number }
  | { type: "CLOSE_FINISHED" };

const validIndex = (value: number): boolean => Number.isInteger(value) && value >= 0;

export const initialScreenState = (activeIndex = 0): ScreenState => ({
  phase: "closed",
  activeIndex: validIndex(activeIndex) ? activeIndex : 0,
  pendingIndex: null,
});

/**
 * Keeps scene replacement behind the closed screen. Invalid or stale events
 * return the same object so duplicate transition events cannot restart a turn.
 */
export function screenReducer(state: ScreenState, action: ScreenAction): ScreenState {
  switch (action.type) {
    case "DRAW":
      if (state.phase !== "closed" || !validIndex(action.nextIndex)) return state;
      return { ...state, activeIndex: action.nextIndex };
    case "ENTER":
      if (state.phase !== "closed") return state;
      return { ...state, phase: "opening" };
    case "OPEN_FINISHED":
      if (state.phase !== "opening") return state;
      return { ...state, phase: "open" };
    case "SWAP":
      if (
        state.phase !== "open" ||
        !validIndex(action.nextIndex) ||
        action.nextIndex === state.activeIndex
      ) {
        return state;
      }
      return { ...state, phase: "closing", pendingIndex: action.nextIndex };
    case "CLOSE_FINISHED":
      if (state.phase !== "closing" || state.pendingIndex === null) return state;
      return {
        phase: "opening",
        activeIndex: state.pendingIndex,
        pendingIndex: null,
      };
  }
}
