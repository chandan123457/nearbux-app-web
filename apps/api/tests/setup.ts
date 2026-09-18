import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

/**
 * Vitest setup file — har test file se PEHLE chalti hai.
 *
 * Yeh isliye zaroori hai: ESM imports hoisted hote hain, isliye test file ka
 * `import { prisma } from '@nearbux/database'` kisi bhi helper ke dotenv call
 * se pehle evaluate ho jaata hai. Prisma singleton us waqt bina DATABASE_URL
 * ke ban jaata aur throw karta. setupFiles ye race jeet leti hai.
 */
loadDotenv({ path: path.resolve(import.meta.dirname, '../../../.env'), quiet: true });

/**
 * Tests LOCAL database par chalte hain, shared dev database par nahi.
 *
 * Tests users banate aur delete karte hain. Unhe shared Neon dev database par
 * chalane ka matlab: doosron ka data corrupt karna, aur har query par network
 * round trip (poori suite minutes le legi).
 */
const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  process.env.DATABASE_URL = testUrl;
  process.env.DIRECT_DATABASE_URL = testUrl;
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    'Tests ke liye TEST_DATABASE_URL (ya DATABASE_URL) chahiye.\n' +
      'Local Postgres chalu karo: pnpm db:up',
  );
}

// Guard: agar koi galti se production/shared DB par point kar de
if (process.env.DATABASE_URL.includes('neon.tech') && !process.env.ALLOW_REMOTE_TESTS) {
  throw new Error(
    'Tests ek remote database par point kar rahe hain. Yeh data destroy karte hain.\n' +
      'TEST_DATABASE_URL ko local Postgres par set karo, ya ALLOW_REMOTE_TESTS=true.',
  );
}
