import type { FastifyInstance } from 'fastify';
import { uuidSchema } from '@nearbux/validation';
import { parse } from '../../lib/validate.js';

/** Heart toggles — store cards aur product cards par */
export default async function favoriteRoutes(app: FastifyInstance) {
  app.put<{ Params: { storeId: string } }>(
    '/favorites/stores/:storeId',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const storeId = parse(uuidSchema, request.params.storeId);
      const userId = request.currentUser!.sub;
      // PUT idempotent hai — double-tap se error nahi aana chahiye
      await app.db.favoriteStore.upsert({
        where: { userId_storeId: { userId, storeId } },
        create: { userId, storeId },
        update: {},
      });
      reply.code(204);
    },
  );

  app.delete<{ Params: { storeId: string } }>(
    '/favorites/stores/:storeId',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const storeId = parse(uuidSchema, request.params.storeId);
      await app.db.favoriteStore.deleteMany({
        where: { userId: request.currentUser!.sub, storeId },
      });
      reply.code(204);
    },
  );

  app.put<{ Params: { productId: string } }>(
    '/favorites/products/:productId',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const productId = parse(uuidSchema, request.params.productId);
      const userId = request.currentUser!.sub;
      await app.db.favoriteProduct.upsert({
        where: { userId_productId: { userId, productId } },
        create: { userId, productId },
        update: {},
      });
      reply.code(204);
    },
  );

  app.delete<{ Params: { productId: string } }>(
    '/favorites/products/:productId',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const productId = parse(uuidSchema, request.params.productId);
      await app.db.favoriteProduct.deleteMany({
        where: { userId: request.currentUser!.sub, productId },
      });
      reply.code(204);
    },
  );
}
