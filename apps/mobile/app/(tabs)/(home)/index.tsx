import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, ChevronDown, Store } from 'lucide-react-native';
import { formatDistance, formatEta, formatMinor } from '@nearbux/core';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  SearchBar,
  SectionHeader,
  StoreCard,
  contentContainer,
  fontSize,
  fontWeight,
  radius,
  spacing,
  text,
  theme,
} from '@nearbux/ui';
import { CenteredSpinner } from '../../../src/components/ScreenState';
import { coordsFrom } from '../../../src/lib/location';
import { useFavoriteMutations, useHomeFeed } from '../../../src/lib/queries';

/** Screen [1] — Home */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch } = useHomeFeed();
  const { toggleStore } = useFavoriteMutations();

  const coords = useMemo(() => coordsFrom(data?.deliverTo), [data?.deliverTo]);

  if (isLoading) return <CenteredSpinner insetTop={insets.top} />;

  if (isError || !data) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <EmptyState
          title="Could not load your feed"
          message="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => void refetch()}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
      <View style={[contentContainer, styles.content, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.topRow}>
          <Pressable
            style={styles.addressBlock}
            accessibilityRole="button"
            accessibilityLabel="Change delivery address"
          >
            <Text style={text.overline}>Deliver to</Text>
            <View style={styles.addressRow}>
              <Text style={styles.addressText} numberOfLines={1}>
                {data.deliverTo ? labelOf(data.deliverTo.label) : 'Add address'}
              </Text>
              <ChevronDown size={16} color={theme.textPrimary} />
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel={`Notifications, ${data.unreadNotificationCount} unread`}
            style={styles.bell}
          >
            <Bell size={20} color={theme.textPrimary} />
            {data.unreadNotificationCount > 0 && <View style={styles.bellDot} />}
          </Pressable>
        </View>

        <SearchBar readOnly onPress={() => router.push('/search')} />

        {data.banners.map((banner) => (
          <Card key={banner.id} style={styles.banner}>
            {banner.isSponsored && <Badge label="SPONSORED" tone="neutral" />}
            <Text style={styles.bannerTitle}>{banner.title}</Text>
            {banner.subtitle && <Text style={styles.bannerSubtitle}>{banner.subtitle}</Text>}
            <Pressable
              onPress={() => banner.targetStoreId && router.push('/search')}
              style={styles.bannerCta}
              accessibilityRole="button"
            >
              <Text style={styles.bannerCtaLabel}>{banner.ctaLabel}</Text>
            </Pressable>
          </Card>
        ))}

        {data.offers.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Offers for you" uppercase />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.offerRow}>
              {data.offers.map((offer) => (
                <Card key={offer.id} variant="muted" style={styles.offerCard}>
                  <View style={styles.offerHeader}>
                    <Avatar name={offer.storeName ?? 'NearBux'} size={34} />
                    <View style={styles.offerStore}>
                      <Text style={text.title} numberOfLines={1}>
                        {offer.storeName ?? 'NearBux'}
                      </Text>
                      <Text style={text.muted} numberOfLines={1}>
                        {offer.storeTagline ?? 'All stores'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.offerTitle}>{offer.title}</Text>
                  {offer.description && (
                    <Text style={text.muted} numberOfLines={2}>
                      {offer.description}
                    </Text>
                  )}
                  <Text style={styles.offerValid}>{offer.validTillLabel}</Text>
                </Card>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader title="Stores near you" uppercase />
          {data.nearbyStores.length === 0 ? (
            <EmptyState
              icon={<Store size={40} color={theme.textDisabled} strokeWidth={1.5} />}
              title="No stores nearby"
              message="We could not find stores delivering to this address yet."
            />
          ) : (
            <View style={styles.storeList}>
              {data.nearbyStores.map((store) => (
                <StoreCard
                  key={store.id}
                  name={store.name}
                  tagline={store.tagline}
                  coverUrl={store.coverUrl}
                  logoUrl={store.logoUrl}
                  rating={store.ratingAvg}
                  distanceLabel={formatDistance(store.distanceKm)}
                  etaLabel={formatEta(store.etaMinMinutes, store.etaMaxMinutes)}
                  isOpen={store.isOpen}
                  opensAtLabel={store.opensAtLabel}
                  deliveryFeeLabel={
                    store.deliveryFeeMinor > 0
                      ? `${formatMinor(store.deliveryFeeMinor)} Delivery`
                      : null
                  }
                  isFavorite={store.isFavorite}
                  onToggleFavorite={() =>
                    toggleStore.mutate({ storeId: store.id, isFavorite: store.isFavorite })
                  }
                  onPress={() => router.push(`/store/${store.slug}`)}
                />
              ))}
            </View>
          )}
        </View>
      </View>
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

function labelOf(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase();
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  addressBlock: { flex: 1, gap: 2 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  addressText: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: theme.textPrimary },
  bell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.danger,
  },
  banner: { backgroundColor: theme.bannerSurface, gap: spacing.sm },
  bannerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: theme.textInverse },
  bannerSubtitle: { fontSize: fontSize.base, color: '#94A3B8', lineHeight: 21 },
  bannerCta: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    backgroundColor: theme.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  bannerCtaLabel: {
    color: theme.textInverse,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.base,
  },
  section: { gap: spacing.md },
  offerRow: { gap: spacing.md, paddingRight: spacing.lg },
  offerCard: { width: 280, gap: spacing.sm },
  offerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  offerStore: { flex: 1 },
  offerTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: theme.textPrimary },
  offerValid: { fontSize: fontSize.sm, color: theme.textSecondary, marginTop: spacing.xs },
  storeList: { gap: spacing.lg },
});
