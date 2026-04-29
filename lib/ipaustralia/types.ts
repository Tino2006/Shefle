export type IPAUSortField = "NUMBER" | "IR_NUMBER" | "NAME" | "WORD";
export type IPAUSortDirection = "ASCENDING" | "DESCENDING";
export type IPAUQuickSearchType = "NUMBER" | "IR_NUMBER" | "NAME" | "WORD";
export type IPAUStatus =
  | "REGISTERED"
  | "NEVER_REGISTERED"
  | "PENDING"
  | "REFUSED"
  | "REMOVED";

export interface IPAUQuickSearchRequest {
  query: string;
  sort?: {
    field: IPAUSortField;
    direction: IPAUSortDirection;
  };
  filters?: {
    quickSearchType?: IPAUQuickSearchType[];
    status?: IPAUStatus[];
  };
  changedSinceDate?: string;
}

export interface IPAUQuickSearchResponse {
  request?: IPAUQuickSearchRequest;
  count: number;
  trademarkIds: string[];
  aggregations?: {
    quickSearchType?: Record<string, number>;
    status?: Record<string, number>;
  };
}

export interface IPAUAddress {
  addressLineText?: string[];
  suburb?: string;
  state?: string;
  countryName?: string;
  postalCode?: string;
}

export interface IPAUParty {
  abn?: string | null;
  acnOrArbn?: string | null;
  name?: string | null;
  jurisdiction?: string | null;
  structuredAddress?: IPAUAddress | null;
}

export interface IPAUGoodsAndServices {
  class?: string | null;
  descriptionText?: string[];
}

export interface IPAUTrademarkDetailResponse {
  number: string;
  irNumber?: string | null;
  words?: string[];
  kind?: string[];
  statusGroup?: IPAUStatus | string | null;
  statusCode?: string | null;
  statusDetail?: string | null;
  filingDate?: string | null;
  lodgementDate?: string | null;
  priorityDate?: string | null;
  renewalDueDate?: string | null;
  owner?: IPAUParty[];
  goodsAndServices?: IPAUGoodsAndServices[];
}
