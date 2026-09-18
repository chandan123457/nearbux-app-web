import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { cleanupPhone, createTestServer, uniquePhone } from './helpers.js';

/**
 * Rate limiting ka apna server instance hai jiske limits deliberately chhote
 * hain.
 *
 * Baaki suite limits ko bahut ooncha set karti hai — warna saare tests ek hi
 * IP se aate hain aur ek doosre ka budget kha lete hain, jisse failures
 * test ORDER par depend karne lagti hain. Limiter phir bhi test hona chahiye,
 * isliye woh yahan alag se hota hai.
 */
let app: FastifyInstance;
const phones: string[] = [];

beforeAll(async () => {
  app = await createTestServer({
    RATE_LIMIT_OTP_REQUEST_MAX: '2',
    RATE_LIMIT_WINDOW: '1 minute',
  });
});

afterAll(async () => {
  for (const phone of phones) await cleanupPhone(phone);
  await app.close();
});

describe('OTP rate limiting', () => {
  it('limit ke baad 429 deta hai, typed error envelope ke saath', async () => {
    const phone = uniquePhone();
    phones.push(phone);
    const send = () =>
      app.inject({ method: 'POST', url: '/v1/auth/otp/request', payload: { phone } });

    expect((await send()).statusCode).toBe(200);
    expect((await send()).statusCode).toBe(200);

    const blocked = await send();
    expect(blocked.statusCode).toBe(429);
    // Fastify ka built-in error bhi humare envelope mein convert hona chahiye
    expect(blocked.json()).toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });
});

describe('per-phone OTP throttle', () => {
  it('ek hi number par flood rokta hai chahe IP limit bachi ho', async () => {
    // Yeh IP rate limit se alag defence hai. Attacker IPs rotate kar sakta
    // hai; yeh limit phone number par lagti hai, kyunki har SMS ke paise lagte hain.
    const app2 = await createTestServer({
      RATE_LIMIT_OTP_REQUEST_MAX: '10000',
      RATE_LIMIT_WINDOW: '1 minute',
    });
    const phone = uniquePhone();
    phones.push(phone);

    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await app2.inject({
        method: 'POST',
        url: '/v1/auth/otp/request',
        payload: { phone },
      });
      codes.push(res.statusCode);
    }

    // Service 15 min window mein 5 allow karti hai
    expect(codes.filter((c) => c === 200)).toHaveLength(5);
    expect(codes.filter((c) => c === 429)).toHaveLength(2);
    await app2.close();
  });
});
