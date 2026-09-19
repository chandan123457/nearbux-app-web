import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Clock,
  MapPin,
  Navigation,
  Search as SearchIcon,
  SlidersHorizontal,
} from 'lucide-react-native';
import { formatDistance, formatEta, formatMinor } from '@nearbux/core';
import type { ProductSort } from '@nearbux/types';
import {
  Avatar,
  Badge,
  Chip,
  EmptyState,
  FavoriteHeart,
  ImagePlaceholder,
  ProductCard,
  RatingPill,
  contentContainer,
  fontSize,
  fontWeight,
  radius,
  spacing,
  text,
  theme,
} from '@nearbux/ui';
import { CenteredSpinner } from '../../src/components/ScreenState';
import {
  useCartMutations,
  useFavoriteMutations,
  useStore,
  useStoreProducts,
} from '../../src/lib/queries';

type StoreTab = 'products' | 'reviews' | 'about';

const SORTS: Array<{ key: ProductSort; label: string }> = [
  { key: 'POPULARITY', label: 'Popularity' },
  { key: 'PRICE_LOW_HIGH', label: 'Price: Low to High' },
  { key: 'PRICE_HIGH_LOW', label: 'Price: High to Low' },
  { key: 'RATING', label: 'Rating' },
];

/**
 * Screens [18][19] — store panel.
 *
 * Yeh tabs ke BAHAR full screen hai: screenshots mein yahan bottom tab bar
 * nahi hai, aur nahi hona bhi chahiye — store ka apna navigation hai
 * (category chips, in-store search) aur uske neeche ek aur nav bar do
 * competing surfaces bana deta.
 */
