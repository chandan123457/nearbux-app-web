import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { prisma, type Db } from '@nearbux/database';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}

/**
 * Prisma client ko fastify par decorate karta hai.
 *
 * Routes `app.db` use karte hain, module-level import nahi — isse tests
 * server build karte waqt ek alag client inject kar sakte hain.
 */
export default fp(
  async function prismaPlugin(app: FastifyInstance, opts: { db?: Db }) {
    const db = opts.db ?? prisma;
    app.decorate('db', db);

    app.addHook('onClose', async () => {
      await db.$disconnect();
    });
  },
  { name: 'prisma' },
);
