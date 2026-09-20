import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/index.js';

export * from '../generated/client/index.js';

/**
 * PrismaClient singleton — LAZY.
 *
 * Client pehli baar use hone par banta hai, module import hone par nahi.
 *
 * Yeh sirf optimisation nahi hai. Pehle client module load par ban jaata tha
 * aur `DATABASE_URL` wahin padh leta tha. ESM imports hoisted hote hain, to
 * kisi bhi app ka `dotenv.config()` iske BAAD chalta tha — aur production
 * build "DATABASE_URL is not set" se crash hoti thi jabki .env bilkul theek
 * tha. Env ko pehli query tak defer karne se yeh poora import-order wala
 * problem class hi khatam ho jaata hai.
 *
 * IMPORTANT: yeh package sirf apps/api import karta hai. Client bundle mein
 * Prisma kabhi nahi jaana chahiye, warna DB schema aur query logic user ke
 * device par ship ho jaayega.
 */
function createClient(): PrismaClient {
  // POOLED endpoint. Migrations DIRECT use karti hain — dekho prisma.config.ts
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — see .env.example');
  }

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

  return new PrismaClient({ adapter, log: ['warn', 'error'] });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Proxy isliye ki `prisma.user.findMany()` bilkul waise hi kaam kare jaise
 * pehle karta tha, lekin asli client pehli property access par bane.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient() as object, prop, receiver);
  },
  has(_target, prop) {
    return prop in (getClient() as object);
  },
});

export type Db = PrismaClient;

/** Transaction ke andar milne wala client — services isi type par depend karein */
export type DbTransaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
   