import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, ReceiptText, Star, Store } from 'lucide-react-native';
import { formatMinor, formatOrderTimestamp, isInProgress } from '@nearbux/core';
import type { OrderFilter, OrderSummary } from '@nearbux/types';
import {
  Badge,
  Card,
  Chip,
  EmptyState,
  contentContainer,
  fontSize,
  fontWeight,
  radius,
  spacing,
  text,
  theme,
} from '@nearbux/ui';
import { CenteredSpinner } from '../../src/components/ScreenState';
import { useOrders } from '../../src/lib/queries';

const FILTERS: Array<{ key: OrderFilter; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

/** Screen [25] — My Orders */
export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<OrderFilter>('ALL');
  const { data, isLoading } = useOrders(filter);

  return (
    <View style={styles.root}>
      <View style={[contentContainer, styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>My Orders</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              selected={filter === f.key}
              // Filter tabs is screen ka primary control hain — brand blue,
              // store ki category chips wala almost-black nahi
              tone="primary"
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <View style={[contentContainer, styles.content]}>
          {isLoading ? (
            <CenteredSpinner />
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState
              icon={<ReceiptText size={40} color={theme.textDisabled} strokeWidth={1.5} />}
              title="No orders yet"
              message={
                filter === 'ALL'
                  ? 'Your orders will appear here once you place one.'
                  : 'Nothing in this category right now.'
              }
            />
          ) : (
            data!.items.map((order) => <OrderCard key={order.id} order={order} />)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function OrderCard({ order }: { order: OrderSummary }) {
  const router = useRouter();

  /**
   * List par COARSE status dikhta hai, exact nahi.
   *
   * Screen [25] "In Progress" dikhati hai, "Preparing" nahi — aur wahi label
   * filter tab par bhi hai, isliye badge aur filter ek dusre se match karte
   * hain. Exact step tracking screen [24] par hai, jahan user jaata hi tab
   * hai jab usse woh detail chahiye.
   */
  const statusLabel = isInProgress(order.status)
    ? 'In Progress'
    : order.status === 'CANCELLED'
      ? 'Cancelled'
      : 'Completed';
  const statusTone = isInProgress(order.status)
    ? 'warning'
    : order.status === 'CANCELLED'
      ? 'danger'
      : 'info';

  return (
    <Card variant="muted" bordered padded={false}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.storeIcon}>
            <Store size={18} color={theme.textSecondary} />
          </View>
          <View style={styles.cardTitle}>
            <Text style={text.title} numberOfLines={1}>
              {order.storeName}
            </Text>
            <Text style={text.muted}>{formatOrderTimestamp(new Date(order.placedAt))}</Text>
          </View>
          <Badge label={statusLabel} tone={statusTone} />
        </View>

        <View style={styles.divider} />

        <View style={styles.cardBody}>
          <Text style={styles.preview}>
            {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} · {order.itemPreview}
          </Text>
          <Text style={styles.total}>{formatMinor(order.totalMinor)}</Text>
        </View>

        {/*
          Primary action order ki state par depend karta hai. In-progress order
          ka ek hi kaam hai — track karna — isliye woh filled button hai.
          Delivered order par rating optional hai, isliye text link.
        */}
        {order.canTrack ? (
          <Pressable
            onPress={() => router.push(`/order/${order.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Track order from ${order.storeName}`}
            style={({ pressed }) => [styles.trackButton, pressed && styles.pressed]}
          >
            <Text style={styles.trackLabel}>Track Order</Text>
            <ChevronRight size={16} color={theme.textInverse} />
          </Pressable>
        ) : order.canRate ? (
          <Pressable
            onPress={() => router.push(`/order/${order.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Rate order from ${order.storeName}`}
            hitSlop={8}
            style={styles.rateRow}
          >
            <Star size={15} color={theme.primary} />
            <Text style={text.link}>Rate Order</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push(`/order/${order.id}`)}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.rateRow}
          >
            <Text style={text.link}>View Details</Text>
            <ChevronRight size={15} color={theme.primary} />
          </Pressable>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  header: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: { fontSize: fontSize['3xl'], fontWeight: fontWeight.bold, color: theme.textPrimary },
  filters: { gap: spacing.sm, paddingRight: spacing.lg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },

  card: { padding: spacing.lg, gap: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  storeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { flex: 1, gap: 2 },
  divider: { height: 1, backgroundColor: theme.border },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  preview: { flex: 1, fontSize: fontSize.base, color: theme.textSecondary, lineHeight: 21 },
  total: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: theme.textPrimary },

  trackButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: theme.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
  trackLabel: {
    color: theme.textInverse,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  pressed: { opacity: 0.85 },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
});
