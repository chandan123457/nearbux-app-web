import {
  buildItemPreview,
  canCustomerCancel,
  canRate,
  formatEta,
  formatTime,
  isInProgress,
} from '@nearbux/core';
import type { OrderDetail, OrderSummary } from '@nearbux/types';

interface OrderRow {
  id: string;
  orderNumber: string;
  storeId: string;
  storeNameSnapshot: string;
  storePhoneSnapshot: string;
  status: OrderDetail['status'];
  itemTotalMinor: number;
  deliveryFeeMinor: number;
  taxMinor: number;
  platformFeeMinor: number;
  discountMinor: number;
  totalMinor: number;
  placedAt: Date;
  etaMinMinutes: number;
  etaMaxMinutes: number;
  deliveryAddressSnapshot: unknown;
  cancelledBy: OrderDetail['cancelledBy'];
  cancelReason: string | null;
}

export function toOrderSummary(
  order: OrderRow & {
    items: Array<{ nameSnapshot: string; quantity: number }>;
    review: { id: string } | null;
    store: { slug: string; tagline: string | null } | null;
  },
): OrderSummary {
  const hasRated = order.review !== null;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    storeId: order.storeId,
    storeName: order.storeNameSnapshot,
    storeTagline: order.store?.tagline ?? null,
    storeSlug: order.store?.slug ?? null,
    status: order.status,
    itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
    itemPreview: buildItemPreview(order.items.map((i) => i.nameSnapshot)),
    totalMinor: order.totalMinor,
    placedAt: order.placedAt.toISOString(),
    canTrack: isInProgress(order.status),
    canRate: canRate(order.status, hasRated),
    hasRated,
  };
}

export function toOrderDetail(
  order: OrderRow & {
    items: Array<{
      id: string;
      productId: string | null;
      nameSnapshot: string;
      unitSnapshot: string;
      imageSnapshot: string | null;
      unitPriceMinor: number;
      quantity: number;
      lineTotalMinor: number;
    }>;
    events: Array<{ status: OrderDetail['status']; note: string | null; occurredAt: Date }>;
    payment: {
      method: OrderDetail['payment'] extends null ? never : NonNullable<OrderDetail['payment']>['method'];
      status: NonNullable<OrderDetail['payment']>['status'];
      displayLabel: string | null;
    } | null;
    promotion: { code: string } | null;
    review: { id: string } | null;
    store: { slug: string; tagline: string | null } | null;
  },
): OrderDetail {
  const summary = toOrderSummary(order);
  const address = order.deliveryAddressSnapshot as { formatted?: string } | null;

  // Tracking screen ka "Estimated 10 mins" — sirf CURRENT step par
  const latest = order.events.at(-1);

  return {
    ...summary,
    items: order.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      name: i.nameSnapshot,
      unitLabel: i.unitSnapshot,
      imageUrl: i.imageSnapshot,
      unitPriceMinor: i.unitPriceMinor,
      quantity: i.quantity,
      lineTotalMinor: i.lineTotalMinor,
    })),
    bill: {
      itemTotalMinor: order.itemTotalMinor,
      deliveryFeeMinor: order.deliveryFeeMinor,
      taxMinor: order.taxMinor,
      platformFeeMinor: order.platformFeeMinor,
      discountMinor: order.discountMinor,
      totalMinor: order.totalMinor,
      currency: 'INR',
    },
    timeline: order.events.map((e) => ({
      status: e.status,
      note: e.note,
      occurredAt: e.occurredAt.toISOString(),
    })),
    currentStepNote: latest?.note ?? null,
    deliveryAddress: address?.formatted ?? '',
    storePhone: order.storePhoneSnapshot,
    etaMinMinutes: order.etaMinMinutes,
    etaMaxMinutes: order.etaMaxMinutes,
    payment: order.payment
      ? {
          method: order.payment.method,
          status: order.payment.status,
          displayLabel: order.payment.displayLabel,
        }
      : null,
    promotionCode: order.promotion?.code ?? null,
    cancelledBy: order.cancelledBy,
    cancelReason: order.cancelReason,
    canCancel: canCustomerCancel(order.status),
  };
}

/** "Arriving in 25-30 min" — screen [9] */
export function arrivalLabel(min: number, max: number): string {
  return `Arriving in ${formatEta(min, max)}`;
}

export { formatTime };
