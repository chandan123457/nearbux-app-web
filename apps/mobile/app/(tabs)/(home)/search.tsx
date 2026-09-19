import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, History, Search as SearchIcon, SearchX, X } from 'lucide-react-native';
import { formatDistance, formatMinor } from '@nearbux/core';
import type { StoreSummary } from '@nearbux/types';
import {
  Avatar,
  Chip,
  EmptyState,
  ProductCard,
  RatingPill,
  SectionHeader,
  contentContainer,
  fontSize,
  fontWeight,
  radius,
  spacing,
  text,
  theme,
} from '@nearbux/ui';
import { CenteredSpinner } from '../../../src/components/ScreenState';
import {
  useCartMutations,
  useNearbyStores,
  useRecentSearches,
  useSearch,
} from '../../../src/lib/queries';

/** Debounce — har keystroke par request bhejna server aur battery dono kharab karta hai */
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Screens [16][17] — search.
 *
 * Do states ek hi screen par:
 *   idle  → recent searches + nearby stores ki list
 *   query → matching stores + "Products matching …" grid
 *
 * Nearby stores idle state mein isliye dikhti hain ki khaali search screen
 * dead-end hoti hai. User yahan "kuch dhoondhne" aata hai; agar usse pata
 * nahi ki kya type kare, to browse karne ka raasta dikhna chahiye.
 */
export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  const { data: recent } = useRecentSearches();
  const { data: nearby, isLoading: nearbyLoading } = useNearbyStores();
  const { data: results, isFetching } = useSearch(debounced);
  const { addItem, setQuantity } = useCartMutations();

  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(() => setDebounced(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const isSearching = debounced.length > 0;
  const showNoResults =
    isSearching && !isFetching && results && results.stores.length === 0 && results.products.length === 0;

  // Search karte waqt matching stores dikhao; idle par nearby
  const storeList: StoreSummary[] = isSearching ? (results?.stores ?? []) : (nearby ?? []);

  return (
    <View style={styles.root}>
      <View style={[contentContainer, styles.header, { paddingTop: insets.top + spacing.md }]}>
        {isSearching && (
          <Pressable
            onPress={() => {
              setQuery('');
              setDebounced('');
              inputRef.current?.focus();
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <ChevronLeft size={24} color={theme.textPrimary} />
          </Pressable>
        )}

        <View style={styles.field}>
          <SearchIcon size={18} color={theme.textSecondary} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search stores or products"
            placeholderTextColor={theme.textSecondary}
            style={styles.input}
            autoFocus
            returnKeyType="search"
            accessibilityLabel="Search stores or products"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear text">
              <X size={18} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Text style={text.link}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={[contentContainer, styles.content]}>
          {(recent?.recentSearches.length ?? 0) > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Recent searches" uppercase />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                {recent!.recentSearches.map((term) => (
                  <Chip
                    key={term}
                    label={term}
                    icon={<History size={13} color={theme.textSecondary} />}
                    onPress={() => {
                      setQuery(term);
                      setDebounced(term);
                    }}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.section}>
            <SectionHeader
              title="Stores Near You"
              actionLabel={isSearching ? undefined : 'See all'}
              onAction={isSearching ? undefined : () => router.back()}
            />

            {nearbyLoading && !isSearching ? (
              <CenteredSpinner />
            ) : storeList.length === 0 && !isFetching ? (
              <Text style={[text.muted, styles.noStores]}>No stores found.</Text>
            ) : (
              <View>
                {storeList.map((store, index) => (
                  <StoreRow
                    key={store.id}
                    store={store}
                    isLast={index === storeList.length - 1}
                    onPress={() => router.push(`/store/${store.slug}`)}
                  />
                ))}
              </View>
            )}
          </View>

          {isSearching && (
            <View style={styles.section}>
              {isFetching && !results ? (
                <CenteredSpinner />
              ) : showNoResults ? (
                <EmptyState
                  icon={<SearchX size={40} color={theme.textDisabled} strokeWidth={1.5} />}
                  title={`No results for "${debounced}"`}
                  message="Try a different word, or browse the stores above."
                />
              ) : (results?.products.length ?? 0) > 0 ? (
                <>
                  <Text style={styles.matchingTitle}>Products matching "{debounced}"</Text>
                  <View style={styles.grid}>
                    {results!.products.map((product) => (
                      <View key={product.id} style={styles.gridCell}>
                        <ProductCard
                          name={product.name}
                          unitLabel={product.unitLabel}
                          priceLabel={formatMinor(product.priceMinor)}
                          imageUrl={product.imageUrl}
                          storeName={product.storeName}
                          isAvailable={product.isAvailable}
                          isFavorite={product.isFavorite}
                          cartQuantity={product.cartQuantity}
                          onChangeQuantity={(q) =>
                            product.cartQuantity === 0
                              ? addItem.mutate({ productId: product.id, quantity: q })
                              : setQuantity.mutate({
                                  storeId: product.storeId,
                                  productId: product.id,
                                  quantity: q,
                                })
                          }
                          onPress={() => router.push(`/product/${product.id}`)}
                        />
                      </View>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          )}

          {/* Type karte waqt purane results dikhte rehte hain — screen khaali
              karne se layout kood-ta hai aur search dheema lagta hai */}
          {isFetching && results && (
            <View style={styles.inlineSpinner}>
              <ActivityIndicator color={theme.primary} />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** Screens [16][17] ka list row — home ke cards se alag, compact */
function StoreRow({
  store,
  isLast,
  onPress,
}: {
  store: StoreSummary;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${store.name}, ${store.categories[0] ?? ''}, ${formatDistance(store.distanceKm)}`}
      style={({ pressed }) => [styles.storeRow, !isLast && styles.storeDivider, pressed && styles.pressed]}
    >
      <Avatar name={store.name} imageUrl={store.logoUrl} size={44} />
      <View style={styles.storeInfo}>
        <Text style={text.title} numberOfLines={1}>
          {store.name}
        </Text>
        <View style={styles.storeMeta}>
          <Text style={text.muted} numberOfLines={1}>
            {store.categories[0] ?? ''}
          </Text>
          <Text style={text.muted}>•</Text>
          <RatingPill rating={store.ratingAvg} variant="inline" />
        </View>
      </View>
      <Text style={styles.distance}>{formatDistance(store.distanceKm)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: theme.surface,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: theme.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 42,
  },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    color: theme.textPrimary,
    ...Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
  },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl, paddingTop: spacing.lg },
  section: { gap: spacing.md },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  storeDivider: { borderBottomWidth: 1, borderBottomColor: theme.border },
  storeInfo: { flex: 1, gap: 2 },
  storeMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  distance: { fontSize: fontSize.sm, color: theme.textSecondary },
  pressed: { opacity: 0.6 },
  noStores: { paddingVertical: spacing.lg },
  matchingTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: theme.textPrimary,
    marginBottom: spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridCell: { width: '47.5%', flexGrow: 1 },
  inlineSpinner: { paddingVertical: spacing.lg, alignItems: 'center' },
});
