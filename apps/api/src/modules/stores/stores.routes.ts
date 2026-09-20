import type { FastifyInstance } from 'fastify';
import { nearbyQuerySchema, searchQuerySchema, storeProductsQuerySchema, uuidSchema } from '@nearbux/validation';
import { COMMERCE } from '@nearbux/core';
import { parse } from '../../lib/validate.js';
import { createStoreRepository } from './stores.repository.js';
import { createStoreService } from './stores.service.js';

/**
 * Platform ka fallback centre (Bengaluru).
 *
 * Yeh sirf tab lagta hai jab na request mein coordinates ho aur na user ka
 * koi address — practice mein yeh sirf ek unauthenticated caller hota hai.
 * Khaali feed dene se behtar hai ki kuch dikhe.
 */
const FALLBACK_COORDS = { latitude: 12.9716, longitude: 77.5946 };

export default async function storeRoutes(app: FastifyInstance) {
  const service = createStoreService(createStoreRepository(app.db));

  /** User ka default delivery address — "deliver to" aur discovery dono ke liye */
  function findDefaultAddress(userId: string) {
    return app.db.address.findFirst({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * "Kahan deliver karna hai" ka ek hi jawab.
   *
   * Priority: request ke coordinates → user ka default address → platform
   * fallback. Explicit coordinates isliye sabse upar hain ki aage map par
   * "search this area" jaisa feature unhi se chalega.
   */
  function resolveCoords(
    query: { latitude?: number; longitude?: number },
    address: { latitude: number; longitude: number } | null,
  ): { latitude: number; longitude: number } {
    if (query.latitude !== undefined && query.longitude !== undefined) {
      return { latitude: query.latitude, longitude: query.longitude };
    }
    if (address) return { latitude: address.latitude, longitude: address.longitude };
    return FALLBACK_COORDS;
  }

  /**
   * Screen [1] — home feed.
   *
   * Ek call, char cheezein: banners, offers, nearby stores, unread count.
   * Alag-alag endpoints se karne par app load par char round trips lagte,
   * aur mobile network par woh seedha dikhta hai.
   */
  app.get('/home', { preHandler: app.optionalAuth }, async (request) => {
    const query = parse(nearbyQuerySchema, request.query);
    const userId = request.currentUser?.sub ?? null;

    // Address PEHLE chahiye, kyunki feed ke coordinates usise aate hain.
    // Ise feed ke saath parallel chalane se ek round trip bachta tha, lekin
    // tab client ko coordinates bhejne padte — aur wahi purana bug tha jahan
    // home feed pehle hardcoded city centre ke stores dikhata tha.
    const address = userId ? await findDefaultAddress(userId) : null;
    const coords = resolveCoords(query, address);

    const [feed, unread] = await Promise.all([
      service.getHomeFeed({ ...coords, radiusKm: query.radiusKm, userId }),
      userId ? app.db.notification.count({ where: { userId, readAt: null } }) : Promise.resolve(0),
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
            // Khaali hisson ko filter karna zaroori hai: onboarding wala
            // address bina city ke bhi save ho sakta hai (reverse geocoding
            // fail ho jaaye to), aur tab template string "MG Road, " jaisa
            // latakta hua comma deta hai.
            formatted: [address.line1, address.line2, address.city].filter(Boolean).join(', '),
          }
        : null,
      unreadNotificationCount: unread,
    };
  });

  app.get('/stores', { preHandler: app.optionalAuth }, async (request) => {
    const query = parse(nearbyQuerySchema, request.query);
    const userId = request.currentUser?.sub ?? null;
    const coords = resolveCoords(query, userId ? await findDefaultAddress(userId) : null);
    return service.getNearbyStores({ ...coords, radiusKm: query.radiusKm, userId });
  });

  /** Screens [2][4] — search + recent searches persist */
  app.get('/search', { preHandler: app.optionalAuth }, async (request) => {
    const query = parse(searchQuerySchema, request.query);
    const userId = request.currentUser?.sub ?? null;

    const coords = resolveCoords(query, userId ? await findDefaultAddress(userId) : null);

    const [results, recent] = await Promise.all([
      // Schema field `q` hai (URL mein chhota rehna chahiye), service `query`
      // leti hai — yahin map hota hai
      service.search({
        userId,
        query: query.q,
        ...coords,
        radiusKm: query.radiusKm,
      }),
      userId
        ? app.db.searchHistory.findMany({
            where: { userId },
            orderBy: { searchedAt: 'desc' },
            take: COMMERCE.MAX_RECENT_SEARCHES,
            select: { query: true },
          })
        : Promise.resolve([]),
    ]);

    // Search history sirf signed-in users ke liye — guest ki koi identity nahi
    // jisse ise attach kiya ja sake.
    if (userId) {
      // Upsert, naya row nahi, warna same query baar-baar chips mein bhar jaati hai
      await app.db.searchHistory
        .upsert({
          where: { userId_query: { userId, query: query.q } },
          create: { userId, query: query.q },
          update: { searchedAt: new Date() },
        })
        .catch(() => undefined);
    }

    return { ...results, recentSearches: recent.map((r) => r.query) };
  });

  app.get('/search/recent', { preHandler: app.optionalAuth }, async (request) => {
    const userId = request.currentUser?.sub;
    if (!userId) return { recentSearches: [] };

    const rows = await app.db.searchHistory.findMany({
      where: { userId },
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
    { preHandler: app.optionalAuth },
    async (request) => {
      const { latitude, longitude } = request.query as { latitude?: string; longitude?: string };
      const userId = request.currentUser?.sub ?? null;

      // Distance yahan bhi user ke address se nikalti hai. Iske bina store
      // detail "0.0 km" dikhata tha jabki usi store ka card home list par
      // sahi distance dikha raha hota — ek hi store, do alag jawab.
      const coords = resolveCoords(
        {
          latitude: latitude ? Number(latitude) : undefined,
          longitude: longitude ? Number(longitude) : undefined,
        },
        userId ? await findDefaultAddress(userId) : null,
      );

      return service.getStoreBySlug({
        slug: request.params.slug,
        userId,
        ...coords,
      });
    },
  );

  /** Screens [3][5] — catalog */
  app.get<{ Params: { id: string } }>(
    '/stores/:id/products',
    { preHandler: app.optionalAuth },
    async (request) => {
      const storeId = parse(uuidSchema, request.params.id);
      const query = parse(storeProductsQuerySchema, request.query);
      return service.getStoreProducts({ ...query, storeId, userId: request.currentUser?.sub ?? null });
    },
  );

  /** Screen [6] — product detail */
  app.get<{ Params: { id: string } }>(
    '/products/:id',
    { preHandler: app.optionalAuth },
    async (request) => {
      const productId = parse(uuidSchema, request.params.id);
      return service.getProduct({ productId, userId: request.currentUser?.sub ?? null });
    },
  );
}
