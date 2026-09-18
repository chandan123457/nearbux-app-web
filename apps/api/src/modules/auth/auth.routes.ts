import type { FastifyInstance } from 'fastify';
import { refreshSchema, requestOtpSchema, verifyOtpSchema } from '@nearbux/validation';
import { parse } from '../../lib/validate.js';
import type { Env } from '../../lib/env.js';
import { createAuthRepository } from './auth.repository.js';
import { createAuthService } from './auth.service.js';

export default async function authRoutes(app: FastifyInstance, opts: { env: Env }) {
  const service = createAuthService({
    repo: createAuthRepository(app.db),
    env: opts.env,
    signAccessToken: (payload) => app.jwt.sign(payload),
  });

  /**
   * OTP endpoint global limit se kaafi sakht hai.
   *
   * Har request ek SMS bhejta hai, jiske paise lagte hain. Ise open chhodna
   * matlab attacker ko free SMS bomb dena. Per-phone limit service mein
   * alag se hai — yeh per-IP layer hai.
   */
  app.post(
    '/auth/otp/request',
    {
      config: {
        rateLimit: {
          max: opts.env.RATE_LIMIT_OTP_REQUEST_MAX,
          timeWindow: opts.env.RATE_LIMIT_WINDOW,
        },
      },
    },
    async (request) => {
      const body = parse(requestOtpSchema, request.body);
      return service.requestOtp(body);
    },
  );

  app.post(
    '/auth/otp/verify',
    {
      config: {
        rateLimit: {
          max: opts.env.RATE_LIMIT_OTP_VERIFY_MAX,
          timeWindow: opts.env.RATE_LIMIT_WINDOW,
        },
      },
    },
    async (request, reply) => {
      const body = parse(verifyOtpSchema, request.body);
      const result = await service.verifyOtp({
        ...body,
        ipAddress: request.ip,
        deviceLabel: request.headers['user-agent'] ?? null,
      });
      reply.code(result.isNewUser ? 201 : 200);
      return result;
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
