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

/** Har test ke liye unique number, taaki tests ek doosre se na takrayein */
let phoneCounter = 0;
export function uniquePhone(): string {
  phoneCounter += 1;
  const suffix = String(700_000_0000 + phoneCounter).slice(-10);
  return `+91${suffix.startsWith('9') ? suffix : `9${suffix.slice(1)}`}`;
}

export async function cleanupPhone(phone: string): Promise<void> {
  const user = await prisma.user.findFirst({ where: { phone } });
  if (user) {
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
