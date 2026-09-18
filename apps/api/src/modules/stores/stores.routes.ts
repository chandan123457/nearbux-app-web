import type { FastifyInstance } from 'fastify';
import { nearbyQuerySchema, searchQuerySchema, storeProductsQuerySchema, uuidSchema } from '@nearbux/validation';
import { COMMERCE } from '@nearbux/core';
import { parse } from '../../lib/validate.js';
import { createStoreRepository } from './stores.repository.js';
import { createStoreService } from './stores.service.js';

export default async function storeRoutes(app: FastifyInstance) {
  const service = createStoreService(createStoreRepository(app.db));

  /**
   * Screen [1] — home feed.
   *
   * Ek call, char cheezein: banners, offers, nearby stores, unread count.
   * Alag-alag endpoints se karne par app load par char round trips lagte,
   * aur mobile network par woh seedha dikhta hai.
   */
  app.get('/home', { preHandler: app.requireAuth }, async (request) => {
    const query = parse(nearbyQuerySchema, request.query);
    const userId = request.currentUser!.sub;

    const [feed, address, unread] = await Promise.all([
      service.getHomeFeed({ ...query, userId }),
      app.db.address.findFirst({
        where: { userId, deletedAt: null },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      }),
      app.db.notification.count({ where: { userId, readAt: null } }),
    ]);

    return {
      ...feed,
      deliverTo: address
        ? {
            id: address.id,
            label: address.label,
            line1: address.line1,
            line2: address.line2,
            landmark: address.landmark,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            latitude: address.latitude,
            longitude: address.longitude,
            isDefault: address.isDefault,
            formatted: `${address.line1}${address.line2 ? `, ${address.line2}` : ''}, ${address.city}`,
          }
        : null,
      unreadNotificationCount: unread,
    };
  });

  app.get('/stores', { preHandler: app.requireAuth }, async (request) => {
    const query = parse(nearbyQuerySchema, request.query);
    return service.getNearbyStores({ ...query, userId: request.currentUser!.sub });
  });

  /** Screens [2][4] — search + recent searches persist */
  app.get('/search', { preHandler: app.requireAuth }, async (request) => {
    const query = parse(searchQuerySchema, request.query);
    const userId = request.currentUser!.sub;

    const [results, recent] = await Promise.all([
      // Schema field `q` hai (URL mein chhota rehna chahiye), service `query`
      // leti hai — yahin map hota hai
      service.search({
        userId,
        query: query.q,
        latitude: query.latitude,
        longitude: query.longitude,
        radiusKm: query.radiusKm,
      }),
      app.db.searchHistory.findMany({
        where: { userId },
        orderBy: { searchedAt: 'desc' },
        take: COMMERCE.MAX_RECENT_SEARCHES,
        select: { query: true },
      }),
    ]);

    // Search record karo — upsert, naya row nahi, warna same query baar-baar
    // chips mein bhar jaati hai
    await app.db.searchHistory
      .upsert({
        where: { userId_query: { userId, query: query.q } },
        create: { userId, query: query.q },
        update: { searchedAt: new Date() },
      })
      .catch(() => undefined);

    return { ...results, recentSearches: recent.map((r) => r.query) };
  });

  app.get('/search/recent', { preHandler: app.requireAuth }, async (request) => {
    const rows = await app.db.searchHistory.findMany({
      where: { userId: request.currentUser!.sub },
      orderBy: { searchedAt: 'desc' },
      take: COMMERCE.MAX_RECENT_SEARCHES,
      select: { query: true },
    });
    return { recentSearches: rows.map((r) => r.query) };
  });

  app.delete('/search/recent', { preHandler: app.requireAuth }, async (request, reply) => {
    await app.db.searchHistory.deleteMany({ where: { userId: request.currentUser!.sub } });
    reply.code(204);
  });

  /** Screen [3] — store detail */
  app.get<{ Params: { slug: string } }>(
    '/stores/:slug',
    { preHandler: app.requireAuth },
    async (request) => {
      const { latitude, longitude } = request.query as { latitude?: string; longitude?: string };
      return service.getStoreBySlug({
        slug: request.params.slug,
        userId: request.currentUser!.sub,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
      });
    },
  );

  /** Screens [3][5] — catalog */
  app.get<{ Params: { id: string } }>(
    '/stores/:id/products',
    { preHandler: app.requireAuth },
    async (request) => {
      const storeId = parse(uuidSchema, request.params.id);
      const query = parse(storeProductsQuerySchema, request.query);
      return service.getStoreProducts({ ...query, storeId, userId: request.currentUser!.sub });
    },
  );

  /** Screen [6] — product detail */
  app.get<{ Params: { id: string } }>(
    '/products/:id',
    { preHandler: app.requireAuth },
    async (request) => {
      const productId = parse(uuidSchema, request.params.id);
      return service.getProduct({ productId, userId: request.currentUser!.sub });
    },
  );
}
