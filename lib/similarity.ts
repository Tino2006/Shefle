function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTrigrams(input: string): string[] {
  const normalized = normalizeText(input);
  if (!normalized) return [];

  const padded = `  ${normalized}  `;
  const trigrams: string[] = [];
  for (let i = 0; i < padded.length - 2; i += 1) {
    trigrams.push(padded.slice(i, i + 3));
  }
  return trigrams;
}

export function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const aTrigrams = getTrigrams(a);
  const bTrigrams = getTrigrams(b);
  if (aTrigrams.length === 0 || bTrigrams.length === 0) return 0;

  const aCounts = new Map<string, number>();
  for (const tri of aTrigrams) {
    aCounts.set(tri, (aCounts.get(tri) || 0) + 1);
  }

  let intersection = 0;
  for (const tri of bTrigrams) {
    const count = aCounts.get(tri) || 0;
    if (count > 0) {
      intersection += 1;
      aCounts.set(tri, count - 1);
    }
  }

  const union = aTrigrams.length + bTrigrams.length - intersection;
  if (union <= 0) return 0;
  return intersection / union;
}
