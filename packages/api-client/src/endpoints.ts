import type {
  Address,
  Cart,
  SavedPaymentMethod,
  HomeFeed,
  NotificationFeed,
  OrderDetail,
  OrderSummary,
  Paginated,
  ProductDetail,
  ProductSummary,
  SearchResults,
  StoreDetail,
  StoreSummary,
  UserProfile,
} from '@nearbux/types';
import type {
  AddressInput,
  ApplyPromotionInput,
  CancelOrderInput,
  NearbyQuery,
  OrderListQuery,
  PlaceOrderInput,
  RequestOtpInput,
  StoreProductsQuery,
  UpdateProfileInput,
  VerifyOtpInput,
} from '@nearbux/validation';
import type { ApiClient, AuthTokens } from './client.js';

export interface VerifyOtpResult {
  tokens: AuthTokens;
  isNewUser: boolean;
}

/**
 * Typed endpoint wrappers.
 *
 * Input types @nearbux/validation ke Zod schemas se infer hote hain — wahi
 * schemas jo server request validate karne ke liye use karta hai. Client aur
 * server kabhi diverge nahi kar sakte: schema badla, dono taraf compile error.
 *
 */
export function createEndpoints(client: ApiClient) {
  return {
    auth: {
      requestOtp(input: RequestOtpInput) {
        return client.request<{ expiresInSeconds: number }>('/v1/auth/otp/request', {
          method: 'POST',
          body: input,
          skipAuth: true,
        });
      },

      async verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
        const result = await client.request<VerifyOtpResult>('/v1/auth/otp/verify', {
          method: 'POST',
          body: input,
          skipAuth: true,
        });
        // Tokens turant persist karo — caller ko yaad rakhne ki zaroorat nahi
        await client.setTokens(result.tokens);
        return result;
      },

      async logout(refreshToken: string): Promise<void> {
        try {
          await client.request<void>('/v1/auth/logout', {
            method: 'POST',
            body: { refreshToken },
            skipAuth: true,
          });
        } finally {
          // Server call fail bhi ho jaaye to local tokens clear hone hi chahiye,
          // warna user "signed in" dikhta rahega bina kisi valid session ke
          await client.clearTokens();
        }
      },

      async logoutAll(): Promise<void> {
        try {
          await client.request<void>('/v1/auth/logout-all', { method: 'POST' });
        } finally {
          await client.clearTokens();
        }
      },
    },

    me: {
      get() {
        return client.request<UserProfile>('/v1/me');
      },
      update(input: UpdateProfileInput) {
        return client.request<UserProfile>('/v1/me', { method: 'PATCH', body: input });
      },
      /** Screen [22] ka payment method card */
      paymentMethods() {
        return client.request<SavedPaymentMethod[]>('/v1/payment-methods');
      },
    },

    addresses: {
      list() {
        return client.request<Address[]>('/v1/addresses');
      },
      create(input: AddressInput) {
        return client.request<Address>('/v1/addresses', { method: 'POST', body: input });
      },
      update(id: string, input: Partial<AddressInput>) {
        return client.request<Address>(`/v1/addresses/${id}`, { method: 'PATCH', body: input });
      },
      remove(id: string) {
        return client.request<void>(`/v1/addresses/${id}`, { method: 'DELETE' });
      },
    },

    discovery: {
      /** Screen [1] — ek call mein banners, offers, stores, unread count */
      home(query: NearbyQuery) {
        return client.request<HomeFeed>('/v1/home', { query: { ...query } });
      },
      nearbyStores(query: NearbyQuery) {
        return client.request<StoreSummary[]>('/v1/stores', { query: { ...query } });
      },
      /** Screen [4] */
      search(query: NearbyQuery & { q: string }) {
        return client.request<SearchResults>('/v1/search', { query: { ...query } });
      },
      recentSearches() {
        return client.request<{ recentSearches: string[] }>('/v1/search/recent');
      },
      clearRecentSearches() {
        return client.request<void>('/v1/search/recent', { method: 'DELETE' });
      },
      /** Screen [3] */
      store(slug: string, coords?: { latitude: number; longitude: number }) {
        return client.request<StoreDetail>(`/v1/stores/${slug}`, {
          query: coords ? { ...coords } : undefined,
        });
      },
      /** Screens [3][5] */
      storeProducts(storeId: string, query: Partial<StoreProductsQuery> = {}) {
        return client.request<Paginated<ProductSummary>>(`/v1/stores/${storeId}/products`, {
          query: { ...query },
        });
      },
      /** Screen [6] */
      product(productId: string) {
        return client.request<ProductDetail>(`/v1/products/${productId}`);
      },
    },

    favorites: {
      addStore(storeId: string) {
        return client.request<void>(`/v1/favorites/stores/${storeId}`, { method: 'PUT' });
      },
      removeStore(storeId: string) {
        return client.request<void>(`/v1/favorites/stores/${storeId}`, { method: 'DELETE' });
      },
      addProduct(productId: string) {
        return client.request<void>(`/v1/favorites/products/${productId}`, { method: 'PUT' });
      },
      removeProduct(productId: string) {
        return client.request<void>(`/v1/favorites/products/${productId}`, { method: 'DELETE' });
      },
    },

    cart: {
      list() {
        return client.request<Cart[]>('/v1/carts');
      },
      /** Khaali cart null deta hai, 404 nahi — woh ek valid state hai */
      get(storeId: string) {
        return client.request<Cart | null>(`/v1/carts/${storeId}`);
      },
      addItem(input: { productId: string; quantity: number }) {
        return client.request<Cart>('/v1/cart/items', { method: 'POST', body: input });
      },
      /** quantity 0 = remove. Aakhri item hatane par cart null ho jaata hai. */
      setQuantity(storeId: string, productId: string, quantity: number) {
        return client.request<Cart | null>(`/v1/carts/${storeId}/items/${productId}`, {
          method: 'PATCH',
          body: { quantity },
        });
      },
      clear(storeId: string) {
        return client.request<void>(`/v1/carts/${storeId}`, { method: 'DELETE' });
      },
      applyPromotion(storeId: string, input: ApplyPromotionInput) {
        return client.request<Cart>(`/v1/carts/${storeId}/promotion`, {
          method: 'POST',
          body: input,
        });
      },
      removePromotion(storeId: string) {
        return client.request<Cart>(`/v1/carts/${storeId}/promotion`, { method: 'DELETE' });
      },
    },

    orders: {
      /** Screens [8][9]. idempotencyKey retry par duplicate order rokti hai. */
      place(input: PlaceOrderInput) {
        return client.request<OrderDetail>('/v1/orders', { method: 'POST', body: input });
      },
      /** Screen [11] */
      list(query: Partial<OrderListQuery> = {}) {
        return client.request<Paginated<OrderSummary>>('/v1/orders', { query: { ...query } });
      },
      /** Screens [10][14]. id UUID ya order number ("NB-4032") ho sakta hai. */
      get(id: string) {
        return client.request<OrderDetail>(`/v1/orders/${id}`);
      },
      cancel(id: string, input: CancelOrderInput) {
        return client.request<OrderDetail>(`/v1/orders/${id}/cancel`, {
          method: 'POST',
          body: input,
        });
      },
    },

    notifications: {
      /** Screen [13] — TODAY / EARLIER grouped */
      feed() {
        return client.request<NotificationFeed>('/v1/notifications');
      },
      markAllRead() {
        return client.request<void>('/v1/notifications/read-all', { method: 'POST' });
      },
      markRead(id: string) {
        return client.request<void>(`/v1/notifications/${id}/read`, { method: 'POST' });
      },
    },

    health: {
      check() {
        return client.request<{ status: string; uptimeSeconds: number }>('/v1/health', {
          skipAuth: true,
        });
      },
    },
  };
}

export type Endpoints = ReturnType<typeof createEndpoints>;
