import { searchEuipoTrademarks } from "@/lib/euipo/client";
import { EuipoApplicant, EuipoTrademarkItem } from "@/lib/euipo/types";
import { UnifiedTrademarkResult } from "@/lib/ipaustralia/search";
import { trigramSimilarity } from "@/lib/similarity";

export type { UnifiedTrademarkResult } from "@/lib/ipaustralia/search";

interface SearchEUIPOOptions {
  maxResults?: number;
  statusFilters?: Array<"ACTIVE" | "PENDING" | "DEAD">;
}

function escapeRsqlWildcardTerm(input: string): string {
  // Strip RSQL operator/grouping characters that would let a user inject filters
  // through the search bar. The remaining string is wrapped in `*…*`.
  return input.replace(/[*;,()='"\\]/g, "").trim();
}

function buildRsqlQuery(term: string): string {
  return `wordMarkSpecification.verbalElement==*${term}*`;
}

// Status enum values pulled directly from the OpenAPI spec
// (#/components/schemas/Status). Anything outside the spec falls through to
// DEAD so unknown values don't masquerade as live trademarks.
function mapEuipoStatusToNorm(
  status?: string | null,
): "ACTIVE" | "PENDING" | "DEAD" | null {
  if (!status) return null;
  const value = status.trim().toUpperCase();

  if (!value) return null;

  switch (value) {
    case "REGISTERED":
    case "ACCEPTED":
      return "ACTIVE";
    case "RECEIVED":
    case "UNDER_EXAMINATION":
    case "APPLICATION_PUBLISHED":
    case "REGISTRATION_PENDING":
    case "OPPOSITION_PENDING":
    case "APPEALED":
    case "APPEALABLE":
    case "START_OF_OPPOSITION_PERIOD":
    case "ACCEPTANCE_PENDING":
    case "CANCELLATION_PENDING":
      return "PENDING";
    case "WITHDRAWN":
    case "REFUSED":
    case "CANCELLED":
    case "SURRENDERED":
    case "EXPIRED":
    case "REMOVED_FROM_REGISTER":
      return "DEAD";
    default:
      return "DEAD";
  }
}

function calculateRiskLevel(
  simFinal: number,
): "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW" {
  if (simFinal >= 0.8) return "HIGH";
  if (simFinal >= 0.6) return "MEDIUM";
  if (simFinal >= 0.4) return "LOW";

  return "VERY_LOW";
}

function parseNiceClasses(item: EuipoTrademarkItem): number[] {
  const values = new Set<number>();

  for (const raw of item.niceClasses || []) {
    const cls = parseInt(String(raw).trim(), 10);

    if (!Number.isNaN(cls) && cls >= 1 && cls <= 45) {
      values.add(cls);
    }
  }

  return Array.from(values).sort((a, b) => a - b);
}

function pickApplicantName(applicant?: EuipoApplicant): string | null {
  return applicant?.name?.trim() || null;
}

// Map applicant.office (EM/WO) to a country-ish code for display.
// EM = EUIPO (EU), WO = WIPO (international). Search results don't carry per-
// applicant country, so this is the best signal available without a detail call.
function pickApplicantCountry(applicant?: EuipoApplicant): string | null {
  const office = applicant?.office?.trim().toUpperCase();

  if (office === "EM") return "EU";
  if (office === "WO") return "WO";

  return null;
}

function normalizeItem(
  query: string,
  item: EuipoTrademarkItem,
): UnifiedTrademarkResult {
  const markText = item.wordMarkSpecification?.verbalElement?.trim() || null;
  const similarity = markText ? trigramSimilarity(query, markText) : 0;
  const applicant = item.applicants?.[0];
  const statusNorm = mapEuipoStatusToNorm(item.status);

  return {
    office: "EUIPO",
    serial_number: item.applicationNumber,
    registration_number:
      statusNorm === "ACTIVE" ? item.applicationNumber : null,
    mark_text: markText,
    status_norm: statusNorm,
    owner_name: pickApplicantName(applicant),
    owner_country: pickApplicantCountry(applicant),
    filing_date: item.applicationDate || null,
    classes: parseNiceClasses(item),
    sim_trgm: parseFloat(similarity.toFixed(3)),
    sim_final: parseFloat(similarity.toFixed(3)),
    similarity_score: parseFloat(similarity.toFixed(3)),
    risk_level: calculateRiskLevel(similarity),
  };
}

export async function searchEUIPO(
  query: string,
  options: SearchEUIPOOptions = {},
): Promise<UnifiedTrademarkResult[]> {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) return [];

  const escaped = escapeRsqlWildcardTerm(trimmedQuery);

  if (escaped.length < 2) return [];

  const size = Math.min(20, Math.max(1, options.maxResults ?? 10));
  const response = await searchEuipoTrademarks(
    buildRsqlQuery(escaped),
    0,
    size,
  );

  const items = Array.isArray(response.trademarks) ? response.trademarks : [];

  if (items.length === 0) return [];

  const allowedStatuses =
    options.statusFilters && options.statusFilters.length > 0
      ? new Set(options.statusFilters)
      : null;

  const results: UnifiedTrademarkResult[] = [];

  for (const item of items) {
    if (!item || !item.applicationNumber) continue;
    const normalized = normalizeItem(trimmedQuery, item);

    if (
      allowedStatuses &&
      normalized.status_norm &&
      !allowedStatuses.has(
        normalized.status_norm as "ACTIVE" | "PENDING" | "DEAD",
      )
    ) {
      continue;
    }
    results.push(normalized);
  }

  // Deduplicate by office + serial_number, keep best similarity.
  const unique = new Map<string, UnifiedTrademarkResult>();

  for (const result of results) {
    const key = `${result.office}-${result.serial_number}`;
    const existing = unique.get(key);

    if (!existing || result.similarity_score > existing.similarity_score) {
      unique.set(key, result);
    }
  }

  return Array.from(unique.values()).sort(
    (a, b) => b.similarity_score - a.similarity_score,
  );
}
