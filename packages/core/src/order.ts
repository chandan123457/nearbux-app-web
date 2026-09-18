import type { OrderFilter, OrderStatus } from '@nearbux/types';
import { COMMERCE } from './config.js';

/** Forward-only lifecycle. CANCELLED sirf shuruaati stages se reachable hai. */
const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

/** Server ise har status write se pehle check karta hai — illegal jump block */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT_STATUS[from].includes(to);
}

/** Tracking screen [10] ke steps. CANCELLED order timeline nahi dikhata. */
export const TRACKING_STEPS: OrderStatus[] = [
  'PLACED',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: 'Order Placed',
  ACCEPTED: 'Order Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** "In Progress" badge ke liye */
export function isInProgress(status: OrderStatus): boolean {
  return status !== 'DELIVERED' && status !== 'CANCELLED';
}

export function canCustomerCancel(status: OrderStatus): boolean {
  return (COMMERCE.CANCELLABLE_STATUSES as readonly string[]).includes(status);
}

export function canRate(status: OrderStatus, hasRated: boolean): boolean {
  return status === 'DELIVERED' && !hasRated;
}

/** My Orders filter tabs → status list */
export function statusesForFilter(filter: OrderFilter): OrderStatus[] | null {
  switch (filter) {
    case 'ALL':
      return null; // koi filter nahi
    case 'IN_PROGRESS':
      return ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];
    case 'DELIVERED':
      return ['DELIVERED'];
    case 'CANCELLED':
      return ['CANCELLED'];
  }
}

/** "3 items · Avocados, Milk, Sourdough" (screen [11]) */
export function buildItemPreview(names: string[], maxNames = 3): string {
  const shown = names.slice(0, maxNames);
  const remaining = names.length - shown.length;
  const head = shown.join(', ');
  return remaining > 0 ? `${head} +${remaining} more` : head;
}

/** "NB-4032" — human-readable, sequence se generate hota hai (guessable nahi honi chahiye to random suffix add karo) */
export function formatOrderNumber(sequence: number): string {
  return `NB-${String(sequence).padStart(4, '0')}`;
}
