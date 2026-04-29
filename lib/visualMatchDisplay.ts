// Display threshold: matches below this calibrated percent are hidden.
export const VISUAL_MATCH_DISPLAY_THRESHOLD = 50;

/**
 * CLIP cosine-similarity calibration anchors.
 *
 * CLIP scores for unrelated images cluster around 0.55. Visually-identical
 * images at different resolutions/formats land in 0.92–0.99 — never a hard
 * 1.0 — so we cap "identical" at 0.92. This way re-uploading the same logo
 * produces a stable 100% display even when the raw CLIP score wobbles by a
 * few percent between runs (different candidate URL, different file size,
 * etc.).
 */
const CLIP_BASELINE = 0.55;
const CLIP_IDENTICAL = 0.92;

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
