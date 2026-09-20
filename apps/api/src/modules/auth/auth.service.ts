import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import type { Env } from '../../lib/env.js';
import { Errors } from '../../lib/errors.js';
import type { PhoneVerifier } from '../../lib/firebase.js';
import { generateRefreshToken, hashRefreshToken } from '../../lib/tokens.js';
import type { AuthRepository } from './auth.repository.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Client ise refresh schedule karne ke liye use karta hai */
  expiresInSeconds: number;
}

export interface SignAccessToken {
  (payload: { sub: string; phone: string }): string;
}

interface Deps {
  repo: AuthRepository;
  env: Env;
  signAccessToken: SignAccessToken;
  /** Firebase Phone Auth ka ID token verifier — dekho lib/firebase.ts */
  phoneVerifier: PhoneVerifier;
}

interface DeviceContext {
  ipAddress?: string | null;
  deviceLabel?: string | null;
  deviceToken?: string;
  platform?: string;
}

export function createAuthService({ repo, env, signAccessToken, phoneVerifier }: Deps) {
  /**
   * Login ke timing ko constant rakhne ke liye ek dummy hash.
   *
   * Bina iske: registered number par server Argon2 chalata hai (~100ms), aur
   * unregistered number par turant return karta hai (~2ms). Woh farak hi ek
   * enumeration oracle hai — response body chahe kitna bhi generic ho, ghadi
   * sach bata deti hai. Isliye user na milne par bhi ek verify chalate hain.
   */
  let dummyHash: string | null = null;
  async function getDummyHash(): Promise<string> {
    dummyHash ??= await argonHash('nearbux-timing-equalizer');
    return dummyHash;
  }

  async function issueTokens(
    user: { id: string; phone: string },
    context: DeviceContext,
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

    if (context.deviceToken && context.platform) {
      await repo.upsertDeviceToken({
        userId: user.id,
        token: context.deviceToken,
        platform: context.platform,
      });
    }

    return {
      accessToken: signAccessToken({ sub: user.id, phone: user.phone }),
      refreshToken,
      expiresInSeconds: parseTtlSeconds(env.ACCESS_TOKEN_TTL),
    };
  }

  return {
    /**
     * Screen [2] — Create your account.
     *
     * Order matters: phone PEHLE verify hota hai, user BAAD mein banta hai.
     * Ulta karne par koi bhi bina OTP ke rows bana sakta hai aur phone number
     * "reserve" karke asli maalik ko signup se rok sakta hai.
     */
    async signup(
      input: {
        fullName: string;
        phone: string;
        password: string;
        firebaseIdToken?: string;
      } & DeviceContext,
    ): Promise<{ tokens: AuthTokens; isNewUser: boolean }> {
      const verified = await phoneVerifier.verify(input.firebaseIdToken, input.phone);

      const existing = await repo.findUserByPhone(verified.phone);
      if (existing) {
        // Yeh enumeration leak nahi hai: caller abhi-abhi isi number par OTP
        // verify kar chuka hai, matlab number uska hi hai.
        throw Errors.conflict(
          'PHONE_ALREADY_REGISTERED',
          'This number is already registered. Please log in instead.',
        );
      }

      const user = await repo.createUser({
        phone: verified.phone,
        fullName: input.fullName.trim(),
        passwordHash: await argonHash(input.password),
        firebaseUid: verified.uid,
      });

      const tokens = await issueTokens({ id: user.id, phone: user.phone }, input);
      return { tokens, isNewUser: true };
    },

    /**
     * Screen [1] — Welcome back. Password se, OTP ke bina.
     *
     * Har failure ek hi generic error deti hai. "No account with this number"
     * aur "wrong password" alag-alag batana kisi ko bhi yeh batane ka zariya
     * ban jaata hai ki kaun-kaun app par hai.
     */
    async login(
      input: { phone: string; password: string } & DeviceContext,
    ): Promise<{ tokens: AuthTokens }> {
      const invalid = () => Errors.unauthorized('Incorrect phone number or password');

      const user = await repo.findUserByPhone(input.phone);

      if (!user?.passwordHash) {
        await argonVerify(await getDummyHash(), input.password).catch(() => false);
        throw invalid();
      }

      const matches = await argonVerify(user.passwordHash, input.password).catch(() => false);
      if (!matches) throw invalid();

      return { tokens: await issueTokens({ id: user.id, phone: user.phone }, input) };
    },

    /**
     * Screen [1] → "Forgot Password?"
     *
     * Phone ka control hi yahan proof hai — purana password maangne ka koi
     * matlab nahi, jo bhoola hai uske paas woh hai hi nahi.
     *
     * Reset ke baad SAARE purane sessions revoke hote hain. Agar password
     * isliye badla ja raha hai ki account compromise hai, to attacker ka
     * pehle se chalta hua session zinda chhodna poore reset ko bekaar kar
     * deta hai.
     */
    async resetPassword(
      input: { phone: string; password: string; firebaseIdToken?: string } & DeviceContext,
    ): Promise<{ tokens: AuthTokens }> {
      const verified = await phoneVerifier.verify(input.firebaseIdToken, input.phone);

      const user = await repo.findUserByPhone(verified.phone);
      if (!user) {
        throw Errors.notFound('Account');
      }

      await repo.updatePassword(user.id, await argonHash(input.password));
      await repo.revokeAllUserSessions(user.id);
      if (verified.uid) await repo.linkFirebaseUid(user.id, verified.uid);

      return { tokens: await issueTokens({ id: user.id, phone: user.phone }, input) };
    },

    /** Signup form par "already registered" turant dikhane ke liye */
    async checkPhone(phone: string): Promise<{ exists: boolean }> {
      return { exists: (await repo.findUserByPhone(phone)) !== null };
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
