/**
 * Tests for query generation utilities
 * Run with: npx jest lib/__tests__/queryGeneration.test.ts
 */

import { generateCandidateQueries, deduplicateResults, rankResults } from '../queryGeneration';

describe('generateCandidateQueries', () => {
  test('generates full phrase, top tokens, and concatenated version', () => {
    const input = 'nike company inc';
    const candidates = generateCandidateQueries(input);
    
    expect(candidates).toContain('nike company inc');
    expect(candidates).toContain('nike');
    expect(candidates).toContain('nikecompanyinc');
  });

  test('filters stopwords correctly', () => {
    const input = 'apple inc corporation';
    const candidates = generateCandidateQueries(input);
    
    expect(candidates).toContain('apple inc corporation');
    expect(candidates).toContain('apple');
    expect(candidates).not.toContain('inc');
    expect(candidates).not.toContain('corporation');
  });

  test('returns top 3 tokens by length', () => {
    const input = 'international business machines corporation';
    const candidates = generateCandidateQueries(input);
    
    expect(candidates).toContain('international business machines corporation');
    expect(candidates).toContain('international');
    expect(candidates).toContain('machines');
    expect(candidates).toContain('business');
  });

  test('handles single word correctly', () => {
    const input = 'nike';
    const candidates = generateCandidateQueries(input);
    
    expect(candidates).toContain('nike');
    expect(candidates.length).toBe(1);
  });

  test('handles empty input', () => {
    const input = '';
    const candidates = generateCandidateQueries(input);
    
    expect(candidates).toEqual([]);
  });
});

describe('deduplicateResults', () => {
  test('keeps result with highest similarity', () => {
    const results = [
      { office: 'USPTO', serial_number: '12345', similarity_score: 0.8 },
      { office: 'USPTO', serial_number: '12345', similarity_score: 0.9 },
      { office: 'USPTO', serial_number: '67890', similarity_score: 0.7 },
    ];

    const deduped = deduplicateResults(results);
    
    expect(deduped).toHaveLength(2);
    expect(deduped.find(r => r.serial_number === '12345')?.similarity_score).toBe(0.9);
  });
});

describe('rankResults', () => {
  test('prioritizes exact matches', () => {
    const results = [
      { similarity_score: 0.7, status_norm: 'ACTIVE', classes: [] },
      { similarity_score: 0.95, status_norm: 'DEAD', classes: [] },
      { similarity_score: 0.8, status_norm: 'PENDING', classes: [] },
    ];

    const ranked = rankResults(results);
    
    expect(ranked[0].similarity_score).toBe(0.95);
  });

  test('prioritizes status when similarity is equal', () => {
    const results = [
      { similarity_score: 0.8, status_norm: 'DEAD', classes: [] },
      { similarity_score: 0.8, status_norm: 'ACTIVE', classes: [] },
      { similarity_score: 0.8, status_norm: 'PENDING', classes: [] },
    ];

    const ranked = rankResults(results);
    
    expect(ranked[0].status_norm).toBe('ACTIVE');
    expect(ranked[1].status_norm).toBe('PENDING');
    expect(ranked[2].status_norm).toBe('DEAD');
  });

  test('boosts results with overlapping classes', () => {
    const results = [
      { similarity_score: 0.8, status_norm: 'ACTIVE', classes: [5, 10] },
      { similarity_score: 0.8, status_norm: 'ACTIVE', classes: [25, 30] },
    ];

    const ranked = rankResults(results, [5, 30]);
    
    expect(ranked[0].classes).toContain(5);
  });
});
