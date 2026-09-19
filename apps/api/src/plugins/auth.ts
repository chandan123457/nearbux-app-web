import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { Errors } from '../lib/errors.js';
import type { Env } from '../lib/env.js';

export interface AccessTokenPayload {
  sub: string; // user id
  /** Guest par null — token phir bhi valid hai, bas identity anonymous hai */
  phone: string | null;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler: route ko sirf authenticated users ke liye band karta hai */
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /**
     * preHandler: token ho to use karo, na ho to guest ke roop mein aage badho.
     *
     * Discovery isi ke peeche hai. Browsing ke liye account zaroori karna
     * sabse mehnga funnel step hai — user pehle dekhna chahta hai ki uske
     * paas kya available hai. Login checkout par maanga jaata hai.
     *
     * Token hone par personalisation milta hai (favourites, cart quantities);
     * na hone par wahi data bina personalisation ke.
     */
    optionalAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    currentUser?: AccessTokenPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

/**
 * Access-token verification.
 *
 * SIRF access tokens yahan verify hote hain. Refresh tokens JWT nahi hain —
 * woh opaque random strings hain jo database mein rehte hain, taaki unhe
 * REVOKE kiya ja sake. Ek signed JWT ko expiry se pehle invalidate nahi kiya
 * ja sakta; isliye access token short-lived (15m) hai aur refresh token
 * database-backed.
 */
export default fp(
  async function authPlugin(app: FastifyInstance, opts: { env: Env }) {
    await app.register(fastifyJwt, {
      secret: opts.env.JWT_ACCESS_SECRET,
      sign: { expiresIn: opts.env.ACCESS_TOKEN_TTL },
    });

    app.decorate('requireAuth', async function (request: FastifyRequest) {
      try {
        await request.jwtVerify();
      } catch {
        throw Errors.unauthorized('Invalid or expired access token');
      }
      request.currentUser = request.user;
    });

    app.decorate('optionalAuth', async function (request: FastifyRequest) {
      // Expired ya galat token guest ki tarah treat hota hai, error ki tarah
      // nahi — browsing ko kabhi block nahi karna chahiye.
      try {
        await request.jwtVerify();
        request.currentUser = request.user;
      } catch {
        request.currentUser = undefined;
      }
    });
  },
  { name: 'auth', dependencies: [] },
);
