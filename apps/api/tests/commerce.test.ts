import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@nearbux/database';
import { hash as argonHash } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';
import { createTestServer, cleanupPhone, TEST_OTP, uniquePhone } from './helpers.js';

let app: FastifyInstance;
let token: string;
let userId: string;
let addressId: string;
let storeId: string;
let storeSlug: string;
let productIds: string[] = [];
const phones: string[] = [];

const BENGALURU = { latitude: 12.9716, longitude: 77.5946 };

function auth() {
  return { authorization: `Bearer ${token}` };
}

async function get(url: string) {
  return app.inject({ method: 'GET', url, headers: auth() });
}
async function post(url: string, payload?: unknown) {
  return app.inject({ method: 'POST', url, headers: auth(), payload: payload ?? {} });
}

beforeAll(async () => {
  app = await createTestServer();

  // Seeded catalog use karte hain — woh screens se derive hua hai, isliye
  // tests wahi shapes exercise karte hain jo asli app dikhata hai
  const store = await prisma.store.findFirstOrThrow({
    where: { slug: 'fresh-valley-supermarket' },
  });
  storeId = store.id;
  storeSlug = store.slug;

  const products = await prisma.product.findMany({
    where: { storeId, deletedAt: null },
    orderBy: { popularityScore: 'desc' },
    take: 3,
  });
  productIds = products.map((p) => p.id);

  // Sign in
  const phone = uniquePhone();
  phones.push(phone);
  await prisma.otpChallenge.create({
    data: { phone, codeHash: await argonHash(TEST_OTP), expiresAt: new Date(Date.now() + 300_000) },
  });
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/otp/verify',
    payload: { phone, code: TEST_OTP, fullName: 'Test Buyer' },
  });
  token = res.json().tokens.accessToken;
  userId = (await prisma.user.findFirstOrThrow({ where: { phone } })).id;

  const address = await post('/v1/addresses', {
    label: 'HOME',
    line1: '123 MG Road',
    line2: 'Apt 4B',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
    ...BENGALURU,
    isDefault: true,
  });
  addressId = address.json().id;
});

afterAll(async () => {
  // Stock wapas theek karo taaki dobara chalane par tests fail na hon
  for (const id of productIds) {
    await prisma.product.update({ where: { id }, data: { stockQty: 60 } });
  }
  for (const phone of phones) await cleanupPhone(phone);
  await app.close();
});

describe('discovery', () => {
  it('home feed distance-sorted stores deta hai', async () => {
    const res = await get(`/v1/home?latitude=${BENGALURU.latitude}&longitude=${BENGALURU.longitude}`);
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.nearbyStores.length).toBeGreaterThan(0);
    // Distance ke hisaab se sorted hona chahiye
    const distances = body.nearbyStores.map((s: { distanceKm: number }) => s.distanceKm);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
    expect(body.banners.length).toBeGreaterThan(0);
    expect(body.deliverTo?.formatted).toContain('123 MG Road');
  });

  it('store card par open/closed state compute karta hai', async () => {
    const res = await get(`/v1/home?latitude=${BENGALURU.latitude}&longitude=${BENGALURU.longitude}`);
    const stores = res.json().nearbyStores as Array<{ isOpen: boolean; opensAtLabel: string | null }>;
    // Har store ka ek definite state hona chahiye
    for (const s of stores) {
      expect(typeof s.isOpen).toBe('boolean');
      if (!s.isOpen && s.opensAtLabel) expect(s.opensAtLabel).toMatch(/^Opens /);
    }
  });

  it('fuzzy search products dhoondhta hai', async () => {
    const res = await get(
      `/v1/search?q=organic&latitude=${BENGALURU.latitude}&longitude=${BENGALURU.longitude}`,
    );
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.products.length).toBeGreaterThan(0);
    expect(body.products[0].name.toLowerCase()).toContain('organic');
  });

  it('search ko recent searches mein record karta hai', async () => {
    await get(`/v1/search?q=avocado&latitude=${BENGALURU.latitude}&longitude=${BENGALURU.longitude}`);
    const res = await get('/v1/search/recent');
    expect(res.json().recentSearches).toContain('avocado');
  });

  it('store detail sections ke saath deta hai', async () => {
    const res = await get(`/v1/stores/${storeSlug}`);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe('Fresh Valley Supermarket');
    expect(body.sections.map((s: { name: string }) => s.name)).toContain('Fruits & Veg');
  });

  it('product detail MRP se discount percent nikalta hai', async () => {
    const avocado = await prisma.product.findFirstOrThrow({
      where: { storeId, name: 'Organic Hass Avocados' },
    });
    const res = await get(`/v1/products/${avocado.id}`);
    const body = res.json();
    // Screen [6]: Rs 499 vs MRP Rs 649 = 23% OFF
    expect(body.discountPercent).toBe(23);
    expect(body.recommendPercent).toBe(98);
    expect(body.ratingCount).toBe(184);
  });
});

