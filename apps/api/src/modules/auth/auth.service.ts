import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import type { Env } from '../../lib/env.js';
import { Errors } from '../../lib/errors.js';
import { generateOtpCode, generateRefreshToken, hashRefreshToken } from '../../lib/tokens.js';
import type { AuthRepository } from './auth.repository.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Client ise refresh schedule karne ke liye use karta hai */
  expiresInSeconds: number;
}

export interface SignAccessToken {
  (payload: { sub: string; phone: string | null }): string;
}

interface Deps {
  repo: AuthRepository;
  env: Env;
  signAccessToken: SignAccessToken;
  /** Test mein deterministic code inject karne ke liye */
  makeCode?: () => string;
  /** SMS gateway — Phase 2 mein log karta hai, integration baad mein */
  sendSms?: (phone: string, message: string) => Promise<void>;
}

/** Ek phone number kitne OTP ek window mein maang sakta hai */
const OTP_REQUEST_WINDOW_MINUTES = 15;
const OTP_MAX_REQUESTS_PER_WINDOW = 5;

export function createAuthService({ repo, env, signAccessToken, makeCode, sendSms }: Deps) {
  const newCode = makeCode ?? generateOtpCode;

  async function issueTokens(
    user: { id: string; phone: string | null },
    context: { deviceLabel?: string | null; ipAddress?: string | null },
  ): Promise<AuthTokens> {
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

    await repo.createSession({
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt,
      deviceLabel: context.deviceLabel ?? null,
      ipAddress: context.ipAddress ?? null,
    });

    return {
      accessToken: signAccessToken({ sub: user.id, phone: user.phone }),
      refreshToken,
      expiresInSeconds: parseTtlSeconds(env.ACCESS_TOKEN_TTL),
    };
  }

  return {
    /**
     * Anonymous session — device ko pehli launch par milti hai.
     *
     * Iske bina cart, orders aur profile screens sign-in wall dikhati hain,
     * aur user ko browse karne se pehle hi account banana padta hai.
     */
    async createGuestSession(context: {
      deviceLabel?: string | null;
      ipAddress?: string | null;
    }): Promise<AuthTokens> {
      const guest = await repo.createGuest();
      return issueTokens({ id: guest.id, phone: null }, context);
    },

    /**
     * OTP request.
     *
     * Response NEVER batata hai ki phone registered hai ya nahi. Warna yeh
     * endpoint ek user-enumeration oracle ban jaata hai — koi bhi numbers
     * try karke pata kar sakta hai kaun app par hai.
     */
    async requestOtp(input: { phone: string }): Promise<{ expiresInSeconds: number }> {
      const since = new Date(Date.now() - OTP_REQUEST_WINDOW_MINUTES * 60_000);
      const recent = await repo.countRecentChallenges(input.phone, since);

      // Per-phone limit, IP rate limit ke UPAR. IP limit attacker ko ek hi
      // number par baar-baar SMS bhejne se nahi rokti (SMS ke paise lagte hain).
      if (recent >= OTP_MAX_REQUESTS_PER_WINDOW) {
        throw Errors.tooManyRequests(
          'Too many verification codes requested. Please try again in a few minutes.',
        );
      }

      // Purane codes marr jaate hain — ek waqt par ek hi valid code
      await repo.consumeAllChallenges(input.phone);

      const code = newCode();
      const codeHash = await argonHash(code);
      const expiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000);

      await repo.createChallenge({ phone: input.phone, codeHash, expiresAt });

      const message = `${code} is your NearBux verification code. Valid for ${env.OTP_TTL_MINUTES} minutes.`;
      if (sendSms) {
        await sendSms(input.phone, message);
      } else if (env.NODE_ENV !== 'production') {
        // Dev/test mein SMS provider nahi hai — code log karte hain.
        // Production mein yeh raasta possible hi nahi (env check niche).
        console.log(`[otp] ${input.phone} → ${code}`);
      } else {
        throw Errors.internal('SMS provider is not configured');
      }

      return { expiresInSeconds: env.OTP_TTL_MINUTES * 60 };
    },

    /**
     * OTP verify → login ya signup.
     *
     * Pehli baar login karne wala user apne aap ban jaata hai. Alag signup
     * endpoint nahi hai — phone number hi identity hai.
     */
    async verifyOtp(input: {
      phone: string;
      code: string;
      fullName?: string;
      deviceToken?: string;
      platform?: string;
      ipAddress?: string | null;
      deviceLabel?: string | null;
      /** Guest session jo verify kar rahi hai — usi account ko upgrade karo */
      guestUserId?: string | null;
    }): Promise<{ tokens: AuthTokens; isNewUser: boolean }> {
      const challenge = await repo.findActiveChallenge(input.phone);

      // Sab failures ek hi generic error dete hain. "Code expired" aur
      // "wrong code" alag-alag batana attacker ko yeh reveal kar deta hai ki
      // us number ke liye valid challenge exist karta hai.
      const invalid = () => Errors.badRequest('Invalid or expired verification code');

      if (!challenge) throw invalid();

      if (challenge.attempts >= env.OTP_MAX_ATTEMPTS) {
        await repo.consumeChallenge(challenge.id);
        throw invalid();
      }

      const matches = await argonVerify(challenge.codeHash, input.code).catch(() => false);
      if (!matches) {
        await repo.incrementChallengeAttempts(challenge.id);
        throw invalid();
      }

      await repo.consumeChallenge(challenge.id);

      const existing = await repo.findUserByPhone(input.phone);
      const guest = input.guestUserId ? await repo.findUserById(input.guestUserId) : null;
      const isGuest = guest !== null && guest.phone === null;

      let user;
      let isNewUser: boolean;

      if (existing) {
        // Number pehle se kisi account ka hai. Us account mein sign in karao.
        //
        // Guest ka data us account mein MERGE nahi karte: do carts, do sets
        // of orders aur do address books ko jodna silently galat cheez
        // pick kar sakta hai, aur galti chhipi rehti hai. Verified account
        // hi source of truth hai.
        user = existing.phoneVerified ? existing : await repo.markPhoneVerified(existing.id);
        isNewUser = false;
      } else if (isGuest) {
        // Guest ko usi row par upgrade karo — cart aur orders bach jaate hain
        user = await repo.upgradeGuest(guest.id, {
          phone: input.phone,
          ...(input.fullName?.trim() ? { fullName: input.fullName.trim() } : {}),
        });
        isNewUser = true;
      } else {
        user = await repo.createUser({
          phone: input.phone,
          fullName: input.fullName?.trim() || 'NearBux User',
        });
        isNewUser = true;
      }

      if (input.deviceToken && input.platform) {
        await repo.upsertDeviceToken({
          userId: user.id,
          token: input.deviceToken,
          platform: input.platform,
        });
      }

      const tokens = await issueTokens(user, {
        deviceLabel: input.deviceLabel ?? null,
        ipAddress: input.ipAddress ?? null,
      });

      return { tokens, isNewUser };
    },

    /**
     * Refresh with ROTATION + reuse detection.
     *
     * Har refresh purana token maar kar naya deta hai. Agar koi already-rotated
     * token dobara use kare, matlab woh token chori hua tha (legit client ke
     * paas sirf latest hota hai) — us waqt us user ke SAARE sessions revoke
     * kar dete hain. Attacker aur victim dono logout, victim dobara login
     * karke recover kar leta hai.
     */
    async refresh(input: {
      refreshToken: string;
      ipAddress?: string | null;
      deviceLabel?: string | null;
    }): Promise<AuthTokens> {
      const tokenHash = hashRefreshToken(input.refreshToken);
      const session = await repo.findSessionByHash(tokenHash);

      if (!session) throw Errors.unauthorized('Invalid refresh token');

      if (session.revokedAt !== null) {
        // REUSE DETECTED — yeh token pehle hi rotate ho chuka hai
        await repo.revokeAllUserSessions(session.userId);
        throw Errors.unauthorized('Session revoked. Please sign in again.');
      }

      if (session.expiresAt.getTime() <= Date.now()) {
        throw Errors.unauthorized('Session expired. Please sign in again.');
      }

      // Session valid hone ka matlab yeh nahi ki account abhi bhi active hai —
      // user delete ho sakta hai jab uska refresh token abhi bhi zinda ho.
      const user = await repo.findUserById(session.userId);
      if (!user) throw Errors.unauthorized('Account is no longer active');

      const refreshToken = generateRefreshToken();
      const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

      await repo.rotateSession(session.id, {
        userId: session.userId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt,
        deviceLabel: input.deviceLabel ?? session.deviceLabel,
      });

      return {
        accessToken: signAccessToken({ sub: user.id, phone: user.phone }),
        refreshToken,
        expiresInSeconds: parseTtlSeconds(env.ACCESS_TOKEN_TTL),
      };
    },

    async logout(refreshToken: string): Promise<void> {
      const session = await repo.findSessionByHash(hashRefreshToken(refreshToken));
      // Already revoked ya unknown token par bhi success — logout idempotent
      // hona chahiye, aur error dene se koi fayda nahi.
      if (session && session.revokedAt === null) {
        await repo.revokeSession(session.id);
      }
    },

    async logoutAll(userId: string): Promise<void> {
      await repo.revokeAllUserSessions(userId);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

/** "15m" → 900 */
function parseTtlSeconds(ttl: string): number {
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) return 900;
  const value = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86_400;
  return value * multiplier;
}
