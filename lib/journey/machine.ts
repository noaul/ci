import type { CorpusEntry } from "@/lib/corpus/shards";
import { rememberFamily, type TransitionFamily, type TransitionPlan } from "./transitions";

/**
 * The journey, as six states and the moves between them.
 *
 * 屏 stands shut; it opens once; behind it waits one curated 词, first its
 * opening movement and then the whole of it with its own climax; and after that
 * the book itself, one complete poem at a time, for as long as the reader keeps
 * asking. Nothing here touches the DOM, fetches anything, or reads a clock —
 * which is what makes the lifecycle something a test can walk end to end.
 */
export type JourneyPhase =
  | "threshold"
  | "opening"
  | "featuredPreview"
  | "featuredFull"
  | "transitioning"
  | "corpusFull";

export type JourneyState = {
  phase: JourneyPhase;
  /** Which of the four curated scenes this entry drew. */
  featured: number;
  /** The corpus poem on the stage, once the journey has left the curated one. */
  poem: CorpusEntry | null;
  /** The next poem, waiting for the cover to reach it. */
  pending: CorpusEntry | null;
  transition: TransitionPlan | null;
  /** Families recently played, newest first. */
  history: TransitionFamily[];
  /** True while the next poem is being fetched — nothing has moved yet. */
  loading: boolean;
  /** Set when a fetch failed; the poem on the stage stays readable. */
  error: string | null;
  /** How many corpus poems the reader has been shown. */
  turned: number;
};

export type JourneyAction =
  | { type: "DRAW"; featured: number }
  | { type: "ENTER" }
  | { type: "OPENED" }
  | { type: "REVEAL" }
  | { type: "REQUEST" }
  | { type: "COVER"; poem: CorpusEntry; transition: TransitionPlan }
  | { type: "COMMIT" }
  | { type: "SETTLE" }
  | { type: "FAIL"; message: string }
  | { type: "RECOVER" };

export const initialJourneyState = (featured = 0): JourneyState => ({
  phase: "threshold",
  featured: Number.isInteger(featured) && featured >= 0 ? featured : 0,
  poem: null,
  pending: null,
  transition: null,
  history: [],
  loading: false,
  error: null,
  turned: 0,
});

/** Phases in which the poem on the stage is the curated one. */
export const isFeaturedPhase = (phase: JourneyPhase): boolean =>
  phase === "featuredPreview" || phase === "featuredFull";

/** What a safe activation means from here. */
export type JourneyIntent = "enter" | "reveal" | "next" | "none";

export function intentFor(state: JourneyState): JourneyIntent {
  if (state.loading) return "none";
  switch (state.phase) {
    case "threshold":
      return "enter";
    case "featuredPreview":
      return "reveal";
    case "featuredFull":
    case "corpusFull":
      return "next";
    case "opening":
    case "transitioning":
      return "none";
  }
}

/** True while motion owns the stage and a second request must be ignored. */
export const isLocked = (state: JourneyState): boolean =>
  state.loading || state.phase === "opening" || state.phase === "transitioning";

export function journeyReducer(state: JourneyState, action: JourneyAction): JourneyState {
  switch (action.type) {
    case "DRAW":
      // The scene is drawn behind a screen that has not moved yet; once the
      // leaves are in flight the choice is made and cannot be redrawn.
      if (state.phase !== "threshold" || !Number.isInteger(action.featured) || action.featured < 0) {
        return state;
      }
      return { ...state, featured: action.featured };

    case "ENTER":
      if (state.phase !== "threshold") return state;
      return { ...state, phase: "opening" };

    case "OPENED":
      if (state.phase !== "opening") return state;
      return { ...state, phase: "featuredPreview" };

    case "REVEAL":
      if (state.phase !== "featuredPreview") return state;
      return { ...state, phase: "featuredFull" };

    case "REQUEST":
      // Only the two resting reading states may ask for another poem, and only
      // one request may be in flight: the cover has not started, so the poem
      // under it stays readable while the shard is on its way.
      if (state.loading) return state;
      if (state.phase !== "featuredFull" && state.phase !== "corpusFull") return state;
      return { ...state, loading: true, error: null };

    case "COVER":
      // The cover begins only once the next poem is actually in hand.
      if (state.phase !== "featuredFull" && state.phase !== "corpusFull") return state;
      return {
        ...state,
        phase: "transitioning",
        pending: action.poem,
        transition: action.transition,
        history: rememberFamily(state.history, action.transition.family),
        loading: false,
        error: null,
      };

    case "COMMIT":
      // Hand the stage over while the cover still hides it.
      if (state.phase !== "transitioning" || state.pending === null) return state;
      return { ...state, poem: state.pending, pending: null, turned: state.turned + 1 };

    case "SETTLE":
      if (state.phase !== "transitioning") return state;
      return state.pending === null
        ? { ...state, phase: "corpusFull", transition: state.transition }
        : // A cover that ran out before its poem was committed: commit now
          // rather than uncovering the one the reader has already read.
          {
            ...state,
            phase: "corpusFull",
            poem: state.pending,
            pending: null,
            turned: state.turned + 1,
          };

    case "FAIL":
      if (!state.loading) return state;
      return { ...state, loading: false, error: action.message };

    case "RECOVER":
      return state.error === null ? state : { ...state, error: null };
  }
}
