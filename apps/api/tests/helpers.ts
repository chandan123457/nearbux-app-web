import { randomInt } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@nearbux/database';
import { loadEnv } from '../src/lib/env.js';
import { buildServer } from '../src/server.js';

/**
 * Tests ek REAL Postgres ke against chalte hain, mocked Prisma ke nahi.
 *
 * Wajah: yahan jo bugs hote hain woh SQL-level hote hain — unique constraint
 * violations, transaction behaviour, cascade deletes, CHECK constraints.
 * Ek mock woh sab pass kar deta hai aur production mein fail hota hai.
 */
export function testEnv(overrides: Record<string, string> = {}) {
  return loadEnv({
    ...process.env,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    JWT_ACCESS_SECRET: 'test-access-secret-that-is-long-enough-x',
    JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-long-enough-y',
    OTP_TTL_MINUTES: '5',
    OTP_MAX_ATTEMPTS: '3',
    // Saare tests ek hi IP (127.0.0.1) se aate hain. Production limits par
    // suite khud ko rate-limit kar leti. Limiter ka apna test alag hai —
    // rate-limit.test.ts.
    RATE_LIMIT_GLOBAL_MAX: '10000',
    RATE_LIMIT_OTP_REQUEST_MAX: '10000',
    RATE_LIMIT_OTP_VERIFY_MAX: '10000',
    ...overrides,
  });
}

export async function createTestServer(
  envOverrides: Record<string, string> = {},
): Promise<FastifyInstance> {
  const app = await buildServer({ env: testEnv(envOverrides), db: prisma });
  await app.ready();
  return app;
}

/**
 * Har test ke liye ek unique number.
 *
 * Yeh RANDOM hai, counter nahi. Counter har test FILE mein 0 se shuru hota
 * hai, to alag files ke tests same numbers use karte the — aur per-phone OTP
 * throttle unhe ek doosre ka budget khaate dekhta tha. Failures test order
 * par depend karne lagti thin, jo debug karna bahut mushkil hai.
 */
export function uniquePhone(): string {
  const suffix = randomInt(100_000_000, 999_999_999);
  return `+919${suffix}`;
}

/**
 * Ek test user aur uska poora data hataata hai.
 *
 * Order matters: orders `onDelete: Restrict` use karte hain (woh cascade se
 * kabhi delete nahi hone chahiye), isliye unhe pehle explicitly hatana padta
 * hai warna user delete fail ho jaata hai.
 */
export async function cleanupPhone(phone: string): Promise<void> {
  const user = await prisma.user.findFirst({ where: { phone } });
  if (user) {
    const orderIds = (
      await prisma.order.findMany({ where: { userId: user.id }, select: { id: true } })
    ).map((o) => o.id);

    if (orderIds.length > 0) {
      await prisma.promotionRedemption.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.storeReview.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.productReview.deleteMany({ where: { userId: user.id } });
      await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.orderStatusEvent.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }

    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.cart.deleteMany({ where: { userId: user.id } });
    await prisma.favoriteStore.deleteMany({ where: { userId: user.id } });
    await prisma.favoriteProduct.deleteMany({ where: { userId: user.id } });
    await prisma.searchHistory.deleteMany({ where: { userId: user.id } });
    await prisma.address.deleteMany({ where: { userId: user.id } });
    await prisma.savedPaymentMethod.deleteMany({ where: { userId: user.id } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.deviceToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.otpChallenge.deleteMany({ where: { phone } });
}

/**
 * Bheja gaya OTP database se nikalta hai.
 *
 * Code hashed store hota hai isliye padha nahi ja sakta — isliye test
 * deterministic code inject karta hai. Dekho `withKnownOtp`.
 */
export const TEST_OTP = '123456';
