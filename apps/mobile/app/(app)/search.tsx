import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, History, SearchX } from 'lucide-react-native';
import { formatDistance, formatMinor } from '@nearbux/core';
import {
  Avatar,
  Chip,
  EmptyState,
  ProductCard,
  RatingPill,
  SearchBar,
  SectionHeader,
  contentContainer,
  fontSize,
  spacing,
  text,
  theme,
} from '@nearbux/ui';
import { CenteredSpinner } from './index';
import { useCartMutations, useRecentSearches, useSearch } from '../../src/lib/queries';

/** Screens [2][4] — search idle aur results */
export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');

  const { data: recent } = useRecentSearches();
  const { data, isFetching } = useSearch(submitted);
  const { addItem, setQuantity } = useCartMutations();

  const hasResults = submitted.length > 0 && data;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[contentContainer, styles.content, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.searchRow}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
            <ChevronLeft size={24} color={theme.textPrimary} />
          </Pressable>
          <View style={styles.searchField}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              onSubmit={() => setSubmitted(query.trim())}
              onClear={() => {
                setQuery('');
                setSubmitted('');
              }}
              autoFocus
            />
          </View>
        </View>

        {(recent?.recentSearches.length ?? 0) > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Recent searches" uppercase />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {recent!.recentSearches.map((term) => (
                <Chip
                  key={term}
                  label={term}
                  icon={<History size={13} color={theme.textSecondary} />}
                  onPress={() => {
                    setQuery(term);
                    setSubmitted(term);
                  }}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {isFetching && <CenteredSpinner />}

        {hasResults && data.stores.length === 0 && data.products.length === 0 && !isFetching && (
          <EmptyState
            icon={<SearchX size={40} color={theme.textDisabled} strokeWidth={1.5} />}
            title={`No results for "${submitted}"`}
            message="Try a different word, or browse stores near you."
          />
        )}

        {hasResults && data.stores.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Stores near you" />
            <View style={styles.storeList}>
              {data.stores.map((store) => (
                <Pressable
                  key={store.id}
                  onPress={() => router.push(`/store/${store.slug}`)}
                  style={styles.storeRow}
                  accessibilityRole="button"
                >
                  <Avatar name={store.name} imageUrl={store.logoUrl} size={44} />
                  <View style={styles.storeInfo}>
                    <Text style={text.title} numberOfLines={1}>
                      {store.name}
                    </Text>
                    <View style={styles.storeMeta}>
                      <Text style={text.muted}>{store.categories[0] ?? ''}</Text>
                      <Text style={text.muted}>•</Text>
                      <RatingPill rating={store.ratingAvg} variant="inline" />
                    </View>
                  </View>
                  <Text style={styles.distance}>{formatDistance(store.distanceKm)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {hasResults && data.products.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title={`Products matching "${submitted}"`} />
            <View style={styles.grid}>
              {data.products.map((product) => (
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
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  searchField: { flex: 1 },
  section: { gap: spacing.md },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  storeList: { gap: spacing.xs },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  storeInfo: { flex: 1, gap: 2 },
  storeMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  distance: { fontSize: fontSize.sm, color: theme.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  // Do columns — screens [4][5] jaisa
  gridCell: { width: '47.5%', flexGrow: 1 },
});
