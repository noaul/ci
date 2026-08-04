/**
 * 屏风 — two painted panels that draw apart to uncover the poem.
 *
 * The panels are the only opaque thing on the screen: what appears between
 * them as they go is the scene itself, already standing behind them, lit by a
 * warm wash that opens from the seam and spends itself entirely. The
 * inscription belongs to the panels — 入 to the left and 词 to the right — so
 * when the screen opens the word opens with it.
 *
 * Everything here is decoration; the control in front of it is a single real
 * button.
 */

/** What the entry control is called, and the whole of what the threshold says. */
export const THRESHOLD_TITLE = "入词";
export const THRESHOLD_LINE = "屏开一阕，恰逢词里人间。";

export function ThresholdScreen() {
  return (
    <div className="ci-screen" aria-hidden="true">
      {/* Before the panels, so the light lies over the scene and under them. */}
      <span className="ci-screen-glow" />

      <span className="ci-screen-curtain" data-side="left">
        <span className="ci-curtain-art" />
        <span className="ci-curtain-mark">
          <span className="ci-curtain-glyph">入</span>
          <span className="ci-curtain-line">屏开一阕，</span>
        </span>
      </span>

      <span className="ci-screen-curtain" data-side="right">
        <span className="ci-curtain-art" />
        <span className="ci-curtain-mark">
          <span className="ci-curtain-glyph">词</span>
          <span className="ci-curtain-line">恰逢词里人间。</span>
        </span>
      </span>

      <span className="ci-screen-seam" />
    </div>
  );
}
