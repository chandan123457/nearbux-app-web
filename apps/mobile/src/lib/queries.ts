import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Cart } from '@nearbux/types';
import { api } from './api';

/**
 * Query keys ek jagah.
 *
 * Inhe inline likhne par invalidation chupchaap fail hoti hai — ek jagah
 * 'cart' aur doosri jagah ['cart'] likha ja sakta hai, aur screen stale
 * data dikhati rehti hai bina kisi error ke.
 */
export const keys = {
  home: ['home'] as const,
  search: (q: string) => ['search', q] as const,
  recentSearches: ['search', 'recent'] as const,
  store: (slug: string) => ['store', slug] as const,
  storeProducts: (storeId: string, categoryId?: string, sort?: string) =>
    ['store', storeId, 'products', categoryId ?? 'all', sort ?? 'POPULARITY'] as const,
  product: (id: string) => ['product', id] as const,
  carts: ['carts'] as const,
  cart: (storeId: string) => ['cart', storeId] as const,
  orders: (filter: string) => ['orders', filter] as const,
  order: (id: string) => ['order', id] as const,
  notifications: ['notifications'] as const,
  addresses: ['addresses'] as const,
};

/**
 * Screen [1] — home feed.
 *
 * Coordinates client se nahi jaate: server user ke default address se woh
 * khud nikaalta hai. Pehle yahan ek hardcoded city centre bheja jaata tha
 * (asli address aane se pehle), jiski wajah se home feed pehle galat shehar
 * ke stores dikhata tha.
 */
export function useHomeFeed() {
  return useQuery({
    queryKey: keys.home,
    queryFn: () => api.discovery.home(),
  });
}

/**
 * Nearby stores, home feed se alag.
 *
 * Search screen idle state mein yahi list dikhati hai. Home feed ka poora
 * payload (banners, offers, address, unread count) laana yahan waste hai —
 * screen [16] sirf stores dikhati hai.
 */
export function useNearbyStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: () => api.discovery.nearbyStores(),
  });
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: keys.search(query),
    queryFn: () => api.discovery.search({ q: query }),
    // Khaali query par search mat karo — har keystroke par request bhejna
    // server aur battery dono kharab karta hai
    enabled: query.trim().length > 0,
  });
}

export function useRecentSearches() {
  return useQuery({
    queryKey: keys.recentSearches,
    // Guest ke liye server khaali list deta hai — ise block karne ki zaroorat
    // nahi, woh optionalAuth par hai
    queryFn: () => api.discovery.recentSearches(),
  });
}

export function useStore(slug: string) {
  return useQuery({
    queryKey: keys.store(slug),
    queryFn: () => api.discovery.store(slug),
    enabled: slug.length > 0,
  });
}

export function useStoreProducts(storeId: string, categoryId?: string, sort?: string) {
  return useQuery({
    queryKey: keys.storeProducts(storeId, categoryId, sort),
    queryFn: () =>
      api.discovery.storeProducts(storeId, {
        ...(categoryId ? { categoryId } : {}),
        ...(sort ? { sort: sort as 'POPULARITY' } : {}),
        limit: 40,
      }),
    enabled: storeId.length > 0,
  });
}

export function useProduct(productId: string) {
  return useQuery({
    queryKey: keys.product(productId),
    queryFn: () => api.discovery.product(productId),
    enabled: productId.length > 0,
  });
}

/**
 * Yahan koi `enabled` guard nahi hai.
 *
 * Pehle tha, kyunki app guest sessions par chalti thi aur in authenticated
 * queries ka boot par 401 lena aam tha. Ab onboarding gate ke baad hi ye
 * screens mount hoti hain (dekho app/_layout.tsx), isliye jab tak yeh hook
 * chalta hai tab tak ek valid session pakka hoti hai.
 */
export function useCarts() {
  return useQuery({ queryKey: keys.carts, queryFn: () => api.cart.list() });
}

export function useOrders(filter: string) {
  return useQuery({
    queryKey: keys.orders(filter),
    queryFn: () => api.orders.list({ filter: filter as 'ALL' }),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: keys.order(id),
    queryFn: () => api.orders.get(id),
    enabled: id.length > 0,
    // In-progress orders ko poll karo — screen [10] live status dikhata hai.
    // Server-sent events behtar hote, lekin polling pehle din ke liye theek
    // hai aur kaafi kam code hai.
    refetchInterval: (query) =>
      query.state.data && ['DELIVERED', 'CANCELLED'].includes(query.state.data.status)
        ? false
        : 20_000,
  });
}

export function useNotifications() {
  return useQuery({ queryKey: keys.notifications, queryFn: () => api.notifications.feed() });
}

export function useAddresses() {
  return useQuery({ queryKey: keys.addresses, queryFn: () => api.addresses.list() });
}

/**
 * Cart mutations.
 *
 * Har mutation cart AUR catalog queries invalidate karti hai, kyunki product
 * cards apni `cartQuantity` dikhate hain. Sirf cart invalidate karne par
 * stepper stale reh jaata hai aur user ko lagta hai tap kaam nahi kiya.
 */
export function useCartMutations() {
  const qc = useQueryClient();

  const invalidate = (storeId?: string) => {
    void qc.invalidateQueries({ queryKey: keys.carts });
    void qc.invalidateQueries({ queryKey: ['store'] });
    void qc.invalidateQueries({ queryKey: ['product'] });
    void qc.invalidateQueries({ queryKey: ['home'] });
    void qc.invalidateQueries({ queryKey: ['search'] });
    if (storeId) void qc.invalidateQueries({ queryKey: keys.cart(storeId) });
  };

  const addItem = useMutation({
    mutationFn: (input: { productId: string; quantity: number }) => api.cart.addItem(input),
    onSuccess: (cart) => invalidate(cart.storeId),
  });

  const setQuantity = useMutation({
    mutationFn: (input: { storeId: string; productId: string; quantity: number }) =>
      api.cart.setQuantity(input.storeId, input.productId, input.quantity),
    onSuccess: (_cart, vars) => invalidate(vars.storeId),
  });

  const clear = useMutation({
    mutationFn: (storeId: string) => api.cart.clear(storeId),
    onSuccess: (_r, storeId) => invalidate(storeId),
  });

  const applyPromotion = useMutation({
    mutationFn: (input: { storeId: string; code: string }) =>
      api.cart.applyPromotion(input.storeId, { code: input.code }),
    onSuccess: (cart) => invalidate(cart.storeId),
  });

  const removePromotion = useMutation({
    mutationFn: (storeId: string) => api.cart.removePromotion(storeId),
    onSuccess: (cart) => invalidate(cart.storeId),
  });

  return { addItem, setQuantity, clear, applyPromotion, removePromotion };
}

export function useFavoriteMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['home'] });
    void qc.invalidateQueries({ queryKey: ['store'] });
    void qc.invalidateQueries({ queryKey: ['product'] });
    void qc.invalidateQueries({ queryKey: ['search'] });
  };

  const toggleStore = useMutation({
    mutationFn: (input: { storeId: string; isFavorite: boolean }) =>
      input.isFavorite
        ? api.favorites.removeStore(input.storeId)
        : api.favorites.addStore(input.storeId),
    onSuccess: invalidate,
  });

  const toggleProduct = useMutation({
    mutationFn: (input: { productId: string; isFavorite: boolean }) =>
      input.isFavorite
        ? api.favorites.removeProduct(input.productId)
        : api.favorites.addProduct(input.productId),
    onSuccess: invalidate,
  });

  return { toggleStore, toggleProduct };
}

export type { Cart };
