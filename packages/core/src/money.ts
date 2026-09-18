import type { Minor } from '@nearbux/types';

/** ₹ ke saath format: 123145 → "₹1,231.45" */
export function formatMinor(minor: Minor, opts?: { withSymbol?: boolean }): string {
  const withSymbol = opts?.withSymbol ?? true;
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const rupees = Math.trunc(abs / 100);
  const paise = abs % 100;
  // Indian grouping: 12,34,567 (NOT 1,234,567)
  const grouped = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(rupees);
  const body = `${grouped}.${String(paise).padStart(2, '0')}`;
  return `${negative ? '-' : ''}${withSymbol ? '₹' : ''}${body}`;
}

/** Discount lines ke liye: "-₹200.00" */
export function formatDiscount(minor: Minor): string {
  return formatMinor(-Math.abs(minor));
}

export function rupeesToMinor(rupees: number): Minor {
  return Math.round(rupees * 100);
}

/**
 * Percentage of a minor amount, half-up rounded.
 * Kabhi bhi floating-point result aage mat le jaana — hamesha integer return.
 */
export function percentOfMinor(minor: Minor, basisPoints: number): Minor {
  return Math.round((minor * basisPoints) / 10_000);
}

/** MRP strikethrough se "23% OFF" badge (screen [6]) */
export function discountPercent(priceMinor: Minor, mrpMinor: Minor | null): number | null {
  if (mrpMinor === null || mrpMinor <= priceMinor || mrpMinor <= 0) return null;
  return Math.round(((mrpMinor - priceMinor) / mrpMinor) * 100);
}
