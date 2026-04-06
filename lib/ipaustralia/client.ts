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

function getOptionalScope(): string | null {
  return process.env.IP_AU_OAUTH_SCOPE?.trim() || null;
}

async function requestTokenWithStrategy(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  strategy: 'body' | 'basic'
): Promise<Response> {
  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  const scope = getOptionalScope();
  if (scope) {
    body.set('scope', scope);
  }

  const headers = new Headers({
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  });

  if (strategy === 'body') {
    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);
  } else {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    headers.set('Authorization', `Basic ${basic}`);
  }

  return fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: body.toString(),
    signal: withTimeout(8000),
  });
}

async function fetchAccessToken(): Promise<string> {
  const clientId = getEnvOrThrow('IP_AU_CLIENT_ID');
  const clientSecret = getEnvOrThrow('IP_AU_CLIENT_SECRET');
  const tokenUrl = getTokenUrl();

  const responseBodyStrategy = await requestTokenWithStrategy(tokenUrl, clientId, clientSecret, 'body');
  const response = responseBodyStrategy.ok
    ? responseBodyStrategy
    : await requestTokenWithStrategy(tokenUrl, clientId, clientSecret, 'basic');

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `IP Australia token request failed (${response.status}): ${text}. ` +
        'Tried both OAuth client-credentials formats (client_id/client_secret in body and HTTP Basic auth).'
    );
  }

  const payload = (await response.json()) as TokenResponse;
  if (!payload.access_token) {
    throw new Error('IP Australia token response missing access_token');
  }

  const expiresIn = Math.max(60, payload.expires_in || 3600);
  // Refresh before full expiry to avoid edge races in concurrent requests.
  cachedTokenExpiry = Date.now() + Math.floor(expiresIn * 0.8 * 1000);
  cachedAccessToken = payload.access_token;
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
  headers.set('Authorization', `Bearer ${accessToken}`);

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
