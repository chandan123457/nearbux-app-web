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

/**
 * Guest accounts.
 *
 * Har device ko pehli launch par anonymous account milta hai, taaki cart aur
 * orders bina sign-in wall ke kaam karein. Baad mein verify karne par WAHI
 * account upgrade hona chahiye — naya banane par guest ka cart orphan ho
 * jaata hai, aur user ko lagta hai uska saman gayab ho gaya.
 */
describe('POST /v1/auth/guest', () => {
  it('content-type ke saath khaali body bhi accept karta hai', async () => {
    // Bahut se HTTP clients aur proxies har POST par content-type lagate
    // hain, body ho ya na ho. Fastify ka default parser us par error deta hai.
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/guest',
      headers: { 'content-type': 'application/json' },
      payload: '',
    });
    expect(res.statusCode).toBe(201);

    const id = (
      await app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: { authorization: `Bearer ${res.json().tokens.accessToken}` },
      })
    ).json().id;
    await prisma.session.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });
  });

  it('galat JSON par typed error deta hai, Fastify ka raw error nahi', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/request',
      headers: { 'content-type': 'application/json' },
      payload: '{ not json',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_JSON');
  });

  it('bina kisi input ke anonymous session deta hai', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/auth/guest' });

    expect(res.statusCode).toBe(201);
    const { tokens } = res.json();
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();

    const me = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ phone: null, isGuest: true, fullName: 'Guest' });

    await prisma.session.deleteMany({ where: { userId: me.json().id } });
    await prisma.user.delete({ where: { id: me.json().id } });
  });

  it('guest cart aur orders use kar sakta hai', async () => {
    const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest' });
    const token = guest.json().tokens.accessToken;
    const auth = { authorization: `Bearer ${token}` };

    // Yahi woh screens hain jo pehle sign-in wall dikhati thin
    expect((await app.inject({ method: 'GET', url: '/v1/carts', headers: auth })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/v1/orders', headers: auth })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/v1/addresses', headers: auth })).statusCode).toBe(200);

    const id = (await app.inject({ method: 'GET', url: '/v1/me', headers: auth })).json().id;
    await prisma.session.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });
  });

  it('verify karne par WAHI account upgrade hota hai, naya nahi banta', async () => {
    const phone = newPhone();

    const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest' });
    const guestToken = guest.json().tokens.accessToken;
    const guestId = (
      await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${guestToken}` } })
    ).json().id;

    // Guest ek address banata hai — yeh upgrade ke baad bhi rehna chahiye
    const address = await app.inject({
      method: 'POST',
      url: '/v1/addresses',
      headers: { authorization: `Bearer ${guestToken}` },
      payload: {
        label: 'HOME',
        line1: '123 MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        latitude: 12.9716,
        longitude: 77.5946,
        isDefault: true,
      },
    });
    expect(address.statusCode).toBe(201);

    await plantOtp(phone);
    const verified = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      headers: { authorization: `Bearer ${guestToken}` },
      payload: { phone, code: TEST_OTP, fullName: 'Rahul Sharma' },
    });
    expect(verified.statusCode).toBe(201);

    // Wahi user row — naya nahi
    const upgraded = await prisma.user.findFirstOrThrow({ where: { phone } });
    expect(upgraded.id).toBe(guestId);
    expect(upgraded.fullName).toBe('Rahul Sharma');
    expect(upgraded.phoneVerified).toBe(true);

    // Aur guest ka data bach gaya
    const addresses = await prisma.address.count({ where: { userId: guestId, deletedAt: null } });
    expect(addresses).toBe(1);
  });

  it('number pehle se kisi account ka ho to usi mein sign in karta hai', async () => {
    const phone = newPhone();

    // Pehle se maujood verified account
    await plantOtp(phone);
    const first = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      payload: { phone, code: TEST_OTP, fullName: 'Original Owner' },
    });
    expect(first.statusCode).toBe(201);
    const ownerId = (await prisma.user.findFirstOrThrow({ where: { phone } })).id;

    // Ab ek guest usi number se verify karta hai
    const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest' });
    const guestToken = guest.json().tokens.accessToken;
    const guestId = (
      await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${guestToken}` } })
    ).json().id;

    await plantOtp(phone);
    const second = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      headers: { authorization: `Bearer ${guestToken}` },
      payload: { phone, code: TEST_OTP },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().isNewUser).toBe(false);

    // Verified account hi source of truth hai — guest ka data usme MERGE
    // nahi hota, kyunki do carts jodna silently galat cheez pick kar sakta hai
    const me = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${second.json().tokens.accessToken}` },
    });
    expect(me.json().id).toBe(ownerId);
    expect(me.json().fullName).toBe('Original Owner');

    await prisma.session.deleteMany({ where: { userId: guestId } });
    await prisma.user.delete({ where: { id: guestId } });
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