export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const [tab, setTab] = useState<StoreTab>('products');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [sort, setSort] = useState<ProductSort>('POPULARITY');
  const [sortOpen, setSortOpen] = useState(false);
  const [inStoreQuery, setInStoreQuery] = useState('');

  const { data: store, isLoading } = useStore(slug ?? '');
  const { data: products, isFetching } = useStoreProducts(store?.id ?? '', categoryId, sort);
  const { addItem, setQuantity } = useCartMutations();
  const { toggleStore } = useFavoriteMutations();

  if (isLoading || !store) return <CenteredSpinner insetTop={insets.top} />;

  // In-store search client-side filter hai — store catalog chhota hota hai
  // (dozens, hazaaron nahi) aur har keystroke par server call bhejna yahan
  // dheema aur bekaar hai.
  const term = inStoreQuery.trim().toLowerCase();
  const visible = (products?.items ?? []).filter(
    (p) => term.length === 0 || p.name.toLowerCase().includes(term),
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
      stickyHeaderIndices={[]}
    >
      <View style={styles.hero}>
        <ImagePlaceholder uri={store.coverUrl} style={styles.cover} accessibilityLabel={store.name} />
        <View style={[styles.heroActions, { top: insets.top + spacing.md }]}>
          <Pressable onPress={() => router.back()} style={styles.circleButton} accessibilityLabel="Go back">
            <ChevronLeft size={22} color={theme.textPrimary} />
          </Pressable>
          <FavoriteHeart
            isFavorite={store.isFavorite}
            onToggle={() => toggleStore.mutate({ storeId: store.id, isFavorite: store.isFavorite })}
          />
        </View>
      </View>

      <View style={[contentContainer, styles.content]}>
        <View style={styles.infoCard}>
          <View style={styles.logoRow}>
            <Avatar name={store.name} imageUrl={store.logoUrl} size={52} ringed />
            <View style={styles.spacer} />
            <Badge
              label={store.isOpen ? 'Open Now' : (store.opensAtLabel ?? 'Closed')}
              tone={store.isOpen ? 'success' : 'neutral'}
            />
          </View>

          <Text style={styles.storeName}>{store.name}</Text>
          <Text style={text.muted}>{store.categories.join(' • ')}</Text>

          <View style={styles.metaRow}>
            <RatingPill rating={store.ratingAvg} variant="inline" count={store.ratingCount} />
            <Meta icon={<MapPin size={13} color={theme.textSecondary} />} label={formatDistance(store.distanceKm)} />
            <Meta
              icon={<Clock size={13} color={theme.textSecondary} />}
              label={formatEta(store.etaMinMinutes, store.etaMaxMinutes)}
            />
          </View>

          <View style={styles.addressRow}>
            <Navigation size={14} color={theme.textSecondary} />
            <Text style={text.muted} numberOfLines={2}>
              {store.addressLine}
            </Text>
          </View>
        </View>

        {/* Products | Reviews | About — screen [18] */}
        <View style={styles.tabBar}>
          {(['products', 'reviews', 'about'] as StoreTab[]).map((key) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
              style={[styles.tabButton, tab === key && styles.tabButtonActive]}
            >
              <Text style={[styles.tabLabel, tab === key && styles.tabLabelActive]}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'products' && (
          <>
            <View style={styles.searchField}>
              <SearchIcon size={17} color={theme.textSecondary} />
              <TextInput
                value={inStoreQuery}
                onChangeText={setInStoreQuery}
                placeholder={`Search in ${store.name}`}
                placeholderTextColor={theme.textSecondary}
                style={styles.searchInput}
                accessibilityLabel={`Search in ${store.name}`}
              />
            </View>

            <View style={styles.controlsRow}>
              <Pressable
                onPress={() => setSortOpen((v) => !v)}
                accessibilityRole="button"
                style={styles.control}
              >
                <Text style={styles.controlLabel}>
                  Sort by: {SORTS.find((s) => s.key === sort)?.label}
                </Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={styles.control}>
                <SlidersHorizontal size={15} color={theme.textPrimary} />
                <Text style={styles.controlLabel}>Filter</Text>
              </Pressable>
            </View>

            {sortOpen && (
              <View style={styles.sortSheet}>
                {SORTS.map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() => {
                      setSort(option.key);
                      setSortOpen(false);
                    }}
                    style={styles.sortOption}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sort === option.key }}
                  >
                    <Text style={[styles.sortLabel, sort === option.key && styles.sortLabelActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {store.sections.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Chip label="All" selected={categoryId === undefined} onPress={() => setCategoryId(undefined)} />
                {store.sections.map((section) => (
                  <Chip
                    key={section.id}
                    label={section.name}
                    selected={categoryId === section.id}
                    onPress={() => setCategoryId(section.id)}
                  />
                ))}
              </ScrollView>
            )}

            {isFetching && !products ? (
              <CenteredSpinner />
            ) : visible.length === 0 ? (
              <EmptyState
                title={term ? `No match for "${inStoreQuery}"` : 'Nothing here'}
                message={term ? 'Try another word.' : 'This section has no products right now.'}
              />
            ) : (
              <View style={styles.grid}>
                {visible.map((product) => (
                  <View key={product.id} style={styles.gridCell}>
                    <ProductCard
                      name={product.name}
                      unitLabel={product.unitLabel}
                      priceLabel={formatMinor(product.priceMinor)}
                      imageUrl={product.imageUrl}
                      isAvailable={product.isAvailable}
                      isFavorite={product.isFavorite}
                      cartQuantity={product.cartQuantity}
                      onChangeQuantity={(q) =>
                        product.cartQuantity === 0
                          ? addItem.mutate({ productId: product.id, quantity: q })
                          : setQuantity.mutate({ storeId: store.id, productId: product.id, quantity: q })
                      }
                      onPress={() => router.push(`/product/${product.id}`)}
                    />
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {tab === 'reviews' && (
          <EmptyState
            title={`${store.ratingCount} reviews`}
            message={`This store is rated ${store.ratingAvg.toFixed(1)} out of 5. Individual reviews are coming soon.`}
          />
        )}

        {tab === 'about' && (
          <View style={styles.about}>
            {store.description && <Text style={styles.aboutText}>{store.description}</Text>}
            <AboutRow label="Address" value={store.addressLine} />
            <AboutRow label="Phone" value={store.phone} />
            <AboutRow
              label="Delivery"
              value={
                store.deliveryFeeMinor > 0
                  ? `${formatMinor(store.deliveryFeeMinor)} · ${formatEta(store.etaMinMinutes, store.etaMaxMinutes)}`
                  : `Free · ${formatEta(store.etaMinMinutes, store.etaMaxMinutes)}`
              }
            />
            {store.minOrderMinor > 0 && (
              <AboutRow label="Minimum order" value={formatMinor(store.minOrderMinor)} />
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Meta({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.meta}>
      {icon}
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.aboutRow}>
      <Text style={text.muted}>{label}</Text>
      <Text style={styles.aboutValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  hero: { position: 'relative' },
  cover: { height: 200, borderRadius: 0 },
  heroActions: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circleButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: -spacing.xl },
  infoCard: { backgroundColor: theme.surface, borderRadius: 18, padding: spacing.lg, gap: spacing.sm },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  spacer: { flex: 1 },
  storeName: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: theme.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaLabel: { fontSize: fontSize.sm, color: theme.textSecondary },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.border },
  tabButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
  tabButtonActive: { borderBottomColor: theme.primary },
  tabLabel: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: theme.textSecondary },
  tabLabelActive: { color: theme.textPrimary, fontWeight: fontWeight.semibold },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: theme.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.base,
    color: theme.textPrimary,
    ...Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
  },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: theme.surfaceMuted,
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
  controlLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: theme.textPrimary },
  sortSheet: { backgroundColor: theme.surface, borderRadius: radius.md, overflow: 'hidden' },
  sortOption: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  sortLabel: { fontSize: fontSize.base, color: theme.textPrimary },
  sortLabelActive: { color: theme.primary, fontWeight: fontWeight.semibold },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridCell: { width: '47.5%', flexGrow: 1 },
  about: { gap: spacing.md },
  aboutText: { fontSize: fontSize.base, color: theme.textSecondary, lineHeight: 22 },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  aboutValue: { flex: 1, textAlign: 'right', fontSize: fontSize.base, color: theme.textPrimary },
});
