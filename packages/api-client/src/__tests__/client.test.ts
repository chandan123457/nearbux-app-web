import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../client.js';
import { createMemoryTokenStorage, TOKEN_KEYS } from '../token-storage.js';
import { ApiClientError } from '../errors.js';

const BASE = 'https://api.test';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function setup(fetchImpl: typeof fetch, onAuthFailure?: () => void) {
  const storage = createMemoryTokenStorage();
  const client = createApiClient({ baseUrl: BASE, storage, fetchImpl, onAuthFailure });
  return { client, storage };
}

describe('request', () => {
  it('signed in hone par Authorization header bhejta hai', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ ok: true }),
    );
    const { client, storage } = setup(fetchImpl as unknown as typeof fetch);
    await storage.set(TOKEN_KEYS.ACCESS, 'access-123');

    await client.request('/v1/me');

    const init = fetchImpl.mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer access-123');
  });

  it('skipAuth par Authorization nahi bhejta', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ ok: true }),
    );
    const { client, storage } = setup(fetchImpl as unknown as typeof fetch);
    await storage.set(TOKEN_KEYS.ACCESS, 'access-123');

    await client.request('/v1/auth/otp/request', { method: 'POST', skipAuth: true, body: {} });

    const init = fetchImpl.mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('query params build karta hai', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse([]));
    const { client } = setup(fetchImpl as unknown as typeof fetch);

    await client.request('/v1/search', { query: { q: 'Fresh organic', limit: 20, skip: undefined } });

    const url = fetchImpl.mock.calls[0]![0];
    expect(url).toContain('q=Fresh+organic');
    expect(url).toContain('limit=20');
    expect(url).not.toContain('skip');
  });

  it('204 par undefined deta hai, parse crash nahi karta', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const { client } = setup(fetchImpl as unknown as typeof fetch);
    await expect(client.request('/v1/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });
});

describe('error normalization', () => {
  it('server ka error envelope ApiClientError mein badalta hai', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { code: 'BAD_REQUEST', message: 'Validation failed', details: [{ field: 'phone' }] },
        400,
      ),
    );
    const { client } = setup(fetchImpl as unknown as typeof fetch);

    const error = await client.request('/v1/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    const apiError = error as ApiClientError;
    expect(apiError.code).toBe('BAD_REQUEST');
    expect(apiError.status).toBe(400);
    expect(apiError.details).toEqual([{ field: 'phone' }]);
  });

  it('network failure ko typed error banata hai, raw throw nahi', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const { client } = setup(fetchImpl as unknown as typeof fetch);

    const error = (await client.request('/v1/me').catch((e: unknown) => e)) as ApiClientError;
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error.isNetworkError).toBe(true);
    expect(error.isRetryable).toBe(true);
  });

  it('non-JSON error body par bhi crash nahi karta', async () => {
    // Proxies aur crashed servers HTML bhejte hain, JSON nahi
    const fetchImpl = vi.fn(async () => new Response('<html>502 Bad Gateway</html>', { status: 502 }));
    const { client } = setup(fetchImpl as unknown as typeof fetch);

    const error = (await client.request('/v1/me').catch((e: unknown) => e)) as ApiClientError;
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error.status).toBe(502);
    expect(error.isRetryable).toBe(true);
  });
});

