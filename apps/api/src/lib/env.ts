import { z } from 'zod';

/**
 * Environment boot par validate hota hai, aur kuch bhi missing/malformed ho
 * to process CRASH karta hai.
 *
 * Yeh deliberate hai. Alternative yeh hai ki `process.env.JWT_SECRET` kahin
 * `undefined` nikle aur aadhi raat ko traffic ke beech fail ho. Startup par
 * fail hona hamesha behtar hai — deploy turant red ho jaata hai.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Secrets ke liye minimum length enforce — chhota secret brute-force
  // hone layak hota hai, aur "dev secret prod mein chala gaya" sabse common
  // security incident hai.
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

  // ── Firebase Phone Auth (server side) ──
  //
  // OTP hum khud nahi bhejte: SMS Firebase bhejta hai aur code bhi wahi
  // verify karta hai. Server ko client se ek signed ID token milta hai,
  // jise firebase-admin verify karke usmein se phone number nikaalta hai.
  //
  // Yeh teeno OPTIONAL hain taaki local development bina Firebase project ke
  // bhi chale (dekho lib/firebase.ts ka dev fallback). Production mein inke
  // bina boot hi nahi hota — neeche guard hai.
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  // Rate limits configurable hain taaki test suite inhe raise kar sake.
  // Warna saare tests ek hi IP se aate hain aur ek doosre ka budget kha lete
  // hain — suite order-dependent aur flaky ho jaati hai.
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().min(1).default(120),
  // Login brute-force ka surface hai: ek password guess karna free nahi hona
  // chahiye. Per-IP limit, aur service mein per-phone throttle iske upar.
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().min(1).default(10),
  // Signup har hit par ek user row aur ek SMS (Firebase ki taraf se) banata
  // hai — dono ke paise lagte hain.
  RATE_LIMIT_SIGNUP_MAX: z.coerce.number().int().min(1).default(5),
  // "Yeh number registered hai?" ek enumeration oracle hai. Sakht limit isse
  // poori phone-number space scan karne layak nahi rehne deti.
  RATE_LIMIT_PHONE_CHECK_MAX: z.coerce.number().int().min(1).default(20),
  RATE_LIMIT_WINDOW: z.string().default('15 minutes'),

  /** Comma-separated origins, ya "*" development ke liye */
  CORS_ORIGINS: z.string().default('*'),

  // 'silent' Fastify ka valid level hai — tests isse use karte hain taaki
  // suite output request logs mein na dab jaaye.
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}\n\nSee .env.example`);
  }

  const env = parsed.data;

  // Production mein dev placeholder secrets ke saath boot hone se roko.
  // Yeh wahi mistake hai jo chupchaap production tak pahunch jaati hai.
  if (env.NODE_ENV === 'production') {
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if (env[key].includes('dev-only') || env[key].includes('change-me')) {
        throw new Error(`${key} is still the development placeholder. Set a real secret.`);
      }
    }

    // Firebase ke bina production mein phone verification hoti hi nahi, aur
    // dev fallback har phone number ko bina proof ke accept kar leta hai.
    // Boot par fail hona hi sahi hai — warna signup chupchaap ek open door
    // ban jaata hai.
    if (!isFirebaseConfigured(env)) {
      throw new Error(
        'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are required in production.\nSee .env.example',
      );
    }
  }

  return env;
}

export function corsOrigins(env: Env): string[] | true {
  if (env.CORS_ORIGINS.trim() === '*') return true;
  return env.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/** Teeno service-account values set hain? */
export function isFirebaseConfigured(env: Env): boolean {
  return Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);
}
