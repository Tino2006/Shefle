import { EuipoSearchResponse } from "@/lib/euipo/types";

interface EuipoTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

const DEFAULT_EUIPO_API_BASE_URL =
  "https://api.euipo.europa.eu/trademark-search";
// Per the OpenAPI spec, the CAS auth server lives on the bare domain (no api. prefix).
const DEFAULT_EUIPO_TOKEN_URL =
  "https://euipo.europa.eu/cas-server-webapp/oidc/accessToken";

let cachedAccessToken: string | null = null;
let cachedTokenExpiry = 0;
let inflightTokenPromise: Promise<string> | null = null;

function getEnvOrThrow(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

function getApiBaseUrl(): string {
  return (process.env.EUIPO_API_BASE_URL || DEFAULT_EUIPO_API_BASE_URL).replace(
    /\/+$/,
    "",
  );
}

function getTokenUrl(): string {
  return process.env.EUIPO_TOKEN_URL || DEFAULT_EUIPO_TOKEN_URL;
}

async function fetchAccessToken(): Promise<string> {
  const apiKey = getEnvOrThrow("EUIPO_API_KEY");
  const apiSecret = getEnvOrThrow("EUIPO_API_SECRET");
  const tokenUrl = getTokenUrl();
  const basic = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "uid",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${basic}`,
    },
    body: body.toString(),
    signal: withTimeout(8000),
  });

  console.log(`[EUIPO] token request → ${response.status}`);

  if (!response.ok) {
    const text = await response.text();

    throw new Error(`EUIPO token request failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as EuipoTokenResponse;

  if (!payload.access_token) {
    throw new Error("EUIPO token response missing access_token");
  }

  const expiresIn = Math.max(60, payload.expires_in || 3600);

  // Refresh before full expiry to avoid edge races in concurrent requests.
  cachedTokenExpiry = Date.now() + Math.floor(expiresIn * 0.8 * 1000);
  cachedAccessToken = payload.access_token;

  return payload.access_token;
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  if (forceRefresh) {
    cachedAccessToken = null;
    cachedTokenExpiry = 0;
  }

  if (cachedAccessToken && Date.now() < cachedTokenExpiry) {
    return cachedAccessToken;
  }

  if (!inflightTokenPromise) {
    inflightTokenPromise = fetchAccessToken().finally(() => {
      inflightTokenPromise = null;
    });
  }

  return inflightTokenPromise;
}

async function fetchEuipo<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = getEnvOrThrow("EUIPO_API_KEY");
  const url = `${getApiBaseUrl()}${path}`;

  const send = async (token: string): Promise<Response> => {
    const headers = new Headers(init.headers);

    headers.set("Accept", "application/json");
    headers.set("X-IBM-Client-Id", apiKey);
    headers.set("Authorization", `Bearer ${token}`);

    return fetch(url, {
      ...init,
      headers,
      signal: withTimeout(10000),
    });
  };

  let token = await getAccessToken();
  let response = await send(token);

  // One retry on 401 to cover token-expired-mid-flight.
  if (response.status === 401) {
    token = await getAccessToken(true);
    response = await send(token);
  }

  console.log(`[EUIPO] ${init.method || "GET"} ${path} → ${response.status}`);

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `EUIPO API request failed (${response.status}) at ${path}: ${text}`,
    );
  }

  return (await response.json()) as T;
}

export async function searchEuipoTrademarks(
  rsql: string,
  page: number,
  size: number,
): Promise<EuipoSearchResponse> {
  const params = new URLSearchParams({
    query: rsql,
    page: String(page),
    size: String(size),
  });

  return fetchEuipo<EuipoSearchResponse>(`/trademarks?${params.toString()}`, {
    method: "GET",
  });
}
