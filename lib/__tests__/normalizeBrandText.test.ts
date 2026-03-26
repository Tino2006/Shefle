/**
 * Tests for brand text normalization
 * Run with: npx jest lib/__tests__/normalizeBrandText.test.ts
 */

import { normalizeBrandText, normalizeBrandTextForSearch } from '../normalizeBrandText';

describe('normalizeBrandText', () => {
  test('converts to uppercase', () => {
    const result = normalizeBrandText('nike');
    expect(result.normalized).toBe('NIKE');
  });

  test('maps 0 to O', () => {
    const result = normalizeBrandText('C0CA C0LA');
    expect(result.normalized).toBe('COCA COLA');
  });

  test('maps 1 to I', () => {
    const result = normalizeBrandText('N1KE');
    expect(result.normalized).toBe('NIKE');
  });

  test('maps 5 to S', () => {
    const result = normalizeBrandText('ADIDA5');
    expect(result.normalized).toBe('ADIDAS');
  });

  test('maps 8 to B', () => {
    const result = normalizeBrandText('8MV');
    expect(result.normalized).toBe('BMW');
  });

  test('removes non A-Z characters except spaces', () => {
    const result = normalizeBrandText('NIKE@#$123');
    expect(result.normalized).toBe('NIKEIII');
  });

  test('removes special characters', () => {
    const result = normalizeBrandText('AT&T');
    expect(result.normalized).toBe('ATT');
  });

  test('collapses multiple spaces', () => {
    const result = normalizeBrandText('COCA    COLA');
    expect(result.normalized).toBe('COCA COLA');
  });

  test('trims leading and trailing spaces', () => {
    const result = normalizeBrandText('  NIKE  ');
    expect(result.normalized).toBe('NIKE');
  });

  test('handles complex case with multiple transformations', () => {
    const result = normalizeBrandText('c0ca-c0la 1nc.');
    expect(result.raw).toBe('c0ca-c0la 1nc.');
    expect(result.normalized).toBe('COCA COLA INC');
  });

  test('handles numbers that look like letters', () => {
    const result = normalizeBrandText('N1K3 5P0RT5W3AR');
    expect(result.normalized).toBe('NIKE SPORTSWEAR');
  });

  test('preserves already clean brand names', () => {
    const result = normalizeBrandText('APPLE');
    expect(result.normalized).toBe('APPLE');
  });

  test('returns both raw and normalized', () => {
    const result = normalizeBrandText('n1k3');
    expect(result.raw).toBe('n1k3');
    expect(result.normalized).toBe('NIKE');
  });
});

describe('normalizeBrandTextForSearch', () => {
  test('returns lowercase normalized text', () => {
    const result = normalizeBrandTextForSearch('N1K3');
    expect(result).toBe('nike');
  });

  test('handles complex transformations for search', () => {
    const result = normalizeBrandTextForSearch('C0CA-C0LA 1NC.');
    expect(result).toBe('coca cola inc');
  });
});

describe('Real-world OCR scenarios', () => {
  test('handles common OCR misreads', () => {
    const scenarios = [
      { input: 'N1KE', expected: 'NIKE' },
      { input: 'ADIDA5', expected: 'ADIDAS' },
      { input: '8MV', expected: 'BMW' },
      { input: 'C0CA C0LA', expected: 'COCA COLA' },
      { input: 'APPL3', expected: 'APPLE' },
      { input: 'G00GLE', expected: 'GOOGLE' },
      { input: 'MICR050FT', expected: 'MICROSOFT' },
    ];

    scenarios.forEach(({ input, expected }) => {
      const result = normalizeBrandText(input);
      expect(result.normalized).toBe(expected);
    });
  });

  test('handles noisy OCR output', () => {
    const result = normalizeBrandText('N!K€ 5P0RT5W€@R');
    expect(result.normalized).toBe('NK SPORTSWEAR');
  });

  test('handles extra whitespace from OCR', () => {
    const result = normalizeBrandText('  N I K E  ');
    expect(result.normalized).toBe('N I K E');
  });
});
