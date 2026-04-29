// Display threshold: matches below this calibrated percent are hidden.
export const VISUAL_MATCH_DISPLAY_THRESHOLD = 50;

/**
 * Map raw CLIP cosine similarity (typically 0.4–1.0) to a 0–100 display
 * percent. CLIP scores for unrelated images cluster around 0.5, so we
 * linearly stretch [0.5, 1.0] → [0, 100] and clip outside that range.
 */
export function visualMatchDisplayPercent(rawScore: number): number {
  const calibrated = (rawScore - 0.5) / 0.5;

  return Math.round(Math.min(100, Math.max(0, calibrated * 100)));
}

/** Score-based label, driven by the calibrated display percent. */
export function visualMatchLabel(displayPercent: number): string {
  if (displayPercent >= 90) return "Exact Match";
  if (displayPercent >= 75) return "Strong Match";

  return "Similar";
}
