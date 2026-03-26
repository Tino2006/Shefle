/**
 * Utility functions for generating candidate search queries from OCR text
 */

const STOPWORDS = new Set([
  'inc',
  'llc',
  'ltd',
  'limited',
  'corporation',
  'corp',
  'company',
  'co',
  'group',
  'international',
  'intl',
  'the',
  'and',
  'or',
  'of',
  'a',
  'an',
]);

/**
 * Generate candidate search queries from normalized text
 * Returns: full phrase, top 1-3 tokens by length (no stopwords), concatenated version
 */
export function generateCandidateQueries(normalizedText: string): string[] {
  const candidates: string[] = [];

  // 1. Full phrase (already normalized)
  if (normalizedText.trim()) {
    candidates.push(normalizedText.trim());
  }

  // 2. Split into tokens and filter stopwords
  const tokens = normalizedText
    .split(/\s+/)
    .filter(token => token.length > 0 && !STOPWORDS.has(token.toLowerCase()));

  // 3. Top 1-3 tokens by length (descending)
  const topTokens = [...tokens]
    .sort((a, b) => b.length - a.length)
    .slice(0, 3);

  topTokens.forEach(token => {
    if (token && !candidates.includes(token)) {
      candidates.push(token);
    }
  });

  // 4. Concatenated version (remove all spaces)
  const concatenated = normalizedText.replace(/\s+/g, '');
  if (concatenated && concatenated !== normalizedText && !candidates.includes(concatenated)) {
    candidates.push(concatenated);
  }

  return candidates;
}

/**
 * Deduplicate results by (office, serial_number), keeping the one with max similarity
 */
export function deduplicateResults<T extends { office?: string; serial_number: string; similarity_score: number }>(
  results: T[]
): T[] {
  const map = new Map<string, T>();

  for (const result of results) {
    const key = `${result.office || 'USPTO'}-${result.serial_number}`;
    const existing = map.get(key);

    if (!existing || result.similarity_score > existing.similarity_score) {
      map.set(key, result);
    }
  }

  return Array.from(map.values());
}

/**
 * Rank results by:
 * 1. Exact/near match first (similarity >= 0.95)
 * 2. Then similarity_score desc
 * 3. Then status priority: ACTIVE > PENDING > DEAD
 * 4. Optional: boost if overlaps selected Nice classes
 */
export function rankResults<T extends { 
  similarity_score: number; 
  status_norm: string | null;
  classes?: number[];
}>(
  results: T[],
  selectedClasses?: number[]
): T[] {
  return [...results].sort((a, b) => {
    // 1. Exact/near match first
    const aExact = a.similarity_score >= 0.95 ? 1 : 0;
    const bExact = b.similarity_score >= 0.95 ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    // 2. Similarity score descending
    if (Math.abs(a.similarity_score - b.similarity_score) > 0.001) {
      return b.similarity_score - a.similarity_score;
    }

    // 3. Status priority
    const statusPriority: Record<string, number> = {
      'ACTIVE': 3,
      'PENDING': 2,
      'DEAD': 1,
    };
    const aPriority = statusPriority[a.status_norm || ''] || 0;
    const bPriority = statusPriority[b.status_norm || ''] || 0;
    if (aPriority !== bPriority) return bPriority - aPriority;

    // 4. Optional: boost if overlaps selected Nice classes
    if (selectedClasses && selectedClasses.length > 0) {
      const aOverlap = (a.classes || []).filter(c => selectedClasses.includes(c)).length;
      const bOverlap = (b.classes || []).filter(c => selectedClasses.includes(c)).length;
      if (aOverlap !== bOverlap) return bOverlap - aOverlap;
    }

    return 0;
  });
}