describe('token refresh', () => {
  it('401 par refresh karke request retry karta hai', async () => {
    let call = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      call += 1;
      if (String(url).includes('/auth/refresh')) {
        return jsonResponse({ accessToken: 'new-access', refreshToken: 'new-refresh', expiresInSeconds: 900 });
      }
      return call === 1 ? jsonResponse({ code: 'UNAUTHORIZED' }, 401) : jsonResponse({ id: 'u1' });
    });

    const { client, storage } = setup(fetchImpl as unknown as typeof fetch);
    await storage.set(TOKEN_KEYS.ACCESS, 'stale');
    await storage.set(TOKEN_KEYS.REFRESH, 'refresh-1');

    await expect(client.request('/v1/me')).resolves.toEqual({ id: 'u1' });
    // Naye tokens persist hone chahiye
    expect(await storage.get(TOKEN_KEYS.ACCESS)).toBe('new-access');
    expect(await storage.get(TOKEN_KEYS.REFRESH)).toBe('new-refresh');
  });

  /**
   * Yeh is poore client ka sabse important test.
   *
   * App load par kai requests ek saath jaati hain. Agar access token expired
   * ho to sab 401 dengi. Bina dedup ke sab apna refresh bhejengi — aur server
   * refresh tokens ROTATE karta hai, to pehli ke baad baaki "reuse" dikhengi
   * aur server user ke saare sessions revoke kar dega. User bina kisi galti
   * ke logout ho jaayega, aur bug reproduce karna lagbhag namumkin hoga.
   */
  it('concurrent 401s par SIRF EK refresh bhejta hai', async () => {
    let refreshCalls = 0;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const href = String(url);
      if (href.includes('/auth/refresh')) {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 20)); // network latency
        return jsonResponse({ accessToken: 'fresh', refreshToken: 'r2', expiresInSeconds: 900 });
      }
      const headers = init?.headers as Record<string, string> | undefined;
      return headers?.authorization === 'Bearer fresh'
        ? jsonResponse({ ok: href })
        : jsonResponse({ code: 'UNAUTHORIZED' }, 401);
    });

    const { client, storage } = setup(fetchImpl as unknown as typeof fetch);
    await storage.set(TOKEN_KEYS.ACCESS, 'stale');
    await storage.set(TOKEN_KEYS.REFRESH, 'r1');

    await Promise.all([
      client.request('/v1/home'),
      client.request('/v1/cart'),
      client.request('/v1/notifications'),
      client.request('/v1/me'),
    ]);

    expect(refreshCalls).toBe(1);
  });

  it('refresh fail hone par tokens clear aur onAuthFailure call', async () => {
    const onAuthFailure = vi.fn();
    const fetchImpl = vi.fn(async (url: string) =>
      String(url).includes('/auth/refresh')
        ? jsonResponse({ code: 'UNAUTHORIZED' }, 401)
        : jsonResponse({ code: 'UNAUTHORIZED' }, 401),
    );

    const { client, storage } = setup(fetchImpl as unknown as typeof fetch, onAuthFailure);
    await storage.set(TOKEN_KEYS.ACCESS, 'stale');
    await storage.set(TOKEN_KEYS.REFRESH, 'dead');

    await expect(client.request('/v1/me')).rejects.toBeInstanceOf(ApiClientError);
    expect(onAuthFailure).toHaveBeenCalledOnce();
    expect(await storage.get(TOKEN_KEYS.ACCESS)).toBeNull();
    expect(await storage.get(TOKEN_KEYS.REFRESH)).toBeNull();
  });

  it('refresh token na hone par refresh try nahi karta', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ code: 'UNAUTHORIZED' }, 401));
    const { client } = setup(fetchImpl as unknown as typeof fetch);

    await expect(client.request('/v1/me')).rejects.toBeInstanceOf(ApiClientError);
    // Ek hi call — signed out hone par refresh attempt nahi
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('retry ke baad dobara 401 aaye to loop nahi karta', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      String(url).includes('/auth/refresh')
        ? jsonResponse({ accessToken: 'a2', refreshToken: 'r2', expiresInSeconds: 900 })
        : jsonResponse({ code: 'UNAUTHORIZED' }, 401),
    );

    const { client, storage } = setup(fetchImpl as unknown as typeof fetch);
    await storage.set(TOKEN_KEYS.ACCESS, 'a1');
    await storage.set(TOKEN_KEYS.REFRESH, 'r1');

    await expect(client.request('/v1/me')).rejects.toBeInstanceOf(ApiClientError);
    // original + refresh + ek retry = 3, iske baad ruk jaana chahiye
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe('session helpers', () => {
  let client: ReturnType<typeof createApiClient>;
  let storage: ReturnType<typeof createMemoryTokenStorage>;

  beforeEach(() => {
    const s = setup((async () => jsonResponse({})) as unknown as typeof fetch);
    client = s.client;
    storage = s.storage;
  });

  it('isSignedIn refresh token par depend karta hai, access par nahi', async () => {
    expect(await client.isSignedIn()).toBe(false);
    // Access token expire ho jaata hai; refresh token hi asli session hai
    await storage.set(TOKEN_KEYS.REFRESH, 'r1');
    expect(await client.isSignedIn()).toBe(true);
  });

  it('clearTokens dono hata deta hai', async () => {
    await client.setTokens({ accessToken: 'a', refreshToken: 'r', expiresInSeconds: 900 });
    await client.clearTokens();
    expect(await client.isSignedIn()).toBe(false);
  });
});
