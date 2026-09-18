import type { FastifyInstance } from 'fastify';
import { addToCartSchema, applyPromotionSchema, updateCartItemSchema, uuidSchema } from '@nearbux/validation';
import { parse } from '../../lib/validate.js';
import { createCartRepository } from './cart.repository.js';
import { createCartService } from './cart.service.js';

export default async function cartRoutes(app: FastifyInstance) {
  const service = createCartService(createCartRepository(app.db));

  /** Saare carts — ek per store (screen [7] "Fulfilled by …") */
  app.get('/carts', { preHandler: app.requireAuth }, async (request) => {
    return service.listCarts(request.currentUser!.sub);
  });

  app.get<{ Params: { storeId: string } }>(
    '/carts/:storeId',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const storeId = parse(uuidSchema, request.params.storeId);
      const cart = await service.loadCart(request.currentUser!.sub, storeId);
      // Khaali cart 404 nahi hai — woh ek valid state hai
      if (!cart) return reply.code(200).send(null);
      return cart;
    },
  );

  /** "+" button (screens [3][4][5][6]) */
  app.post('/cart/items', { preHandler: app.requireAuth }, async (request, reply) => {
    const body = parse(addToCartSchema, request.body);
    const cart = await service.addItem({ ...body, userId: request.currentUser!.sub });
    reply.code(201);
    return cart;
  });

  /** Quantity stepper. quantity: 0 = remove */
  app.patch<{ Params: { storeId: string; productId: string } }>(
    '/carts/:storeId/items/:productId',
    { preHandler: app.requireAuth },
    async (request) => {
      const storeId = parse(uuidSchema, request.params.storeId);
      const productId = parse(uuidSchema, request.params.productId);
      const body = parse(updateCartItemSchema, request.body);
      return service.updateItem({
        userId: request.currentUser!.sub,
        storeId,
        productId,
        quantity: body.quantity,
      });
    },
  );

  /** "Clear All" (screen [7]) */
  app.delete<{ Params: { storeId: string } }>(
    '/carts/:storeId',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const storeId = parse(uuidSchema, request.params.storeId);
      await service.clear({ userId: request.currentUser!.sub, storeId });
      reply.code(204);
    },
  );

  app.post<{ Params: { storeId: string } }>(
    '/carts/:storeId/promotion',
    { preHandler: app.requireAuth },
    async (request) => {
      const storeId = parse(uuidSchema, request.params.storeId);
      const body = parse(applyPromotionSchema, request.body);
      return service.applyPromotion({
        userId: request.currentUser!.sub,
        storeId,
        code: body.code,
      });
    },
  );

  /** "Remove" link next to applied promo */
  app.delete<{ Params: { storeId: string } }>(
    '/carts/:storeId/promotion',
    { preHandler: app.requireAuth },
    async (request) => {
      const storeId = parse(uuidSchema, request.params.storeId);
      return service.removePromotion({ userId: request.currentUser!.sub, storeId });
    },
  );
}
