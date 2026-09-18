import { ApiClientError, ERROR_CODES } from './errors.js';
import { TOKEN_KEYS, type TokenStorage } from './token-storage.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface ApiClientOptions {
  baseUrl: string;
  storage: TokenStorage;
  /**
   * Refresh fail hone par call hota hai (token chori, session expired,
   * account delete). App ise sign-in screen par bhejne ke liye use karta hai.
   */
  onAuthFailure?: () => void | Promise<void>;
  /** Milliseconds. Neon + Render dono cold start karte hain — udaar rakho. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Auth endpoints par access token attach nahi hota */
  skipAuth?: boolean;
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean | undefined>;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export function createApiClient(options: ApiClientOptions) {
  const {
    baseUrl,
    storage,
    onAuthFailure,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = fetch,
  } = options;

  /**
   * Ek waqt par ek hi refresh.
   *
   * Yeh is client ka sabse important hissa hai. App load par typically 3-4
   * requests ek saath jaati hain (home feed, cart, notifications). Access
   * token expire ho to sab 401 dengi. Bina is lock ke sab apna refresh
   * bhejengi — aur refresh rotation ka matlab hai ki pehli safal hone ke baad
   * baaki REUSE dikhengi, jisse server user ke saare sessions revoke kar dega
   * aur woh bina kisi galti ke logout ho jaayega.
   *
   * Isliye ek in-flight refresh promise share hoti hai.
   */
  let refreshInFlight: Promise<string | null> | null = null;

  function buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = new URL(path.replace(/^\//, ''), `${baseUrl.replace(/\/$/, '')}/`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  async function rawRequest(
    path: string,
    opts: RequestOptions,
    accessToken: string | null,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Caller ka signal humare timeout signal ke saath chalna chahiye
    if (opts.signal) {
      if (opts.signal.aborted) controller.abort();
      else opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const headers: Record<string, string> = { accept: 'application/json' };
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    if (accessToken && !opts.skipAuth) headers.authorization = `Bearer ${accessToken}`;

    try {
      return await fetchImpl(buildUrl(path, opts.query), {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: controller.signal,
      });
    } catch (cause) {
      const aborted = cause instanceof Error && cause.name === 'AbortError';
      throw new ApiClientError(
        aborted ? ERROR_CODES.TIMEOUT : ERROR_CODES.NETWORK,
        aborted
          ? 'The request took too long. Please try again.'
          : 'Cannot reach NearBux. Check your connection.',
        0,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async function parseResponse<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;

    const raw = await response.text();
    let payload: unknown = undefined;
    if (raw.length > 0) {
      try {
        payload = JSON.parse(raw);
      } catch {
        // Server ne JSON nahi bheja — proxy error page ya crash
        if (!response.ok) {
          throw new ApiClientError(ERROR_CODES.UNKNOWN, 'Something went wrong', response.status);
        }
      }
    }

    if (!response.ok) {
      const body = (payload ?? {}) as { code?: string; message?: string; details?: unknown };
      throw new ApiClientError(
        body.code ?? ERROR_CODES.UNKNOWN,
        body.message ?? 'Something went wrong',
        response.status,
        body.details,
      );
    }

    return payload as T;
  }

  async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = await storage.get(TOKEN_KEYS.REFRESH);
    if (!refreshToken) return null;

    const response = await rawRequest(
      '/v1/auth/refresh',
      { method: 'POST', body: { refreshToken }, skipAuth: true },
      null,
    );

    if (!response.ok) {
      // Refresh token mar chuka hai — dono clear karo aur app ko batao
      await storage.remove(TOKEN_KEYS.ACCESS);
      await storage.remove(TOKEN_KEYS.REFRESH);
      await onAuthFailure?.();
      return null;
    }

    const tokens = (await response.json()) as AuthTokens;
    await storage.set(TOKEN_KEYS.ACCESS, tokens.accessToken);
    await storage.set(TOKEN_KEYS.REFRESH, tokens.refreshToken);
    return tokens.accessToken;
  }

  function refreshOnce(): Promise<string | null> {
    refreshInFlight ??= refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }

  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const accessToken = opts.skipAuth ? null : await storage.get(TOKEN_KEYS.ACCESS);
    const response = await rawRequest(path, opts, accessToken);

    // 401 par ek baar refresh karke retry — sirf ek baar, warna infinite loop
    if (response.status === 401 && !opts.skipAuth) {
      const fresh = await refreshOnce();
      if (!fresh) {
        throw new ApiClientError(
          ERROR_CODES.UNAUTHORIZED,
          'Please sign in again.',
          401,
        );
      }
      const retried = await rawRequest(path, opts, fresh);
      return parseResponse<T>(retried);
    }

    return parseResponse<T>(response);
  }

  return {
    request,

    async setTokens(tokens: AuthTokens): Promise<void> {
      await storage.set(TOKEN_KEYS.ACCESS, tokens.accessToken);
      await storage.set(TOKEN_KEYS.REFRESH, tokens.refreshToken);
    },

    async clearTokens(): Promise<void> {
      await storage.remove(TOKEN_KEYS.ACCESS);
      await storage.remove(TOKEN_KEYS.REFRESH);
    },

    async isSignedIn(): Promise<boolean> {
      return (await storage.get(TOKEN_KEYS.REFRESH)) !== null;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
