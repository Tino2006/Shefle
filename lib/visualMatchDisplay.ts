/**
 * CLIP cosine similarities for different logos often cluster in a narrow band
 * (e.g. ~0.62–0.95). Showing raw×100 reads as misleadingly high. Map scores
 * within one result set so the strongest candidate is 100% and weaker ones
 * spread toward the minimum shown in that set.
 */
export function visualMatchDisplayPercents(rawScores: number[]): number[] {
  if (rawScores.length === 0) return [];
  const min = Math.min(...rawScores);
  const max = Math.max(...rawScores);
  if (max <= min) {
    return rawScores.map(() => 100);
  }
  return rawScores.map((s) => {
    const pct = ((s - min) / (max - min)) * 100;
    return Math.round(Math.min(100, Math.max(0, pct)));
  });
}
