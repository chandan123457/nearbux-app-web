import {
  discountPercent,
  formatDistance,
  formatEta,
  formatMinor,
  formatValidTill,
  getOpenState,
  initials,
  type StoreHourSlot,
} from '@nearbux/core';
import type { Offer, ProductSummary, StoreSummary } from '@nearbux/types';
import type { NearbyStoreRow } from './stores.repository.js';

/**
 * Prisma rows → API DTOs.
 *
 * Saari DISPLAY formatting yahan server par hoti hai — distance labels, ETA
 * strings, prices, open/closed state. Isse teeno platforms bilkul ek jaisa
 * dikhate hain, aur ek hi jagah badalne se sab jagah badal jaata hai.
 */

export interface StoreMapperContext {
  hoursByStore: Map<string, StoreHourSlot[]>;
  categoriesByStore: Map<string, string[]>;
  favoriteStoreIds: Set<string>;
  now?: Date;
}

export function toStoreSummary(row: NearbyStoreRow, ctx: StoreMapperContext): StoreSummary {
  const hours = ctx.hoursByStore.get(row.id) ?? [];
  const { isOpen, opensAtLabel } = getOpenState(hours, {
    now: ctx.now,
    isTemporarilyClosed: row.isTemporarilyClosed,
  });

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    logoUrl: row.logoUrl,
    coverUrl: row.coverUrl,
    ratingAvg: Number(row.ratingAvg),
    ratingCount: row.ratingCount,
    distanceKm: Number(row.distanceKm.toFixed(2)),
    etaMinMinutes: row.etaMinMinutes,
    etaMaxMinutes: row.etaMaxMinutes,
    deliveryFeeMinor: row.deliveryFeeMinor,
    isOpen,
    opensAtLabel,
    isFavorite: ctx.favoriteStoreIds.has(row.id),
    categories: ctx.categoriesByStore.get(row.id) ?? [],
  };
}

/** Client ke liye ready-made labels — parsing ka kaam client par na aaye */
export function storeDisplayLabels(store: StoreSummary) {
  return {
    distanceLabel: formatDistance(store.distanceKm),
    etaLabel: formatEta(store.etaMinMinutes, store.etaMaxMinutes),
    deliveryFeeLabel:
      store.deliveryFeeMinor > 0 ? `${formatMinor(store.deliveryFeeMinor)} Delivery` : null,
  };
}

export interface ProductRow {
  id: string;
  storeId: string;
  name: string;
  unitLabel: string;
  images: string[];
  priceMinor: number;
  mrpMinor: number | null;
  isAvailable: boolean;
}

export function toProductSummary(
  row: ProductRow,
  ctx: {
    storeName: string;
    favoriteProductIds: Set<string>;
    cartQuantities: Map<string, number>;
  },
): ProductSummary {
  return {
    id: row.id,
    storeId: row.storeId,
    storeName: ctx.storeName,
    name: row.name,
    unitLabel: row.unitLabel,
    imageUrl: row.images[0] ?? null,
    priceMinor: row.priceMinor,
    mrpMinor: row.mrpMinor,
    discountPercent: discountPercent(row.priceMinor, row.mrpMinor),
    isAvailable: row.isAvailable,
    isFavorite: ctx.favoriteProductIds.has(row.id),
    cartQuantity: ctx.cartQuantities.get(row.id) ?? 0,
  };
}

export function toOffer(
  promo: {
    id: string;
    code: string;
    title: string;
    description: string | null;
    scope: 'PLATFORM' | 'STORE';
    type: 'PERCENT_OFF' | 'FLAT_OFF' | 'FREE_DELIVERY';
    storeId: string | null;
    minOrderMinor: number;
    endsAt: Date;
    store: { name: string; tagline: string | null } | null;
  },
  now?: Date,
): Offer {
  return {
    id: promo.id,
    code: promo.code,
    title: promo.title,
    description: promo.description,
    scope: promo.scope,
    type: promo.type,
    storeId: promo.storeId,
    storeName: promo.store?.name ?? null,
    storeTagline: promo.store?.tagline ?? null,
    storeInitials: promo.store ? initials(promo.store.name) : null,
    minOrderMinor: promo.minOrderMinor,
    validTillLabel: formatValidTill(promo.endsAt, now),
    endsAt: promo.endsAt.toISOString(),
  };
}
