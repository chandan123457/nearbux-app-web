import type { FastifyInstance } from 'fastify';
import {
  checkPhoneSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  signupSchema,
} from '@nearbux/validation';
import { parse } from '../../lib/validate.js';
import type { Env } from '../../lib/env.js';
import { createPhoneVerifier } from '../../lib/firebase.js';
import { createAuthRepository } from './auth.repository.js';
import { createAuthService } from './auth.service.js';

export default async function authRoutes(app: FastifyInstance, opts: { env: Env }) {
  const service = createAuthService({
    repo: createAuthRepository(app.db),
    env: opts.env,
    signAccessToken: (payload) => app.jwt.sign(payload),
    phoneVerifier: createPhoneVerifier(opts.env, {
      warn: (msg) => app.log.warn(msg),
    }),
  });

  function deviceContext(request: { ip: string; headers: Record<string, unknown> }) {
    return {
      ipAddress: request.ip,
      deviceLabel: (request.headers['user-agent'] as string | undefined) ?? null,
    };
  }

  /**
   * Screen [2] — Create your account.
   *
   * Rate limit global se sakht hai: har successful hit ek user row banati hai,
   * aur har attempt se pehle client ek Firebase SMS trigger karta hai. Dono
   * ke paise lagte hain aur dono abuse hone layak hain.
   */
  app.post(
    '/auth/signup',
    {
      config: {
        rateLimit: {
          max: opts.env.RATE_LIMIT_SIGNUP_MAX,
          timeWindow: opts.env.RATE_LIMIT_WINDOW,
        },
      },
    },
    async (request, reply) => {
      const body = parse(signupSchema, request.body);
      const result = await service.signup({ ...body, ...deviceContext(request) });
      reply.code(201);
      return result;
    },
  );

  /**
   * Screen [1] — Log in.
   *
   * Password endpoint brute-force ka sabse seedha surface hai: OTP ke ulta,
   * yahan attacker ke paas guess karne layak kuch hai. Per-IP limit sakht
   * hai, aur service constant-time reply deti hai.
   */
  app.post(
    '/auth/login',
    {
      config: {
        rateLimit: {
          max: opts.env.RATE_LIMIT_LOGIN_MAX,
          timeWindow: opts.env.RATE_LIMIT_WINDOW,
        },
      },
    },
    async (request) => {
      const body = parse(loginSchema, request.body);
      return service.login({ ...body, ...deviceContext(request) });
    },
  );

  /** Screen [1] → "Forgot Password?" — Firebase OTP se verify hokar reset */
  app.post(
    '/auth/forgot-password',
    {
      config: {
        rateLimit: {
          max: opts.env.RATE_LIMIT_SIGNUP_MAX,
          timeWindow: opts.env.RATE_LIMIT_WINDOW,
        },
      },
    },
    async (request) => {
      const body = parse(forgotPasswordSchema, request.body);
      return service.resetPassword({ ...body, ...deviceContext(request) });
    },
  );

  /** Signup form par "already registered" turant dikhane ke liye */
  app.post(
    '/auth/check-phone',
    {
      config: {
        rateLimit: {
          max: opts.env.RATE_LIMIT_PHONE_CHECK_MAX,
          timeWindow: opts.env.RATE_LIMIT_WINDOW,
        },
      },
    },
    async (request) => {
      const body = parse(checkPhoneSchema, request.body);
      return service.checkPhone(body.phone);
    },
  );

  app.post('/auth/refresh', async (request) => {
    const body = parse(refreshSchema, request.body);
    return service.refresh({
      refreshToken: body.refreshToken,
      ipAddress: request.ip,
      deviceLabel: request.headers['user-agent'] ?? null,
    });
  });

  app.post('/auth/logout', async (request, reply) => {
    const body = parse(refreshSchema, request.body);
    await service.logout(body.refreshToken);
    reply.code(204);
  });

  /** Sab devices se logout — "compromised account" recovery ke liye */
  app.post('/auth/logout-all', { preHandler: app.requireAuth }, async (request, reply) => {
    await service.logoutAll(request.currentUser!.sub);
    reply.code(204);
  });
}
