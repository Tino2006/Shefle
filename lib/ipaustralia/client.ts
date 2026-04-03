import {
  IPAUQuickSearchRequest,
  IPAUQuickSearchResponse,
  IPAUTrademarkDetailResponse,
} from '@/lib/ipaustralia/types';

const DEFAULT_IP_AU_BASE_URL =
  'https://production.api.ipaustralia.gov.au/public/australian-trade-mark-search-api/v1';
const DEFAULT_IP_AU_TOKEN_URL =
  'https://production.api.ipaustralia.gov.au/public/external-token-api/v1/access_token';

interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

let cachedAccessToken: string | null = null;
let cachedTokenType: string = 'Bearer';
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
  return (process.env.IP_AU_BASE_URL || DEFAULT_IP_AU_BASE_URL).replace(/\/+$/, '');
}

function getTokenUrl(): string {
  return process.env.IP_AU_TOKEN_URL || DEFAULT_IP_AU_TOKEN_URL;
}

function getEnvironmentFromUrl(url: string): 'production' | 'test' | 'unknown' {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('production.api.ipaustralia.gov.au')) return 'production';
    if (host.includes('test.api.ipaustralia.gov.au')) return 'test';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

async function fetchAccessToken(): Promise<string> {
  const clientId = getEnvOrThrow('IP_AU_CLIENT_ID');
  const clientSecret = getEnvOrThrow('IP_AU_CLIENT_SECRET');
  const tokenUrl = getTokenUrl();
  const apiBaseUrl = getApiBaseUrl();

  const tokenEnv = getEnvironmentFromUrl(tokenUrl);
  const apiEnv = getEnvironmentFromUrl(apiBaseUrl);

  console.info('[IP AU OAuth] Token URL:', tokenUrl);
  console.info('[IP AU OAuth] Env vars present:', {
    hasClientId: Boolean(process.env.IP_AU_CLIENT_ID),
    hasClientSecret: Boolean(process.env.IP_AU_CLIENT_SECRET),
  });
  if (tokenEnv !== apiEnv) {
    console.warn('[IP AU OAuth] Environment mismatch between token and API URLs:', {
      tokenUrlEnvironment: tokenEnv,
      apiBaseUrlEnvironment: apiEnv,
      tokenUrl,
      apiBaseUrl,
    });
  } else {
    console.info('[IP AU OAuth] Token/API URL environments aligned:', tokenEnv);
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
    signal: withTimeout(8000),
  });
  const rawResponseText = await response.text();

  if (!response.ok) {
    console.error('[IP AU OAuth] Raw token response body (non-200):', rawResponseText);
    throw new Error(`IP Australia token request failed (${response.status}): ${rawResponseText}`);
  }

  let payload: TokenResponse;
  try {
    payload = JSON.parse(rawResponseText) as TokenResponse;
  } catch (error) {
    throw new Error(`IP Australia token response was not valid JSON: ${rawResponseText}`);
  }

  if (!payload.access_token) {
    throw new Error('IP Australia token response missing access_token');
  }

  const expiresIn = Math.max(60, payload.expires_in || 3600);
  // Refresh before full expiry to avoid edge races in concurrent requests.
  cachedTokenExpiry = Date.now() + Math.floor(expiresIn * 0.8 * 1000);
  cachedAccessToken = payload.access_token;
  cachedTokenType = payload.token_type || 'Bearer';
  return payload.access_token;
}

async function getAccessToken(): Promise<string> {
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

async function fetchIPAU<T>(path: string, init: RequestInit): Promise<T> {
  const accessToken = await getAccessToken();
  const url = `${getApiBaseUrl()}${path}`;
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `${cachedTokenType} ${accessToken}`);

  const response = await fetch(url, {
    ...init,
    headers,
    signal: withTimeout(10000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`IP Australia API request failed (${response.status}) at ${path}: ${text}`);
  }

  return (await response.json()) as T;
}

export async function quickSearchIPAU(
  payload: IPAUQuickSearchRequest
): Promise<IPAUQuickSearchResponse> {
  return fetchIPAU<IPAUQuickSearchResponse>('/search/quick', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function getIPAUTradeMarkById(id: string): Promise<IPAUTrademarkDetailResponse> {
  return fetchIPAU<IPAUTrademarkDetailResponse>(`/trade-mark/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
}
