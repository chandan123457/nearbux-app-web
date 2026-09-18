import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, ReceiptText, Star } from 'lucide-react-native';
import { formatMinor, formatOrderTimestamp, STATUS_LABEL } from '@nearbux/core';
import type { OrderFilter, OrderSummary } from '@nearbux/types';
import {
  Badge,
  Card,
  Chip,
  EmptyState,
  contentContainer,
  spacing,
  text,
  theme,
} from '@nearbux/ui';
import { CenteredSpinner } from './index';
import { useOrders } from '../../src/lib/queries';

const FILTERS: Array<{ key: OrderFilter; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

/** Screen [11] — My Orders */
export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<OrderFilter>('ALL');
  const { data, isLoading } = useOrders(filter);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
    >
      <View style={[contentContainer, styles.content, { paddingTop: insets.top + spacing.md }]}>
        <Text style={text.screenTitle}>My Orders</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              selected={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ScrollView>

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
          <View style={styles.list}>
            {data!.items.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onPress={() => router.push(`/order/${order.id}`)}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function OrderCard({ order, onPress }: { order: OrderSummary; onPress: () => void }) {
  const tone =
    order.status === 'DELIVERED' ? 'info' : order.status === 'CANCELLED' ? 'danger' : 'warning';

  return (
    <Card padded={false}>
      <Pressable onPress={onPress} accessibilityRole="button" style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitle}>
            <Text style={text.title} numberOfLines={1}>
              {order.storeName}
            </Text>
            <Text style={text.muted}>{formatOrderTimestamp(new Date(order.placedAt))}</Text>
          </View>
          <Badge
            label={order.status === 'DELIVERED' ? 'Completed' : STATUS_LABEL[order.status]}
            tone={tone}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.cardBody}>
          <Text style={text.muted} numberOfLines={1}>
            {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} · {order.itemPreview}
          </Text>
          <Text style={text.price}>{formatMinor(order.totalMinor)}</Text>
        </View>

        <View style={styles.cardFooter}>
          {order.canTrack ? (
            <View style={styles.action}>
              <Text style={text.link}>Track Order</Text>
              <ChevronRight size={16} color={theme.primary} />
            </View>
          ) : order.canRate ? (
            <View style={styles.action}>
              <Star size={15} color={theme.primary} />
              <Text style={text.link}>Rate Order</Text>
            </View>
          ) : (
            <View style={styles.action}>
              <Text style={text.link}>View Receipt</Text>
              <ChevronRight size={16} color={theme.primary} />
            </View>
          )}
        </View>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  filters: { gap: spacing.sm, paddingRight: spacing.lg },
  list: { gap: spacing.md },
  card: { padding: spacing.lg, gap: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  cardTitle: { flex: 1, gap: 2 },
  divider: { height: 1, backgroundColor: theme.border },
  cardBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end' },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
