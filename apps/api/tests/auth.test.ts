import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@nearbux/database';
import { verify as argonVerify } from '@node-rs/argon2';
import { cleanupPhone, createTestServer, signupAccount, TEST_PASSWORD, uniquePhone } from './helpers.js';

let app: FastifyInstance;
const phones: string[] = [];

/** Har test ka phone cleanup list mein jaata hai */
function trackedPhone(): string {
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

describe('POST /v1/auth/signup', () => {
  it('naya account banata hai aur tokens deta hai (201)', async () => {
    const phone = trackedPhone();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { phone, password: TEST_PASSWORD, fullName: 'Rahul Sharma' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ isNewUser: true });
    expect(res.json().tokens.accessToken).toBeTruthy();

    const user = await prisma.user.findFirstOrThrow({ where: { phone } });
    expect(user.fullName).toBe('Rahul Sharma');
    expect(user.phoneVerified).toBe(true);
  });

  it('password PLAINTEXT store nahi hota', async () => {
    const phone = trackedPhone();
    await signupAccount(app, { phone });

    const user = await prisma.user.findFirstOrThrow({ where: { phone } });
    expect(user.passwordHash).not.toBe(TEST_PASSWORD);
    expect(user.passwordHash).toMatch(/^\$argon2/);
    // Hash sach mein usi password ka hai
    await expect(argonVerify(user.passwordHash!, TEST_PASSWORD)).resolves.toBe(true);
  });

  it('kamzor password reject karta hai', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { phone: uniquePhone(), password: 'short', fullName: 'Rahul Sharma' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('BAD_REQUEST');
  });

  it('bina digit wala password reject karta hai', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { phone: uniquePhone(), password: 'onlyletters', fullName: 'Rahul Sharma' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('galat phone format reject karta hai', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { phone: '9876543210', password: TEST_PASSWORD, fullName: 'Rahul Sharma' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().details?.[0]?.field).toBe('phone');
  });

  it('ek hi number par dobara signup reject karta hai', async () => {
    const phone = trackedPhone();
    await signupAccount(app, { phone });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/signup',
      payload: { phone, password: TEST_PASSWORD, fullName: 'Someone Else' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('PHONE_ALREADY_REGISTERED');
  });

  it('naam signup se aata hai, kisi default se nahi', async () => {
    const phone = trackedPhone();
    await signupAccount(app, { phone, fullName: 'Priya Nair' });

    const user = await prisma.user.findFirstOrThrow({ where: { phone } });
    expect(user.fullName).toBe('Priya Nair');
  });
});

describe('POST /v1/auth/login', () => {
  it('sahi password par tokens deta hai', async () => {
    const phone = trackedPhone();
    await signupAccount(app, { phone });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { phone, password: TEST_PASSWORD },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().tokens.refreshToken).toBeTruthy();
  });

  it('galat password reject karta hai', async () => {
    const phone = trackedPhone();
    await signupAccount(app, { phone });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { phone, password: 'wrongpassword1' },
    });

    expect(res.statusCode).toBe(401);
  });

  /**
   * Enumeration test.
   *
   * Unknown number aur galat password — dono ka jawab BILKUL ek jaisa hona
   * chahiye. Farak hone par yeh endpoint bata deta hai ki kaun app par hai.
   */
  it('unknown number aur galat password ek hi jawab dete hain', async () => {
    const phone = trackedPhone();
    await signupAccount(app, { phone });

    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { phone, password: 'wrongpassword1' },
    });
    const unknownNumber = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { phone: uniquePhone(), password: TEST_PASSWORD },
    });

    expect(unknownNumber.statusCode).toBe(wrongPassword.statusCode);
    expect(unknownNumber.json()).toEqual(wrongPassword.json());
  });

  it('har login ek NAYI session banati hai', async () => {
    const phone = trackedPhone();
    const account = await signupAccount(app, { phone });

    await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { phone, password: TEST_PASSWORD },
    });

    const sessions = await prisma.session.count({
      where: { userId: account.userId, revokedAt: null },
    });
    expect(sessions).toBe(2);
  });
});

describe('POST /v1/auth/check-phone', () => {
  it('registered number ke liye true deta hai', async () => {
    const phone = trackedPhone();
    await signupAccount(app, { phone });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/check-phone',
      payload: { phone },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ exists: true });
  });

  it('unknown number ke liye false deta hai', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/check-phone',
      payload: { phone: uniquePhone() },
    });

    expect(res.json()).toEqual({ exists: false });
  });
});

describe('POST /v1/auth/forgot-password', () => {
  it('password reset karta hai aur naye tokens deta hai', async () => {
    const phone = trackedPhone();
    await signupAccount(app, { phone });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { phone, password: 'brandnew456' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().tokens.accessToken).toBeTruthy();

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { phone, password: 'brandnew456' },
    });
    expect(login.statusCode).toBe(200);
  });

  it('purana password reset ke baad kaam nahi karta', async () => {
    const phone = trackedPhone();
    await signupAccount(app, { phone });

    await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { phone, password: 'brandnew456' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { phone, password: TEST_PASSWORD },
    });
    expect(res.statusCode).toBe(401);
  });

  /**
   * Yeh reset ka asli point hai.
   *
   * Agar password isliye badla ja raha hai ki account compromise hai, to
   * attacker ka pehle se chalta hua session zinda chhodna poore reset ko
   * bekaar kar deta hai.
   */
  it('reset SAARE purane sessions revoke kar deta hai', async () => {
    const phone = trackedPhone();
    const account = await signupAccount(app, { phone });

    await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { phone, password: 'brandnew456' },
    });

    const refresh = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: account.refreshToken },
    });
    expect(refresh.statusCode).toBe(401);
  });

  it('unknown number par 404 deta hai', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { phone: uniquePhone(), password: 'brandnew456' },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('request body parsing', () => {
  it('galat JSON par typed error deta hai, Fastify ka raw error nahi', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{ not json',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_JSON');
  });

  it('content-type ke saath khaali body bhi crash nahi karti', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/notifications/read-all',
      headers: { 'content-type': 'application/json' },
      payload: '',
    });

    // Auth chahiye, lekin body parsing se pehle crash NAHI hona chahiye
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('UNAUTHORIZED');
  });
});
