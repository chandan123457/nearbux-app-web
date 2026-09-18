import { discountPercent, type StoreHourSlot } from '@nearbux/core';
import type {
  HomeFeed,
  ProductDetail,
  ProductSummary,
  SearchResults,
  StoreDetail,
  StoreSummary,
} from '@nearbux/types';
import { Errors } from '../../lib/errors.js';
import type { StoreRepository } from './stores.repository.js';
import { toOffer, toProductSummary, toStoreSummary } from './stores.mappers.js';

const NEARBY_LIMIT = 20;
const SEARCH_STORE_LIMIT = 10;
const SEARCH_PRODUCT_LIMIT = 20;
const RELATED_LIMIT = 8;

export function createStoreService(repo: StoreRepository) {
  /**
   * Store rows ko unke hours, categories aur favourites ke saath hydrate
   * karta hai.
   *
   * Yeh sab ek-ek karke fetch karna classic N+1 hai: 20 stores = 60 queries.
   * Yahan teen batch queries chalti hain, chahe kitne bhi stores hon.
   */
  async function hydrateStores(
    rows: Awaited<ReturnType<StoreRepository['findNearby']>>,
    userId: string | null,
  ): Promise<StoreSummary[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);

    const [hours, categories, favorites] = await Promise.all([
      repo.findHoursForStores(ids),
      repo.findCategoriesForStores(ids),
      userId ? repo.findFavoriteStoreIds(userId, ids) : Promise.resolve([]),
    ]);

    const hoursByStore = new Map<string, StoreHourSlot[]>();
    for (const h of hours) {
      const list = hoursByStore.get(h.storeId) ?? [];
      list.push({ dayOfWeek: h.dayOfWeek, opensAt: h.opensAt, closesAt: h.closesAt });
      hoursByStore.set(h.storeId, list);
    }

    const categoriesByStore = new Map<string, string[]>();
    for (const link of categories) {
      const list = categoriesByStore.get(link.storeId) ?? [];
      // Primary category pehle — store card wahi tagline dikhata hai
      if (link.isPrimary) list.unshift(link.category.name);
      else list.push(link.category.name);
      categoriesByStore.set(link.storeId, list);
    }

    const ctx = {
      hoursByStore,
      categoriesByStore,
      favoriteStoreIds: new Set(favorites.map((f) => f.storeId)),
    };
    return rows.map((row) => toStoreSummary(row, ctx));
  }

  async function hydrateProducts(
    rows: Array<Parameters<typeof toProductSummary>[0] & { storeName?: string }>,
    storeNameById: Map<string, string>,
    userId: string | null,
  ): Promise<ProductSummary[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);

    const [favorites, cartItems] = await Promise.all([
      userId ? repo.findFavoriteProductIds(userId, ids) : Promise.resolve([]),
      userId ? repo.findCartQuantities(userId, ids) : Promise.resolve([]),
    ]);

    const favoriteProductIds = new Set(favorites.map((f) => f.productId));
    const cartQuantities = new Map(cartItems.map((c) => [c.productId, c.quantity]));

    return rows.map((row) =>
      toProductSummary(row, {
        storeName: row.storeName ?? storeNameById.get(row.storeId) ?? '',
        favoriteProductIds,
        cartQuantities,
      }),
    );
  }

  return {
    /** Screen [1] — ek call mein poora home feed */
    async getHomeFeed(params: {
      userId: string | null;
      latitude: number;
      longitude: number;
      radiusKm: number;
    }): Promise<Omit<HomeFeed, 'deliverTo' | 'unreadNotificationCount'>> {
      const rows = await repo.findNearby({ ...params, limit: NEARBY_LIMIT });
      const nearbyStores = await hydrateStores(rows, params.userId);

      const [banners, offers] = await Promise.all([
        repo.findActiveBanners(),
        repo.findActiveOffers(rows.map((r) => r.id)),
      ]);

      return {
        banners: banners.map((b) => ({
          id: b.id,
          title: b.title,
          subtitle: b.subtitle,
          imageUrl: b.imageUrl,
          ctaLabel: b.ctaLabel,
          targetStoreId: b.targetStoreId,
          isSponsored: b.isSponsored,
        })),
        offers: offers.map((o) => toOffer(o)),
        nearbyStores,
      };
    },

    async getNearbyStores(params: {
      userId: string | null;
      latitude: number;
      longitude: number;
      radiusKm: number;
    }): Promise<StoreSummary[]> {
      const rows = await repo.findNearby({ ...params, limit: NEARBY_LIMIT });
      return hydrateStores(rows, params.userId);
    },

    /** Screen [4] — stores aur products dono */
    async search(params: {
      userId: string | null;
      query: string;
      latitude: number;
      longitude: number;
      radiusKm: number;
    }): Promise<Omit<SearchResults, 'recentSearches'>> {
      // Products sirf un stores se aate hain jo deliver kar sakte hain.
      // Kisi aisi cheez ko dikhana jo order hi nahi ho sakti, sabse
      // frustrating search result hai.
      const nearbyRows = await repo.findNearby({ ...params, limit: 50 });
      const storeNameById = new Map(nearbyRows.map((r) => [r.id, r.name]));

      const [storeRows, productRows] = await Promise.all([
        repo.searchStores({ ...params, limit: SEARCH_STORE_LIMIT }),
        repo.searchProducts({
          query: params.query,
          storeIds: nearbyRows.map((r) => r.id),
          limit: SEARCH_PRODUCT_LIMIT,
        }),
      ]);

      const [stores, products] = await Promise.all([
        hydrateStores(storeRows, params.userId),
        hydrateProducts(productRows, storeNameById, params.userId),
      ]);

      return { query: params.query, stores, products };
    },

    /** Screen [3] — store detail with sections */
    async getStoreBySlug(params: {
      slug: string;
      userId: string | null;
      latitude?: number;
      longitude?: number;
    }): Promise<StoreDetail> {
      const store = await repo.findBySlug(params.slug);
      if (!store) throw Errors.notFound('Store');

      const [summary] = await hydrateStores(
        [
          {
            id: store.id,
            slug: store.slug,
            name: store.name,
            tagline: store.tagline,
            logoUrl: store.logoUrl,
            coverUrl: store.coverUrl,
            ratingAvg: store.ratingAvg,
            ratingCount: store.ratingCount,
            deliveryFeeMinor: store.deliveryFeeMinor,
            minOrderMinor: store.minOrderMinor,
            etaMinMinutes: store.etaMinMinutes,
            etaMaxMinutes: store.etaMaxMinutes,
            isTemporarilyClosed: store.isTemporarilyClosed,
            distanceKm: distanceOrZero(store, params),
          },
        ],
        params.userId,
      );

      return {
        ...summary!,
        description: store.description,
        phone: store.phone,
        addressLine: store.addressLine,
        minOrderMinor: store.minOrderMinor,
        sections: store.sections.map((s) => ({
          id: s.id,
          name: s.name,
          productCount: s._count.products,
        })),
      };
    },

    /** Screens [3][5] — catalog with cursor pagination */
    async getStoreProducts(params: {
      storeId: string;
      userId: string | null;
      categoryId?: string;
      query?: string;
      sort: 'POPULARITY' | 'PRICE_LOW_HIGH' | 'PRICE_HIGH_LOW' | 'RATING';
      inStockOnly: boolean;
      limit: number;
      cursor?: string;
    }) {
      const store = await repo.findById(params.storeId);
      if (!store) throw Errors.notFound('Store');

      const rows = await repo.findProducts(params);
      // Limit se ek extra maanga tha — usse pata chalta hai aur pages hain ya nahi
      const hasMore = rows.length > params.limit;
      const page = hasMore ? rows.slice(0, params.limit) : rows;

      const items = await hydrateProducts(
        page,
        new Map([[store.id, store.name]]),
        params.userId,
      );

      return { items, nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null, hasMore };
    },

    /** Screen [6] — product detail */
    async getProduct(params: { productId: string; userId: string | null }): Promise<ProductDetail> {
      const product = await repo.findProductById(params.productId);
      if (!product) throw Errors.notFound('Product');

      const relatedRows = await repo.findRelatedProducts({
        storeId: product.storeId,
        excludeId: product.id,
        limit: RELATED_LIMIT,
      });

      const storeNames = new Map([[product.storeId, product.store.name]]);
      const [[summary], related] = await Promise.all([
        hydrateProducts([product], storeNames, params.userId),
        hydrateProducts(relatedRows, storeNames, params.userId),
      ]);

      return {
        ...summary!,
        description: product.description,
        unitDetail: product.unitDetail,
        images: product.images,
        badges: product.badges,
        shelfLife: product.shelfLife,
        storageInfo: product.storageInfo,
        ratingAvg: Number(product.ratingAvg),
        ratingCount: product.ratingCount,
        // "98% recommended" — zero reviews par null, 0% nahi, warna achha
        // product bura dikhne lagta hai
        recommendPercent:
          product.ratingCount > 0
            ? Math.round((product.recommendCount / product.ratingCount) * 100)
            : null,
        discountPercent: discountPercent(product.priceMinor, product.mrpMinor),
        relatedProducts: related,
      };
    },
  };
}

function distanceOrZero(
  store: { latitude: number; longitude: number },
  params: { latitude?: number; longitude?: number },
): number {
  if (params.latitude === undefined || params.longitude === undefined) return 0;
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(store.latitude - params.latitude);
  const dLon = toRad(store.longitude - params.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(toRad(params.latitude)) * Math.cos(toRad(store.latitude));
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type StoreService = ReturnType<typeof createStoreService>;
