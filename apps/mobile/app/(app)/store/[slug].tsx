import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Clock, MapPin, Navigation } from 'lucide-react-native';
import { formatDistance, formatEta, formatMinor } from '@nearbux/core';
import {
  Avatar,
  Badge,
  Chip,
  EmptyState,
  ImagePlaceholder,
  ProductCard,
  RatingPill,
  contentContainer,
  fontSize,
  fontWeight,
  spacing,
  text,
  theme,
} from '@nearbux/ui';
import { FavoriteHeart } from '@nearbux/ui';
import { CenteredSpinner } from '../index';
import {
  useCartMutations,
  useFavoriteMutations,
  useStore,
  useStoreProducts,
} from '../../../src/lib/queries';

/** Screens [3][5] — store detail aur catalog */
export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [categoryId, setCategoryId] = useState<string | undefined>();

  const { data: store, isLoading } = useStore(slug ?? '');
  const { data: products, isFetching } = useStoreProducts(store?.id ?? '', categoryId);
  const { addItem, setQuantity } = useCartMutations();
  const { toggleStore } = useFavoriteMutations();

  if (isLoading || !store) return <CenteredSpinner insetTop={insets.top} />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
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
        <View style={styles.headerCard}>
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
        ) : (products?.items.length ?? 0) === 0 ? (
          <EmptyState title="Nothing here" message="This section has no products right now." />
        ) : (
          <View style={styles.grid}>
            {products!.items.map((product) => (
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
  headerCard: {
    backgroundColor: theme.surface,
    borderRadius: 18,
    padding: spacing.lg,
    gap: spacing.sm,
  },
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
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridCell: { width: '47.5%', flexGrow: 1 },
});
