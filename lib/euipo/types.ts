// Person-shaped applicant per the OpenAPI spec (see #/components/schemas/Person).
// `office` is "EM" (EUIPO) or "WO" (WIPO); we use it as a coarse origin signal
// since per-applicant country isn't returned on search results.
export interface EuipoApplicant {
  office?: string | null;
  identifier?: string | null;
  name?: string | null;
}

export interface EuipoWordMarkSpecification {
  verbalElement?: string | null;
}

export interface EuipoTrademarkItem {
  applicationNumber: string;
  wordMarkSpecification?: EuipoWordMarkSpecification | null;
  markFeature?: string | null;
  markKind?: string | null;
  markBasis?: string | null;
  status?: string | null;
  niceClasses?: Array<number | string> | null;
  applicants?: EuipoApplicant[] | null;
  applicationDate?: string | null;
  registrationDate?: string | null;
  designationDate?: string | null;
  expiryDate?: string | null;
}

export interface EuipoSearchResponse {
  trademarks?: EuipoTrademarkItem[];
  totalElements?: number;
  totalPages?: number;
  page?: number;
  size?: number;
}
