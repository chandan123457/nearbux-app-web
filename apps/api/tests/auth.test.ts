import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@nearbux/database';
import { hash as argonHash } from '@node-rs/argon2';
import { createTestServer, cleanupPhone, TEST_OTP, uniquePhone } from './helpers.js';

let app: FastifyInstance;
const phones: string[] = [];

/**
 * OTP code hashed store hota hai, isliye test usse padh nahi sakta.
 * Iske bajaye hum ek known code ka challenge seedha insert karte hain —
 * jaise SMS bheja gaya ho.
 */
async function plantOtp(phone: string, code = TEST_OTP) {
  await prisma.otpChallenge.updateMany({
    where: { phone, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  return prisma.otpChallenge.create({
    data: {
      phone,
      codeHash: await argonHash(code),
      expiresAt: new Date(Date.now() + 5 * 60_000),
    },
  });
}

function newPhone(): string {
  const phone = uniquePhone();
  phones.push(phone);
  return phone;
}

beforeAll(async () => {
  app = await createTestServer();
});

afterAll(async () => {
  for (const phone of phones) await cleanupPhone(phone);
  await app.close();
});

describe('POST /v1/auth/otp/request', () => {
  it('OTP challenge banata hai', async () => {
    const phone = newPhone();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/request',
      payload: { phone },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ expiresInSeconds: 300 });

    const challenge = await prisma.otpChallenge.findFirst({ where: { phone } });
    expect(challenge).not.toBeNull();

    // Code PLAINTEXT store nahi hona chahiye. Argon2id verify karte hain,
    // aur confirm karte hain ki koi bhi 6-digit code stored value se
    // literally match nahi karta.
    expect(challenge!.codeHash.startsWith('$argon2id$')).toBe(true);
    expect(challenge!.codeHash).not.toMatch(/^\d{6}$/);
    expect(challenge!.codeHash.length).toBeGreaterThan(50);
  });

  it('galat phone format reject karta hai', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/request',
      payload: { phone: '9876543210' }, // +91 missing
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('BAD_REQUEST');
  });

  it('naya code maangne par purane invalidate ho jaate hain', async () => {
    const phone = newPhone();
    await app.inject({ method: 'POST', url: '/v1/auth/otp/request', payload: { phone } });
    await app.inject({ method: 'POST', url: '/v1/auth/otp/request', payload: { phone } });

    const active = await prisma.otpChallenge.count({
      where: { phone, consumedAt: null },
    });
    expect(active).toBe(1); // ek waqt par sirf ek valid code
  });
});

describe('POST /v1/auth/otp/verify', () => {
  it('pehli baar verify par user banata hai (201)', async () => {
    const phone = newPhone();
    await plantOtp(phone);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      payload: { phone, code: TEST_OTP },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.isNewUser).toBe(true);
    expect(body.tokens.accessToken).toBeTruthy();
    expect(body.tokens.refreshToken).toBeTruthy();
    expect(body.tokens.expiresInSeconds).toBe(900);

    const user = await prisma.user.findFirst({ where: { phone } });
    expect(user?.phoneVerified).toBe(true);
  });

  it('dobara login par wahi user (200), naya nahi', async () => {
    const phone = newPhone();
    await plantOtp(phone);
    await app.inject({ method: 'POST', url: '/v1/auth/otp/verify', payload: { phone, code: TEST_OTP } });

    await plantOtp(phone);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      payload: { phone, code: TEST_OTP },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().isNewUser).toBe(false);
    expect(await prisma.user.count({ where: { phone } })).toBe(1);
  });

  it('galat code reject karta hai aur attempts badhata hai', async () => {
    const phone = newPhone();
    const challenge = await plantOtp(phone);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      payload: { phone, code: '999999' },
    });

    expect(res.statusCode).toBe(400);
    const after = await prisma.otpChallenge.findUnique({ where: { id: challenge.id } });
    expect(after!.attempts).toBe(1);
  });

  it('attempt limit ke baad challenge maar deta hai', async () => {
    const phone = newPhone();
    await plantOtp(phone);

    // OTP_MAX_ATTEMPTS test mein 3 hai
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/verify',
        payload: { phone, code: '000000' },
      });
    }

    // Ab SAHI code bhi kaam nahi karna chahiye
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      payload: { phone, code: TEST_OTP },
    });
    expect(res.statusCode).toBe(400);
  });

  it('expired code reject karta hai', async () => {
    const phone = newPhone();
    await prisma.otpChallenge.create({
      data: {
        phone,
        codeHash: await argonHash(TEST_OTP),
        expiresAt: new Date(Date.now() - 1000), // already expired
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      payload: { phone, code: TEST_OTP },
    });
    expect(res.statusCode).toBe(400);
  });

  it('OTP ek hi baar use ho sakta hai', async () => {
    const phone = newPhone();
    await plantOtp(phone);

    const first = await app.inject({ method: 'POST', url: '/v1/auth/otp/verify', payload: { phone, code: TEST_OTP } });
    expect(first.statusCode).toBe(201);

    const replay = await app.inject({ method: 'POST', url: '/v1/auth/otp/verify', payload: { phone, code: TEST_OTP } });
    expect(replay.statusCode).toBe(400);
  });
});
