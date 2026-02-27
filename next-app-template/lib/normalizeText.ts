/**
 * Normalize text for trademark search
 * - Convert to lowercase
 * - Remove diacritics (accents)
 * - Replace all non-alphanumerics with spaces
 * - Trim and collapse multiple spaces into one
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    // Remove diacritics by normalizing to NFD and removing combining diacritical marks
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Replace all non-alphanumeric characters with spaces
    .replace(/[^a-z0-9]+/g, " ")
    // Trim and collapse multiple spaces
    .trim()
    .replace(/\s+/g, " ");
}
