import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { cleanupPhone, createTestServer, signupAccount, TEST_PASSWORD, uniquePhone } from './helpers.js';

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
    RATE_LIMIT_LOGIN_MAX: '3',
    RATE_LIMIT_SIGNUP_MAX: '2',
    RATE_LIMIT_WINDOW: '1 minute',
  });
});

afterAll(async () => {
  for (const phone of phones) await cleanupPhone(phone);
  await app.close();
});

/**
 * Login brute-force ka asli surface hai.
 *
 * OTP ke ulta, yahan attacker ke paas guess karne layak kuch hai — ek
 * password. Bina limit ke ek sakht password bhi bas waqt ki baat hai.
 */
describe('login rate limiting', () => {
  it('limit ke baad 429 deta hai, typed error envelope ke saath', async () => {
    const phone = uniquePhone();
    phones.push(phone);
    await signupAccount(app, { phone });

    const attempt = () =>
      app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { phone, password: 'wrongpassword1' },
      });

    // Pehle teen 401 dete hain (galat password), chauthe par limiter lagta hai
    expect((await attempt()).statusCode).toBe(401);
    expect((await attempt()).statusCode).toBe(401);
    expect((await attempt()).statusCode).toBe(401);

    const blocked = await attempt();
    expect(blocked.statusCode).toBe(429);
    // Fastify ka built-in error bhi humare envelope mein convert hona chahiye
    expect(blocked.json()).toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });

  it('sahi password bhi limit ke baad block hota hai', async () => {
    const phone = uniquePhone();
    phones.push(phone);
    await signupAccount(app, { phone });

    // signup khud login limit nahi kharch karta, isliye budget pura hai
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { phone, password: TEST_PASSWORD },
      });
    }

    const blocked = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { phone, password: TEST_PASSWORD },
    });
    expect(blocked.statusCode).toBe(429);
  });
});

/**
 * Signup har hit par ek user row banata hai, aur client har attempt se pehle
 * ek Firebase SMS trigger karta hai. Dono ke paise lagte hain.
 */
describe('signup rate limiting', () => {
  it('limit ke baad 429 deta hai', async () => {
    const app2 = await createTestServer({
      RATE_LIMIT_SIGNUP_MAX: '2',
      RATE_LIMIT_WINDOW: '1 minute',
    });

    const attempt = async () => {
      const phone = uniquePhone();
      phones.push(phone);
      return app2.inject({
        method: 'POST',
        url: '/v1/auth/signup',
        payload: { phone, password: TEST_PASSWORD, fullName: 'Rahul Sharma' },
      });
    };

    expect((await attempt()).statusCode).toBe(201);
    expect((await attempt()).statusCode).toBe(201);
    expect((await attempt()).statusCode).toBe(429);

    await app2.close();
  });
});
