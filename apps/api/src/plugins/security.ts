import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { corsOrigins, type Env } from '../lib/env.js';

export default fp(
  async function securityPlugin(app: FastifyInstance, opts: { env: Env }) {
    const { env } = opts;

    await app.register(helmet, {
      // API JSON serve karta hai, HTML nahi — CSP yahan kuch nahi deta aur
      // sirf noise add karta hai.
      contentSecurityPolicy: false,
    });

    await app.register(cors, {
      origin: corsOrigins(env),
      credentials: true,
    });

    // Global baseline. Auth routes iske upar apna sakht limit lagate hain —
    // OTP endpoint sabse zyada abuse hone wala surface hai (SMS costs paise).
    await app.register(rateLimit, {
      global: true,
      max: env.RATE_LIMIT_GLOBAL_MAX,
      timeWindow: '1 minute',
      // Authenticated users ko per-user limit, warna per-IP. Ek office ke
      // 50 log ek hi NAT IP share kar sakte hain.
      keyGenerator: (request) => request.currentUser?.sub ?? request.ip,
    });
  },
  { name: 'security' },
);