describe('cart', () => {
  it('item add karta hai aur bill compute karta hai', async () => {
    const res = await post('/v1/cart/items', { productId: productIds[0], quantity: 2 });
    expect(res.statusCode).toBe(201);
    const cart = res.json();

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(2);
    // Line total quantity count karta hai — mock screen [7] yeh galat karta tha
    expect(cart.items[0].lineTotalMinor).toBe(cart.items[0].unitPriceMinor * 2);
    expect(cart.bill.totalMinor).toBeGreaterThan(0);
  });

  it('dobara add karne par quantity badhti hai, duplicate row nahi', async () => {
    await post('/v1/cart/items', { productId: productIds[1], quantity: 1 });
    const res = await post('/v1/cart/items', { productId: productIds[1], quantity: 2 });
    const cart = res.json();
    const line = cart.items.find((i: { productId: string }) => i.productId === productIds[1]);
    expect(line.quantity).toBe(3);
  });

  it('quantity 0 par line hatata hai', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/carts/${storeId}/items/${productIds[1]}`,
      headers: auth(),
      payload: { quantity: 0 },
    });
    const cart = res.json();
    expect(cart.items.find((i: { productId: string }) => i.productId === productIds[1])).toBeUndefined();
  });

  it('bill hamesha reconcile karta hai', async () => {
    const res = await get(`/v1/carts/${storeId}`);
    const { bill } = res.json();
    expect(
      bill.itemTotalMinor + bill.deliveryFeeMinor + bill.taxMinor + bill.platformFeeMinor -
        bill.discountMinor,
    ).toBe(bill.totalMinor);
  });

  it('promo code apply karta hai', async () => {
    const res = await post(`/v1/carts/${storeId}/promotion`, { code: 'NEARBUX20' });
    expect(res.statusCode).toBe(200);
    const cart = res.json();
    expect(cart.promotion?.code).toBe('NEARBUX20');
    expect(cart.bill.discountMinor).toBe(20000);
  });

  it('galat promo code reject karta hai', async () => {
    const res = await post(`/v1/carts/${storeId}/promotion`, { code: 'NOTAREALCODE' });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('PROMO_INVALID');
  });

  it('minimum poora na ho to promo reject karta hai', async () => {
    /*
     * Yeh test apna promo BANATA hai, seed wala use nahi karta.
     *
     * Pehle yeh FRESH20 par depend karta tha, jo ek day-limited offer hai
     * ("Valid till Today, 11 PM"). Seed ghanton purana ho to woh expire ho
     * chuka hota hai aur test PROMO_BELOW_MINIMUM ki jagah PROMO_EXPIRED
     * deta hai — failure seed kab chala tha uspar depend karta tha, code par
     * nahi. Test ko apna fixture own karna chahiye.
     */
    const code = `TESTMIN${Date.now().toString().slice(-6)}`;
    await prisma.promotion.create({
      data: {
        code,
        title: 'Test minimum',
        scope: 'STORE',
        storeId,
        type: 'FLAT_OFF',
        value: 10000,
        minOrderMinor: 10_000_00, // Rs 10,000 — cart isse kabhi upar nahi jaayega
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 3_600_000),
      },
    });

    try {
      const res = await post(`/v1/carts/${storeId}/promotion`, { code });
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('PROMO_BELOW_MINIMUM');
    } finally {
      await prisma.promotion.deleteMany({ where: { code } });
    }
  });
});

describe('place order', () => {
  it('galat expected total reject karta hai', async () => {
    const res = await post('/v1/orders', {
      storeId,
      addressId,
      paymentMethodType: 'UPI',
      expectedTotalMinor: 1, // client ka jhooth
      idempotencyKey: randomUUID(),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('PRICE_CHANGED');
  });

  it('order place karta hai aur cart clear karta hai', async () => {
    const cartRes = await get(`/v1/carts/${storeId}`);
    const cart = cartRes.json();
    const stockBefore = await prisma.product.findFirstOrThrow({ where: { id: productIds[0] } });

    const res = await post('/v1/orders', {
      storeId,
      addressId,
      paymentMethodType: 'UPI',
      expectedTotalMinor: cart.bill.totalMinor,
      idempotencyKey: randomUUID(),
    });

    expect(res.statusCode).toBe(201);
    const order = res.json();
    expect(order.orderNumber).toMatch(/^NB-\d+$/);
    expect(order.status).toBe('PLACED');
    expect(order.bill.totalMinor).toBe(cart.bill.totalMinor);
    // Receipt snapshot hai, live reference nahi
    expect(order.items[0].name).toBeTruthy();
    expect(order.deliveryAddress).toContain('123 MG Road');

    // Stock ghata
    const stockAfter = await prisma.product.findFirstOrThrow({ where: { id: productIds[0] } });
    expect(stockAfter.stockQty).toBe(stockBefore.stockQty - cart.items[0].quantity);

    // Cart khatam
    const afterCart = await get(`/v1/carts/${storeId}`);
    expect(afterCart.json()).toBeNull();
  });

  /**
   * Idempotency — mobile par sabse zyada matter karta hai.
   *
   * Network drop par client retry karta hai. Bina is guarantee ke user ka
   * card do baar charge hota hai aur do orders bante hain.
   */
  it('idempotency key duplicate order nahi banne deti', async () => {
    await post('/v1/cart/items', { productId: productIds[2], quantity: 1 });
    const cart = (await get(`/v1/carts/${storeId}`)).json();
    const key = randomUUID();

    const payload = {
      storeId,
      addressId,
      paymentMethodType: 'UPI' as const,
      expectedTotalMinor: cart.bill.totalMinor,
      idempotencyKey: key,
    };

    const first = await post('/v1/orders', payload);
    const retry = await post('/v1/orders', payload);

    expect(first.statusCode).toBe(201);
    expect(retry.json().id).toBe(first.json().id); // wahi order, naya nahi
    expect(await prisma.order.count({ where: { idempotencyKey: key } })).toBe(1);
  });

  it('khaali cart par order reject karta hai', async () => {
    const res = await post('/v1/orders', {
      storeId,
      addressId,
      paymentMethodType: 'UPI',
      expectedTotalMinor: 1000,
      idempotencyKey: randomUUID(),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('orders', () => {
  it('filter tabs ke saath list karta hai', async () => {
    const all = await get('/v1/orders?filter=ALL');
    expect(all.statusCode).toBe(200);
    expect(all.json().items.length).toBeGreaterThan(0);

    const inProgress = await get('/v1/orders?filter=IN_PROGRESS');
    for (const o of inProgress.json().items) {
      expect(['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY']).toContain(o.status);
    }

    const delivered = await get('/v1/orders?filter=DELIVERED');
    for (const o of delivered.json().items) expect(o.status).toBe('DELIVERED');
  });

  it('order number se lookup karta hai (deep links ke liye)', async () => {
    const list = await get('/v1/orders?filter=ALL');
    const first = list.json().items[0];
    const res = await get(`/v1/orders/${first.orderNumber}`);
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(first.id);
  });

  it('tracking timeline deta hai', async () => {
    const list = await get('/v1/orders?filter=IN_PROGRESS');
    const order = await get(`/v1/orders/${list.json().items[0].id}`);
    const body = order.json();
    expect(body.timeline.length).toBeGreaterThan(0);
    expect(body.timeline[0].status).toBe('PLACED');
    expect(body.canCancel).toBe(true);
  });

  it('order cancel karta hai', async () => {
    const list = await get('/v1/orders?filter=IN_PROGRESS');
    const target = list.json().items[0];
    const res = await post(`/v1/orders/${target.id}/cancel`, { reason: 'Changed my mind' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('CANCELLED');
    // Timeline mein cancellation record honi chahiye
    expect(res.json().timeline.at(-1).status).toBe('CANCELLED');
  });

  it('cancelled order dobara cancel nahi hota', async () => {
    const cancelled = await get('/v1/orders?filter=CANCELLED');
    const target = cancelled.json().items[0];
    const res = await post(`/v1/orders/${target.id}/cancel`, { reason: 'Again' });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('CANCEL_WINDOW_CLOSED');
  });

  it('doosre user ka order access nahi karne deta', async () => {
    const other = await prisma.order.findFirst({ where: { userId: { not: userId } } });
    if (!other) return;
    const res = await get(`/v1/orders/${other.id}`);
    expect(res.statusCode).toBe(404);
  });
});

/**
 * Guest browsing.
 *
 * Discovery bina token ke khuli hai. Yeh sirf dev convenience nahi hai —
 * browsing ke liye account maangna funnel ka sabse mehnga step hai. Login
 * tab maanga jaata hai jab identity sach mein chahiye: cart, orders, checkout.
 */
describe('guest access', () => {
  async function guestGet(url: string) {
    return app.inject({ method: 'GET', url });
  }

  it('home feed bina token ke deta hai', async () => {
    const res = await guestGet(
      `/v1/home?latitude=${BENGALURU.latitude}&longitude=${BENGALURU.longitude}`,
    );
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.nearbyStores.length).toBeGreaterThan(0);
    // Guest ke paas personalisation nahi hoti
    expect(body.deliverTo).toBeNull();
    expect(body.unreadNotificationCount).toBe(0);
    expect(body.nearbyStores.every((s: { isFavorite: boolean }) => !s.isFavorite)).toBe(true);
  });

  it('search bina token ke chalti hai, par history save nahi karti', async () => {
    const res = await guestGet(
      `/v1/search?q=organic&latitude=${BENGALURU.latitude}&longitude=${BENGALURU.longitude}`,
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().products.length).toBeGreaterThan(0);
    // Guest ki koi identity nahi jisse history attach ho
    expect(res.json().recentSearches).toEqual([]);
  });

  it('store aur product detail bina token ke khulte hain', async () => {
    expect((await guestGet(`/v1/stores/${storeSlug}`)).statusCode).toBe(200);
    expect((await guestGet(`/v1/products/${productIds[0]}`)).statusCode).toBe(200);
    expect((await guestGet(`/v1/stores/${storeId}/products`)).statusCode).toBe(200);
  });

  it('cart, orders aur profile ab bhi auth maangte hain', async () => {
    for (const url of ['/v1/carts', '/v1/orders', '/v1/me', '/v1/addresses']) {
      expect((await guestGet(url)).statusCode, url).toBe(401);
    }
  });

  it('kharab token guest ki tarah treat hota hai, error ki tarah nahi', async () => {
    // Expired token par browsing block karna sabse bura outcome hai — user ko
    // lagta hai app toot gaya
    const res = await app.inject({
      method: 'GET',
      url: `/v1/home?latitude=${BENGALURU.latitude}&longitude=${BENGALURU.longitude}`,
      headers: { authorization: 'Bearer definitely-not-a-valid-jwt' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().deliverTo).toBeNull();
  });
});

describe('favorites', () => {
  it('store favourite toggle karta hai', async () => {
    const add = await app.inject({
      method: 'PUT',
      url: `/v1/favorites/stores/${storeId}`,
      headers: auth(),
    });
    expect(add.statusCode).toBe(204);

    const feed = await get(`/v1/home?latitude=${BENGALURU.latitude}&longitude=${BENGALURU.longitude}`);
    const store = feed.json().nearbyStores.find((s: { id: string }) => s.id === storeId);
    expect(store.isFavorite).toBe(true);

    // PUT idempotent hona chahiye — double tap error na de
    const again = await app.inject({
      method: 'PUT',
      url: `/v1/favorites/stores/${storeId}`,
      headers: auth(),
    });
    expect(again.statusCode).toBe(204);
  });
});

describe('notifications', () => {
  it('TODAY / EARLIER mein group karta hai', async () => {
    const res = await get('/v1/notifications');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.today)).toBe(true);
    expect(Array.isArray(body.earlier)).toBe(true);
    // Order placement ne notification banayi hogi
    expect(body.today.length).toBeGreaterThan(0);
    expect(body.today[0].relativeLabel).toBeTruthy();
  });

  it('sab read mark karta hai', async () => {
    await post('/v1/notifications/read-all');
    const res = await get('/v1/notifications');
    expect(res.json().unreadCount).toBe(0);
  });
});
