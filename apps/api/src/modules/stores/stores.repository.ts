import { Prisma, type Db } from '@nearbux/database';

export interface NearbyStoreRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  ratingAvg: Prisma.Decimal;
  ratingCount: number;
  deliveryFeeMinor: number;
  minOrderMinor: number;
  etaMinMinutes: number;
  etaMaxMinutes: number;
  isTemporarilyClosed: boolean;
  distanceKm: number;
}

export function createStoreRepository(db: Db) {
  return {
    /**
     * Nearby stores, distance ke hisaab se sorted.
     *
     * Yeh raw SQL hai kyunki Prisma geospatial operators support nahi karta.
     * Har store ko JS mein laakar filter karna scale nahi karega — 10,000
     * stores par woh 10,000 rows network par bhejega taaki 8 dikha sake.
     *
     * `earth_box` pehle chalta hai: woh GiST index use karta hai aur zyadatar
     * rows ko sasta mein hata deta hai. Uske baad `earth_distance` sirf bache
     * hue candidates par exact check karta hai — box ek square hai, circle
     * nahi, isliye dono chahiye.
     */
    async findNearby(params: {
      latitude: number;
      longitude: number;
      radiusKm: number;
      limit: number;
    }): Promise<NearbyStoreRow[]> {
      const radiusMeters = params.radiusKm * 1000;
      return db.$queryRaw<NearbyStoreRow[]>`
        SELECT
          s.id, s.slug, s.name, s.tagline, s."logoUrl", s."coverUrl",
          s."ratingAvg", s."ratingCount", s."deliveryFeeMinor", s."minOrderMinor",
          s."etaMinMinutes", s."etaMaxMinutes", s."isTemporarilyClosed",
          (earth_distance(
            ll_to_earth(${params.latitude}, ${params.longitude}),
            ll_to_earth(s.latitude, s.longitude)
          ) / 1000)::float AS "distanceKm"
        FROM stores s
        WHERE s."isActive" = true
          AND earth_box(ll_to_earth(${params.latitude}, ${params.longitude}), ${radiusMeters})
              @> ll_to_earth(s.latitude, s.longitude)
          AND earth_distance(
                ll_to_earth(${params.latitude}, ${params.longitude}),
                ll_to_earth(s.latitude, s.longitude)
              ) <= ${radiusMeters}
        ORDER BY "distanceKm" ASC
        LIMIT ${params.limit}
      `;
    },

    /**
     * Search: stores + products, fuzzy matching ke saath.
     *
     * `%` pg_trgm ka similarity operator hai (GIN index use karta hai), aur
     * ILIKE substring matches pakadta hai jo trigram threshold se neeche reh
     * jaate hain — "milk" jaisa chhota word similarity kam deta hai lekin
     * user usi ko dhoondh raha hota hai.
     */
    async searchStores(params: {
      query: string;
      latitude: number;
      longitude: number;
      radiusKm: number;
      limit: number;
    }): Promise<NearbyStoreRow[]> {
      const radiusMeters = params.radiusKm * 1000;
      const pattern = `%${params.query}%`;
      return db.$queryRaw<NearbyStoreRow[]>`
        SELECT
          s.id, s.slug, s.name, s.tagline, s."logoUrl", s."coverUrl",
          s."ratingAvg", s."ratingCount", s."deliveryFeeMinor", s."minOrderMinor",
          s."etaMinMinutes", s."etaMaxMinutes", s."isTemporarilyClosed",
          (earth_distance(
            ll_to_earth(${params.latitude}, ${params.longitude}),
            ll_to_earth(s.latitude, s.longitude)
          ) / 1000)::float AS "distanceKm"
        FROM stores s
        WHERE s."isActive" = true
          AND earth_box(ll_to_earth(${params.latitude}, ${params.longitude}), ${radiusMeters})
              @> ll_to_earth(s.latitude, s.longitude)
          AND (s.name % ${params.query} OR s.name ILIKE ${pattern})
        ORDER BY similarity(s.name, ${params.query}) DESC, "distanceKm" ASC
        LIMIT ${params.limit}
      `;
    },

    async searchProducts(params: { query: string; storeIds: string[]; limit: number }) {
      if (params.storeIds.length === 0) return [];
      const pattern = `%${params.query}%`;
      return db.$queryRaw<
        Array<{
          id: string;
          storeId: string;
          storeName: string;
          name: string;
          unitLabel: string;
          images: string[];
          priceMinor: number;
          mrpMinor: number | null;
          isAvailable: boolean;
        }>
      >`
        SELECT p.id, p."storeId", s.name AS "storeName", p.name, p."unitLabel",
               p.images, p."priceMinor", p."mrpMinor", p."isAvailable"
        FROM products p
        JOIN stores s ON s.id = p."storeId"
        WHERE p."deletedAt" IS NULL
          AND p."storeId" IN (${Prisma.join(params.storeIds)})
          AND (p.name % ${params.query} OR p.name ILIKE ${pattern})
        ORDER BY similarity(p.name, ${params.query}) DESC, p."popularityScore" DESC
        LIMIT ${params.limit}
      `;
    },

    findHoursForStores(storeIds: string[]) {
      return db.storeHours.findMany({ where: { storeId: { in: storeIds } } });
    },

    findCategoriesForStores(storeIds: string[]) {
      return db.storeCategoryLink.findMany({
        where: { storeId: { in: storeIds } },
        include: { category: { select: { name: true } } },
      });
    },

    findFavoriteStoreIds(userId: string, storeIds: string[]) {
      return db.favoriteStore.findMany({
        where: { userId, storeId: { in: storeIds } },
        select: { storeId: true },
      });
    },

    findBySlug(slug: string) {
      return db.store.findFirst({
        where: { slug, isActive: true },
        include: {
          hours: true,
          categories: { include: { category: { select: { name: true } } } },
          sections: {
            orderBy: { sortOrder: 'asc' },
            include: { _count: { select: { products: { where: { deletedAt: null } } } } },
          },
        },
      });
    },

    findById(id: string) {
      return db.store.findFirst({ where: { id, isActive: true }, include: { hours: true } });
    },

    findProducts(params: {
      storeId: string;
      categoryId?: string;
      query?: string;
      sort: 'POPULARITY' | 'PRICE_LOW_HIGH' | 'PRICE_HIGH_LOW' | 'RATING';
      inStockOnly: boolean;
      limit: number;
      cursor?: string;
    }) {
      const orderBy = {
        POPULARITY: [{ popularityScore: 'desc' as const }, { id: 'asc' as const }],
        PRICE_LOW_HIGH: [{ priceMinor: 'asc' as const }, { id: 'asc' as const }],
        PRICE_HIGH_LOW: [{ priceMinor: 'desc' as const }, { id: 'asc' as const }],
        RATING: [{ ratingAvg: 'desc' as const }, { id: 'asc' as const }],
      }[params.sort];

      return db.product.findMany({
        where: {
          storeId: params.storeId,
          deletedAt: null,
          ...(params.categoryId ? { categoryId: params.categoryId } : {}),
          ...(params.inStockOnly ? { isAvailable: true } : {}),
          ...(params.query ? { name: { contains: params.query, mode: 'insensitive' } } : {}),
        },
        orderBy,
        take: params.limit + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      });
    },

    findProductById(id: string) {
      return db.product.findFirst({
        where: { id, deletedAt: null },
        include: { store: { select: { id: true, name: true } } },
      });
    },

    findRelatedProducts(params: { storeId: string; excludeId: string; limit: number }) {
      return db.product.findMany({
        where: { storeId: params.storeId, deletedAt: null, id: { not: params.excludeId } },
        orderBy: { popularityScore: 'desc' },
        take: params.limit,
      });
    },

    findFavoriteProductIds(userId: string, productIds: string[]) {
      return db.favoriteProduct.findMany({
        where: { userId, productId: { in: productIds } },
        select: { productId: true },
      });
    },

    findCartQuantities(userId: string, productIds: string[]) {
      return db.cartItem.findMany({
        where: { cart: { userId }, productId: { in: productIds } },
        select: { productId: true, quantity: true },
      });
    },

    findActiveBanners() {
      const now = new Date();
      return db.banner.findMany({
        where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
        orderBy: { sortOrder: 'asc' },
      });
    },

    findActiveOffers(storeIds: string[]) {
      const now = new Date();
      return db.promotion.findMany({
        where: {
          isActive: true,
          startsAt: { lte: now },
          endsAt: { gte: now },
          OR: [{ scope: 'PLATFORM' }, { storeId: { in: storeIds } }],
        },
        include: { store: { select: { name: true, tagline: true } } },
        orderBy: { endsAt: 'asc' },
        take: 10,
      });
    },
  };
}

export type StoreRepository = ReturnType<typeof createStoreRepository>;
