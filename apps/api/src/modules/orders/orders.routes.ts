import type { FastifyInstance } from 'fastify';
import { cancelOrderSchema, orderListQuerySchema, placeOrderSchema, uuidSchema } from '@nearbux/validation';
import { parse } from '../../lib/validate.js';
import { createOrderRepository } from './orders.repository.js';
import { createOrderService } from './orders.service.js';

export default async function orderRoutes(app: FastifyInstance) {
  const service = createOrderService(createOrderRepository(app.db));

  /** Screens [8][9] — "Place Order" */
  app.post('/orders', { preHandler: app.requireAuth }, async (request, reply) => {
    const body = parse(placeOrderSchema, request.body);
    const order = await service.placeOrder({ ...body, userId: request.currentUser!.sub });
    reply.code(201);
    return order;
  });

  /** Screen [11] */
  app.get('/orders', { preHandler: app.requireAuth }, async (request) => {
    const query = parse(orderListQuerySchema, request.query);
    return service.listOrders({ ...query, userId: request.currentUser!.sub });
  });

  /** Screens [10][14] — tracking aur receipt */
  app.get<{ Params: { id: string } }>(
    '/orders/:id',
    { preHandler: app.requireAuth },
    async (request) => {
      const userId = request.currentUser!.sub;
      const raw = request.params.id;
      // Order number se bhi lookup allow karo ("NB-4032") — deep links aur
      // support conversations usi ko use karte hain, UUID ko nahi
      return raw.startsWith('NB-')
        ? service.getOrderByNumber(userId, raw)
        : service.getOrder(userId, parse(uuidSchema, raw));
    },
  );

  app.post<{ Params: { id: string } }>(
    '/orders/:id/cancel',
    { preHandler: app.requireAuth },
    async (request) => {
      const orderId = parse(uuidSchema, request.params.id);
      const body = parse(cancelOrderSchema, request.body);
      return service.cancelOrder({
        userId: request.currentUser!.sub,
        orderId,
        reason: body.reason,
      });
    },
  );
}
