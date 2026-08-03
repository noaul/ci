import type { CSSProperties } from "react";
import type { TransitionPlan } from "@/lib/journey/transitions";

/**
 * The cover one poem leaves under and the next arrives beneath.
 *
 * Two layers and no more: a wash that carries the family's colour and a mark
 * that carries its shape. The stylesheet does the rest from four attributes —
 * which family, which way, how deep, and where the reader touched — so eight
 * kinds of turn, each with its own variations, cost one element and no
 * animation library.
 */
export function JourneyTransition({ plan, duration }: { plan: TransitionPlan; duration: number }) {
  return (
    <div
      className="ci-turn"
      aria-hidden="true"
      data-family={plan.family}
      data-direction={plan.direction}
      data-depth={plan.depth}
      style={
        {
          "--turn-dur": `${duration}ms`,
          "--turn-x": `${(plan.origin.x * 100).toFixed(2)}%`,
          "--turn-y": `${(plan.origin.y * 100).toFixed(2)}%`,
        } as CSSProperties
      }
    >
      <span className="ci-turn-wash" />
      <span className="ci-turn-mark" />
    </div>
  );
}
