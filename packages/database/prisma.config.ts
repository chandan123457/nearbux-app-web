import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 se .env automatically load NAHI hota. Monorepo root ka .env
// explicitly load karna padta hai taaki sab packages ek hi URL use karein.
loadEnv({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    // DIRECT endpoint — POOLED nahi.
    //
    // Prisma Migrate Postgres advisory locks leta hai taaki do migrations
    // ek saath na chalein. PgBouncer transaction mode (Neon ka pooler) mein
    // har statement alag backend connection par ja sakta hai, isliye lock
    // kabhi release hi nahi hota aur migration hang ho jaati hai.
    //
    // App runtime iske ulta karta hai — woh pooled URL use karta hai.
    // Dekho packages/database/src/index.ts
    url: env('DIRECT_DATABASE_URL'),
  },
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx --conditions=development prisma/seed.ts',
  },
});
