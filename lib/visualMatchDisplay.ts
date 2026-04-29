// Display threshold: matches below this calibrated percent are hidden.
export const VISUAL_MATCH_DISPLAY_THRESHOLD = 50;

/**
 * CLIP cosine-similarity calibration anchors.
 *
 * CLIP scores for unrelated images cluster around 0.55. Re-encoded /
 * re-scaled / lightly cropped copies of the same logo land in 0.85–0.99.
 * We cap "identical" at 0.85 so a logo and its web-indexed copy register
 * as 100% even when CLIP wobbles a few hundredths between runs. Anything
 * Google found that's visibly the same brand mark should read as an
 * Exact Match in the UI; small differences in size/format should not
 * drag the display percent below 100%.
 */
const CLIP_BASELINE = 0.55;
const CLIP_IDENTICAL = 0.85;

/**
 * Map raw CLIP cosine similarity to a 0–100 display percent. Linearly
 * stretches [CLIP_BASELINE, CLIP_IDENTICAL] → [0, 100] and clips outside
 * that range.
 */
export function visualMatchDisplayPercent(rawScore: number): number {
  const calibrated =
    (rawScore - CLIP_BASELINE) / (CLIP_IDENTICAL - CLIP_BASELINE);

  return Math.round(Math.min(100, Math.max(0, calibrated * 100)));
}

/** Score-based label, driven by the calibrated display percent. */
export function visualMatchLabel(displayPercent: number): string {
  if (displayPercent >= 90) return "Exact Match";
  if (displayPercent >= 75) return "Strong Match";

  return "Similar";
}
