/**
 * Brand-specific text normalization for OCR results
 * Optimized for logo/brand name recognition
 */

/**
 * Normalize brand text from OCR output
 * 
 * Steps:
 * 1. Convert to uppercase
 * 2. Map common OCR misreads: 0->O, 1->I, 5->S, 8->B
 * 3. Remove all non A-Z and spaces
 * 4. Trim and collapse multiple spaces
 * 
 * @param text - Raw OCR text
 * @returns Object with raw and normalized text
 */
export function normalizeBrandText(text: string): { raw: string; normalized: string } {
  const raw = text.trim();

  let normalized = text
    // Step 1: Convert to uppercase
    .toUpperCase()
    // Step 2: Map common OCR misreads (numbers that look like letters)
    .replace(/0/g, 'O')  // Zero -> O
    .replace(/1/g, 'I')  // One -> I
    .replace(/5/g, 'S')  // Five -> S
    .replace(/8/g, 'B')  // Eight -> B
    // Step 3: Remove all non A-Z and spaces
    .replace(/[^A-Z\s]/g, '')
    // Step 4: Trim and collapse multiple spaces into one
    .trim()
    .replace(/\s+/g, ' ');

  return {
    raw,
    normalized,
  };
}

/**
 * Normalize brand text for search (lowercase version)
 * Used for generating search queries
 * 
 * @param text - Brand text (can be raw or already normalized)
 * @returns Lowercase normalized text for search
 */
export function normalizeBrandTextForSearch(text: string): string {
  const { normalized } = normalizeBrandText(text);
  return normalized.toLowerCase();
}
