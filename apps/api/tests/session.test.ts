import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@nearbux/database';
import { hash as argonHash } from '@node-rs/argon2';
import { createTestServer, cleanupPhone, TEST_OTP, uniquePhone } from './helpers.js';

let app: FastifyInstance;
const phones: string[] = [];

async function login(): Promise<{ phone: string; accessToken: string; refreshToken: string }> {
  const phone = uniquePhone();
  phones.push(phone);
  await prisma.otpChallenge.create({
    data: { phone, codeHash: await argonHash(TEST_OTP), expiresAt: new Date(Date.now() + 300_000) },
  });
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/otp/verify',
    payload: { phone, code: TEST_OTP, fullName: 'Rahul Sharma' },
  });
  const tokens = res.json().tokens;
  return { phone, ...tokens };
}

beforeAll(async () => {
  app = await createTestServer();
});

afterAll(async () => {
  for (const phone of phones) await cleanupPhone(phone);
  await app.close();
});

describe('refresh token rotation', () => {
  it('naye tokens deta hai aur purana refresh token maar deta hai', async () => {
    const session = await login();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: session.refreshToken },
    });

    expect(res.statusCode).toBe(200);
    const fresh = res.json();
    expect(fresh.refreshToken).not.toBe(session.refreshToken); // rotate hua
    expect(fresh.accessToken).toBeTruthy();
  });

  it('refresh token database mein PLAINTEXT store nahi hota', async () => {
    const session = await login();
    const stored = await prisma.session.findFirst({
      where: { user: { phone: session.phone } },
    });
    expect(stored).not.toBeNull();
    expect(stored!.tokenHash).not.toBe(session.refreshToken);
    expect(stored!.tokenHash).toHaveLength(64); // SHA-256 hex
  });

  it('REUSE DETECTION: purana token dobara use karne par saare sessions revoke', async () => {
    const session = await login();

    // Legit rotation
    const rotated = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: session.refreshToken },
    });
    const newToken = rotated.json().refreshToken;

    // Attacker chura hua purana token use karta hai
    const reuse = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: session.refreshToken },
    });
    expect(reuse.statusCode).toBe(401);

    // Aur ab legit client ka naya token bhi mar chuka hai — dono logout.
    // Victim dobara login karke recover karta hai; attacker ke paas kuch nahi.
    const afterBreach = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: newToken },
    });
    expect(afterBreach.statusCode).toBe(401);
  });

  it('unknown refresh token reject karta hai', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: 'totally-made-up-token' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('logout', () => {
  it('refresh token revoke karta hai', async () => {
    const session = await login();

    const out = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: { refreshToken: session.refreshToken },
    });
    expect(out.statusCode).toBe(204);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: session.refreshToken },
    });
    expect(res.statusCode).toBe(401);
  });

  it('idempotent hai — unknown token par bhi 204', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: { refreshToken: 'never-existed' },
    });
    expect(res.statusCode).toBe(204);
  });

  it('logout-all sab devices ke sessions maar deta hai', async () => {
    const first = await login();
    const phone = first.phone;

    // Usi user ka doosra device
    await prisma.otpChallenge.create({
      data: { phone, codeHash: await argonHash(TEST_OTP), expiresAt: new Date(Date.now() + 300_000) },
    });
    const secondRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      payload: { phone, code: TEST_OTP },
    });
    const second = secondRes.json().tokens;

    await app.inject({
      method: 'POST',
      url: '/v1/auth/logout-all',
      headers: { authorization: `Bearer ${first.accessToken}` },
    });

    for (const token of [first.refreshToken, second.refreshToken]) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken: token },
      });
      expect(res.statusCode).toBe(401);
    }
  });
});

describe('protected routes', () => {
  it('bina token ke /me reject karta hai', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('UNAUTHORIZED');
  });

  it('galat token reject karta hai', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: 'Bearer not-a-real-jwt' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('valid token par profile deta hai, initials ke saath', async () => {
    const session = await login();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${session.accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      phone: session.phone,
      fullName: 'Rahul Sharma',
      initials: 'RS', // screen [12] ka avatar
    });
  });

  it('profile update karta hai', async () => {
    const session = await login();
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me',
      headers: { authorization: `Bearer ${session.accessToken}` },
      payload: { fullName: 'Rahul K Sharma' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ fullName: 'Rahul K Sharma', initials: 'RK' });
  });
});

describe('health', () => {
  it('liveness database touch nahi karta', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });

  it('readiness database check karta hai', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ready', database: 'up' });
  });

  it('unknown route par typed 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('NOT_FOUND');
  });
});
