import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/index.js';

export * from '../generated/client/index.js';

/**
 * PrismaClient SINGLETON.
 *
 * Prisma 7 se connection URL schema.prisma mein nahi rehta — client ko
 * runtime par ek DRIVER ADAPTER diya jaata hai. Iska matlab pool humare
 * control mein hai, jo serverless/multi-instance deploys par zaroori hai:
 * har instance apna pool kholta hai, aur bina limit ke Postgres ke
 * max_connections khatam ho jaate hain.
 *
 * Har request par naya client banana bhi isi wajah se galat hai. Dev mein
 * globalThis par cache karte hain taaki hot-reload naye clients leak na kare.
 *
 * IMPORTANT: yeh package sirf apps/api import karta hai. Client bundle mein
 * Prisma kabhi nahi jaana chahiye, warna DB schema aur query logic user ke
 * device par ship ho jaayega.
 */
// POOLED endpoint. Migrations DIRECT use karti hain — dekho prisma.config.ts
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set — see .env.example');
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString,
    // Ek instance itne se zyada Postgres connections nahi kholega.
    // Neon pooler ke peeche yeh chhota rakho (5) — API instances horizontally
    // scale karte hain aur har ek apna pool kholta hai.
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    // Serverless Postgres (Neon) idle hone par compute suspend kar deta hai,
    // aur pehli query usse jagati hai. Default connection timeout us cold
    // start ke liye kam padta hai.
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis: 30_000,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['warn', 'error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type Db = typeof prisma;

/** Transaction ke andar milne wala client — services isi type par depend karein */
export type DbTransaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
