import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import type { Db } from '@nearbux/database';
import { AppError } from './lib/errors.js';
import type { Env } from './lib/env.js';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import securityPlugin from './plugins/security.js';
import addressRoutes from './modules/addresses/addresses.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import cartRoutes from './modules/cart/cart.routes.js';
import favoriteRoutes from './modules/favorites/favorites.routes.js';
import healthRoutes from './modules/health/health.routes.js';
import meRoutes from './modules/me/me.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import orderRoutes from './modules/orders/orders.routes.js';
import storeRoutes from './modules/stores/stores.routes.js';

export interface BuildServerOptions {
  env: Env;
  /** Tests apna client inject karte hain */
  db?: Db;
}

interface HttpishError {
  statusCode: number;
  code?: string;
  message: string;
}

/** Kya yeh ek HTTP status wala error hai (Fastify ke built-in errors)? */
function asFastifyError(error: unknown): HttpishError | null {
  if (typeof error !== 'object' || error === null) return null;
  const candidate = error as Partial<HttpishError>;
  if (typeof candidate.statusCode !== 'number') return null;
  return {
    statusCode: candidate.statusCode,
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    message: typeof candidate.message === 'string' ? candidate.message : 'Request failed',
  };
}

export async function buildServer({ env, db }: BuildServerOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        // Secrets kabhi logs mein nahi. Ek logged Authorization header ka
        // matlab har us insaan ko session access jise log dikhte hain.
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.code',
          'req.body.refreshToken',
        ],
        censor: '[redacted]',
      },
      ...(env.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }
        : {}),
    },
    // Render / Fly proxy ke peeche request.ip sahi client IP hona chahiye,
    // warna rate limiting sab users ko ek hi proxy IP maan legi.
    trustProxy: true,
    disableRequestLogging: env.NODE_ENV === 'test',
  });

  /**
   * Empty JSON body ko accept karo.
   *
   * Fastify ka default parser `content-type: application/json` ke saath
   * khaali body par FST_ERR_CTP_EMPTY_JSON_BODY phenkta hai. Woh error
   * humare envelope se bahar nikalta hai, aur woh un endpoints ko todta hai
   * jo koi input lete hi nahi (`POST /auth/guest`, `/notifications/read-all`)
   * — kyunki bahut se HTTP clients aur proxies har POST par content-type
   * laga dete hain, body ho ya na ho.
   */
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_request, body, done) => {
      const raw = typeof body === 'string' ? body.trim() : '';
      if (raw.length === 0) return done(null, undefined);
      try {
        done(null, JSON.parse(raw));
      } catch {
        done(new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON'), undefined);
      }
    },
  );

  await app.register(prismaPlugin, db ? { db } : {});
  await app.register(authPlugin, { env });
  await app.register(securityPlugin, { env });

  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof AppError) {
      // 4xx expected hain — unhe error level par log karna real problems ko
      // noise mein chhupa deta hai.
      if (error.statusCode >= 500) request.log.error({ err: error }, error.message);
      return reply.code(error.statusCode).send({
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      });
    }

    if (error instanceof ZodError) {
      return reply.code(400).send({
        code: 'BAD_REQUEST',
        message: 'Validation failed',
        details: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    }

    // Fastify ke apne errors (rate limit, payload too large, malformed JSON)
    // FastifyError hote hain, humare AppError nahi. Unhe usi envelope mein
    // convert karte hain taaki client ko API se hamesha ek hi error shape mile.
    const fastifyError = asFastifyError(error);

    if (fastifyError?.statusCode === 429) {
      return reply.code(429).send({
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests. Please try again shortly.',
      });
    }

    if (fastifyError && fastifyError.statusCode < 500) {
      return reply.code(fastifyError.statusCode).send({
        code: fastifyError.code ?? 'BAD_REQUEST',
        message: fastifyError.message,
      });
    }

    // Unexpected — poora error log karo, client ko kuch mat batao.
    // Stack traces aur SQL errors schema leak karte hain.
    request.log.error({ err: error }, 'Unhandled error');
    return reply.code(500).send({ code: 'INTERNAL_ERROR', message: 'Something went wrong' });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  await app.register(async (api) => {
    await api.register(healthRoutes);
    await api.register(authRoutes, { env });
    await api.register(meRoutes);
    await api.register(addressRoutes);
    await api.register(storeRoutes);
    await api.register(cartRoutes);
    await api.register(orderRoutes);
    await api.register(notificationRoutes);
    await api.register(favoriteRoutes);
  }, { prefix: '/v1' });

  return app;
}
