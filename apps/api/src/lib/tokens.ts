import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Refresh tokens: high-entropy random strings, database mein SHA-256 hash
 * karke store hote hain.
 *
 * Yahan Argon2 use NAHI karte, jabki passwords ke liye karte hain. Wajah:
 * Argon2 ka poora point slow hona hai, taaki low-entropy secrets (jaise
 * "password123" ya 6-digit OTP) brute-force na ho sakein. Ek 256-bit random
 * token brute-forceable hai hi nahi — usko slow-hash karna har single API
 * request par 100ms add kar dega, bina koi security fayde ke.
 *
 * Hash phir bhi karte hain taaki database leak ho to tokens direct usable
 * na hon.
 */
const REFRESH_TOKEN_BYTES = 32;

export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time compare — timing attack se bachne ke liye */
export function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** 6-digit OTP. Math.random() nahi — woh cryptographically secure nahi hai. */
export function generateOtpCode(): string {
  // Modulo bias se bachne ke liye rejection sampling
  while (true) {
    const value = randomBytes(4).readUInt32BE(0);
    const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000;
    if (value < limit) {
      return String(value % 1_000_000).padStart(6, '0');
    }
  }
}
