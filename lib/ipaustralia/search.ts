import { getIPAUTradeMarkById, quickSearchIPAU } from '@/lib/ipaustralia/client';
import { IPAUQuickSearchRequest, IPAUStatus, IPAUTrademarkDetailResponse } from '@/lib/ipaustralia/types';
import { trigramSimilarity } from '@/lib/similarity';

export interface UnifiedTrademarkResult {
  office: string;
  serial_number: string;
  registration_number: string | null;
  mark_text: string | null;
  status_norm: string | null;
  owner_name: string | null;
  owner_country: string | null;
  filing_date: string | null;
  classes: number[];
  sim_trgm: number;
  sim_final: number;
  similarity_score: number;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
}

interface SearchIPAustraliaOptions {
  maxDetails?: number;
  statusFilters?: Array<'ACTIVE' | 'PENDING' | 'DEAD'>;
}

function mapStatusGroupToNorm(statusGroup?: string | null): 'ACTIVE' | 'PENDING' | 'DEAD' | null {
  if (!statusGroup) return null;
  const value = statusGroup.toUpperCase();
  if (value === 'REGISTERED') return 'ACTIVE';
  if (value === 'PENDING') return 'PENDING';
  return 'DEAD';
}

function mapNormToIPAUStatus(statusFilters?: Array<'ACTIVE' | 'PENDING' | 'DEAD'>): IPAUStatus[] | undefined {
  if (!statusFilters || statusFilters.length === 0) return undefined;
  const values = new Set<IPAUStatus>();
  for (const status of statusFilters) {
    if (status === 'ACTIVE') values.add('REGISTERED');
    if (status === 'PENDING') values.add('PENDING');
    if (status === 'DEAD') {
      values.add('NEVER_REGISTERED');
      values.add('REFUSED');
      values.add('REMOVED');
    }
  }
  return values.size > 0 ? Array.from(values) : undefined;
}

function calculateRiskLevel(simFinal: number): 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW' {
  if (simFinal >= 0.8) return 'HIGH';
  if (simFinal >= 0.6) return 'MEDIUM';
  if (simFinal >= 0.4) return 'LOW';
  return 'VERY_LOW';
}

function normalizeWords(detail: IPAUTrademarkDetailResponse): string | null {
  const words = detail.words?.filter((w) => typeof w === 'string' && w.trim().length > 0) || [];
  if (words.length === 0) return null;
  return words.join(' ').trim();
}

function parseNiceClasses(detail: IPAUTrademarkDetailResponse): number[] {
  const values = new Set<number>();
  for (const item of detail.goodsAndServices || []) {
    const cls = parseInt(String(item.class || '').trim(), 10);
    if (!Number.isNaN(cls) && cls >= 1 && cls <= 45) {
      values.add(cls);
    }
  }
  return Array.from(values).sort((a, b) => a - b);
}

function normalizeDetail(query: string, detail: IPAUTrademarkDetailResponse): UnifiedTrademarkResult {
  const markText = normalizeWords(detail);
  const similarity = markText ? trigramSimilarity(query, markText) : 0;
  const owner = detail.owner?.[0];
  const statusNorm = mapStatusGroupToNorm(detail.statusGroup);

  return {
    office: 'IP_AU',
    serial_number: detail.number,
    registration_number: statusNorm === 'ACTIVE' ? detail.number : null,
    mark_text: markText,
    status_norm: statusNorm,
    owner_name: owner?.name || null,
    owner_country: owner?.structuredAddress?.countryName || null,
    filing_date: detail.filingDate || detail.lodgementDate || detail.priorityDate || null,
    classes: parseNiceClasses(detail),
    sim_trgm: parseFloat(similarity.toFixed(3)),
    sim_final: parseFloat(similarity.toFixed(3)),
    similarity_score: parseFloat(similarity.toFixed(3)),
    risk_level: calculateRiskLevel(similarity),
  };
}

export async function searchIPAustralia(
  query: string,
  options: SearchIPAustraliaOptions = {}
): Promise<UnifiedTrademarkResult[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) return [];

  const requestBody: IPAUQuickSearchRequest = {
    query: trimmedQuery,
    sort: { field: 'NUMBER', direction: 'ASCENDING' },
    filters: {
      quickSearchType: ['WORD'],
      status: mapNormToIPAUStatus(options.statusFilters),
    },
  };

  // Remove undefined nested fields to keep payload clean.
  if (!requestBody.filters?.status || requestBody.filters.status.length === 0) {
    delete requestBody.filters?.status;
  }

  const quickResponse = await quickSearchIPAU(requestBody);
  const ids = (quickResponse.trademarkIds || []).filter(Boolean);
  if (ids.length === 0) return [];

  const maxDetails = Math.max(1, options.maxDetails || 10);
  const selectedIds = ids.slice(0, maxDetails);
  const detailResponses = await Promise.allSettled(selectedIds.map((id) => getIPAUTradeMarkById(id)));

  const results: UnifiedTrademarkResult[] = [];
  for (const detail of detailResponses) {
    if (detail.status === 'fulfilled') {
      results.push(normalizeDetail(trimmedQuery, detail.value));
    }
  }

  // Deduplicate by office + serial_number and keep best similarity.
  const unique = new Map<string, UnifiedTrademarkResult>();
  for (const result of results) {
    const key = `${result.office}-${result.serial_number}`;
    const existing = unique.get(key);
    if (!existing || result.similarity_score > existing.similarity_score) {
      unique.set(key, result);
    }
  }

  return Array.from(unique.values()).sort((a, b) => b.similarity_score - a.similarity_score);
}
