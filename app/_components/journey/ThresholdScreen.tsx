/**
 * 屏风 — four leaves standing across the first view.
 *
 * The inscription is set into the leaves themselves rather than laid over
 * them: 入 belongs to the inner-left leaf and 词 to the inner-right, either
 * side of the seam, and the sentence is split at its own comma the same way. So
 * when the screen folds, the word opens with it — the writing goes where the
 * paper goes instead of politely fading out on its own.
 *
 * Each leaf carries a front and a back; the inner pair turn past ninety degrees
 * and show their backs on the way out. Everything visible here is decoration —
 * the control in front of it is a single real button.
 */
const LEAVES = [
  { id: "outer-left", mark: null },
  { id: "inner-left", mark: { glyph: "入", line: "屏开一阕，" } },
  { id: "inner-right", mark: { glyph: "词", line: "恰逢词里人间。" } },
  { id: "outer-right", mark: null },
] as const;

/** What the entry control is called, and the whole of what the threshold says. */
export const THRESHOLD_TITLE = "入词";
export const THRESHOLD_LINE = "屏开一阕，恰逢词里人间。";

export function ThresholdScreen() {
  return (
    <div className="ci-screen" aria-hidden="true">
      {LEAVES.map((leaf) => (
        <span key={leaf.id} className="ci-screen-leaf" data-leaf={leaf.id}>
          <span className="ci-leaf-face">
            <span className="ci-leaf-art" />
            {leaf.mark && (
              <span className="ci-leaf-mark">
                <span className="ci-leaf-glyph">{leaf.mark.glyph}</span>
                <span className="ci-leaf-line">{leaf.mark.line}</span>
              </span>
            )}
          </span>
          <span className="ci-leaf-back" />
        </span>
      ))}

      <span className="ci-screen-seam" />
    </div>
  );
}
