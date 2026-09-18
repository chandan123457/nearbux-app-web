import type {
  AddressLabel,
  CancelledBy,
  NotificationType,
  OrderStatus,
  PaymentMethodType,
  PaymentStatus,
  PromotionScope,
  PromotionType,
} from './enums.js';
import type { BillBreakdown, Minor } from './money.js';

// ─────────────────────────── IDENTITY ───────────────────────────
export interface UserProfile {
  id: string;
  phone: string;
  email: string | null;
  fullName: string;
  avatarUrl: string | null;
  /** Avatar fallback: "Rahul Sharma" → "RS" (screen [12]) */
  initials: string;
}

export interface Address {
  id: string;
  label: AddressLabel;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  /** "Home — 123 MG Road, Apt 4B, Bengaluru" */
  formatted: string;
}

export interface SavedPaymentMethod {
  id: string;
  type: PaymentMethodType;
  /** "rahul@upi" — never a raw PAN/VPA credential */
  displayLabel: string;
  isDefault: boolean;
}

// ─────────────────────────── CATALOG ───────────────────────────
export interface StoreSummary {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  /** Server-computed from user coords — client kabhi distance calculate na kare */
  distanceKm: number;
  etaMinMinutes: number;
  etaMaxMinutes: number;
  deliveryFeeMinor: Minor;
  isOpen: boolean;
  /** Closed store ke liye: "Opens 9 AM" (screen [1]) */
  opensAtLabel: string | null;
  isFavorite: boolean;
  categories: string[];
}

export interface StoreDetail extends StoreSummary {
  description: string | null;
  phone: string;
  addressLine: string;
  minOrderMinor: Minor;
  sections: ProductSection[];
}

/** Store-scoped chips: Fruits & Veg, Dairy, Bakery, Pantry (screen [3]) */
export interface ProductSection {
  id: string;
  name: string;
  productCount: number;
}

export interface ProductSummary {
  id: string;
  storeId: string;
  storeName: string;
  name: string;
  unitLabel: string;
  imageUrl: string | null;
  priceMinor: Minor;
  mrpMinor: Minor | null;
  /** mrp se derive hota hai: 23% OFF (screen [6]) */
  discountPercent: number | null;
  isAvailable: boolean;
  isFavorite: boolean;
  /** Cart mein hai to stepper dikhta hai, warna "+" (screen [5]) */
  cartQuantity: number;
}

export interface ProductDetail extends ProductSummary {
  description: string | null;
  unitDetail: string | null;
  images: string[];
  badges: string[];
  shelfLife: string | null;
  storageInfo: string | null;
  ratingAvg: number;
  ratingCount: number;
  /** "98% recommended" (screen [6]) */
  recommendPercent: number | null;
  relatedProducts: ProductSummary[];
}

// ─────────────────────────── DISCOVERY ───────────────────────────
export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  ctaLabel: string;
  targetStoreId: string | null;
  isSponsored: boolean;
}

export interface Offer {
  id: string;
  code: string;
  title: string;
  description: string | null;
  scope: PromotionScope;
  type: PromotionType;
  storeId: string | null;
  storeName: string | null;
  storeTagline: string | null;
  storeInitials: string | null;
  minOrderMinor: Minor;
  /** "Valid till Today, 11 PM" (screen [1]) */
  validTillLabel: string;
  endsAt: string;
}

/** Screen [1] ka single payload — 4 alag calls se better */
export interface HomeFeed {
  deliverTo: Address | null;
  banners: Banner[];
  offers: Offer[];
  nearbyStores: StoreSummary[];
  unreadNotificationCount: number;
}

export interface SearchResults {
  query: string;
  recentSearches: string[];
  stores: StoreSummary[];
  products: ProductSummary[];
}

// ─────────────────────────── CART ───────────────────────────
export interface CartItem {
  id: string;
  productId: string;
  name: string;
  unitLabel: string;
  imageUrl: string | null;
  unitPriceMinor: Minor;
  quantity: number;
  lineTotalMinor: Minor;
  isAvailable: boolean;
}

export interface AppliedPromotion {
  id: string;
  code: string;
  /** "-₹200.00 off community voucher" (screen [7]) */
  label: string;
  discountMinor: Minor;
}

export interface Cart {
  id: string;
  storeId: string;
  storeName: string;
  etaMinMinutes: number;
  etaMaxMinutes: number;
  items: CartItem[];
  itemCount: number;
  promotion: AppliedPromotion | null;
  bill: BillBreakdown;
  /** Store ka minimum poora nahi hua to checkout block */
  meetsMinimumOrder: boolean;
  minOrderMinor: Minor;
}

// ─────────────────────────── ORDERS ───────────────────────────
export interface OrderItem {
  id: string;
  productId: string | null;
  name: string;
  unitLabel: string;
  imageUrl: string | null;
  unitPriceMinor: Minor;
  quantity: number;
  lineTotalMinor: Minor;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  note: string | null;
  occurredAt: string;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  storeId: string;
  storeName: string;
  storeTagline: string | null;
  status: OrderStatus;
  itemCount: number;
  /** "3 items · Avocados, Milk, Sourdough" (screen [11]) */
  itemPreview: string;
  totalMinor: Minor;
  placedAt: string;
  canTrack: boolean;
  canRate: boolean;
  hasRated: boolean;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
  bill: BillBreakdown;
  timeline: OrderStatusEvent[];
  /** Tracking screen ka "Estimated 10 mins" */
  currentStepNote: string | null;
  deliveryAddress: string;
  storePhone: string;
  etaMinMinutes: number;
  etaMaxMinutes: number;
  payment: {
    method: PaymentMethodType;
    status: PaymentStatus;
    displayLabel: string | null;
  } | null;
  promotionCode: string | null;
  cancelledBy: CancelledBy | null;
  cancelReason: string | null;
  canCancel: boolean;
}

// ─────────────────────────── NOTIFICATIONS ───────────────────────────
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  deepLink: string | null;
  isRead: boolean;
  createdAt: string;
  /** "10 min ago" / "Yesterday, 4:15 PM" */
  relativeLabel: string;
}

/** Screen [13] TODAY / EARLIER grouping */
export interface NotificationFeed {
  today: Notification[];
  earlier: Notification[];
  unreadCount: number;
}
