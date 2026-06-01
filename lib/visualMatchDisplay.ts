// Display threshold: matches below this calibrated percent are hidden.
export const VISUAL_MATCH_DISPLAY_THRESHOLD = 50;

/**
 * CLIP cosine-similarity calibration anchors (post multi-variant).
 *
 * With preprocessed multi-variant embeddings, unrelated images cluster
 * around 0.50 and identical logos land in 0.90–0.99. The sigmoid maps
 * the [0.50, 0.90] range to [0, 100] with a gentle S-curve that is
 * generous in the 0.65–0.85 zone where "same brand, different version"
 * logos live.
 */
const CLIP_BASELINE = 0.5;
const CLIP_IDENTICAL = 0.9;
const SIGMOID_K = 8;
const SIGMOID_MID = (CLIP_BASELINE + CLIP_IDENTICAL) / 2;

/**
 * Map raw CLIP cosine similarity to a 0–100 display percent via a
 * sigmoid curve that spreads out the "clearly similar" mid-range.
 */
export function visualMatchDisplayPercent(rawScore: number): number {
  if (rawScore <= CLIP_BASELINE) return 0;
  if (rawScore >= CLIP_IDENTICAL) return 100;

  const normalized =
    (rawScore - CLIP_BASELINE) / (CLIP_IDENTICAL - CLIP_BASELINE);
  const mid = (SIGMOID_MID - CLIP_BASELINE) / (CLIP_IDENTICAL - CLIP_BASELINE);
  const sigmoid =
    1 / (1 + Math.exp(-SIGMOID_K * (normalized - mid)));
  const sigmoidMin = 1 / (1 + Math.exp(-SIGMOID_K * (0 - mid)));
  const sigmoidMax = 1 / (1 + Math.exp(-SIGMOID_K * (1 - mid)));
  const scaled = (sigmoid - sigmoidMin) / (sigmoidMax - sigmoidMin);

  return Math.round(Math.min(100, Math.max(0, scaled * 100)));
}

/** Score-based label, driven by the calibrated display percent. */
export function visualMatchLabel(displayPercent: number): string {
  if (displayPercent >= 90) return "Exact Match";
  if (displayPercent >= 75) return "Strong Match";

  return "Similar";
}
