import type { UserProfile } from '@nearbux/types';
import type {
  RequestOtpInput,
  UpdateProfileInput,
  VerifyOtpInput,
} from '@nearbux/validation';
import type { ApiClient, AuthTokens } from './client.js';

export interface VerifyOtpResult {
  tokens: AuthTokens;
  isNewUser: boolean;
}

/**
 * Typed endpoint wrappers.
 *
 * Input types @nearbux/validation ke Zod schemas se infer hote hain — wahi
 * schemas jo server request validate karne ke liye use karta hai. Client aur
 * server kabhi diverge nahi kar sakte: schema badla, dono taraf compile error.
 *
 * Abhi sirf woh endpoints hain jo server par ASAL mein exist karte hain
 * (Phase 2). Stores/cart/orders Phase 5 mein aayenge.
 */
export function createEndpoints(client: ApiClient) {
  return {
    auth: {
      requestOtp(input: RequestOtpInput) {
        return client.request<{ expiresInSeconds: number }>('/v1/auth/otp/request', {
          method: 'POST',
          body: input,
          skipAuth: true,
        });
      },

      async verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
        const result = await client.request<VerifyOtpResult>('/v1/auth/otp/verify', {
          method: 'POST',
          body: input,
          skipAuth: true,
        });
        // Tokens turant persist karo — caller ko yaad rakhne ki zaroorat nahi
        await client.setTokens(result.tokens);
        return result;
      },

      async logout(refreshToken: string): Promise<void> {
        try {
          await client.request<void>('/v1/auth/logout', {
            method: 'POST',
            body: { refreshToken },
            skipAuth: true,
          });
        } finally {
          // Server call fail bhi ho jaaye to local tokens clear hone hi chahiye,
          // warna user "signed in" dikhta rahega bina kisi valid session ke
          await client.clearTokens();
        }
      },

      async logoutAll(): Promise<void> {
        try {
          await client.request<void>('/v1/auth/logout-all', { method: 'POST' });
        } finally {
          await client.clearTokens();
        }
      },
    },

    me: {
      get() {
        return client.request<UserProfile>('/v1/me');
      },
      update(input: UpdateProfileInput) {
        return client.request<UserProfile>('/v1/me', { method: 'PATCH', body: input });
      },
    },

    health: {
      check() {
        return client.request<{ status: string; uptimeSeconds: number }>('/v1/health', {
          skipAuth: true,
        });
      },
    },
  };
}

export type Endpoints = ReturnType<typeof createEndpoints>;
