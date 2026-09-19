import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, Store } from 'lucide-react-native';
import { formatMinor, formatTime, STATUS_LABEL, TRACKING_STEPS } from '@nearbux/core';
import type { OrderDetail, OrderStatus } from '@nearbux/types';
import { ApiClientError } from '@nearbux/api-client';
import {
  Button,
  Card,
  contentContainer,
  fontSize,
  fontWeight,
  radius,
  spacing,
  text,
  theme,
} from '@nearbux/ui';
import { CenteredSpinner } from '../../src/components/ScreenState';
import { api } from '../../src/lib/api';
import { keys, useOrder } from '../../src/lib/queries';

/** Screen [24] — Order Tracking */
export default function OrderTrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading } = useOrder(id ?? '');

  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !order) return <CenteredSpinner insetTop={insets.top} />;

  async function cancel() {
    if (Platform.OS === 'web' && !(globalThis.confirm?.('Cancel this order?') ?? false)) return;

    setError(null);
    setIsCancelling(true);
    try {
      await api.orders.cancel(order!.id, { reason: 'Changed my mind' });
      void qc.invalidateQueries({ queryKey: keys.order(order!.id) });
      void qc.invalidateQueries({ queryKey: ['orders'] });
    } catch (err) {
      // Store order accept karne ke baad cancellation window band ho jaati
      // hai. Server authority hai; client ka button sirf ek hint hai.
      setError(err instanceof ApiClientError ? err.message : 'Could not cancel this order.');
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
    >
      <View style={[contentContainer, styles.content, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
            <ChevronLeft size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Order Tracking</Text>
        </View>

        {order.status === 'CANCELLED' ? (
          <Card variant="muted">
            <Text style={styles.cancelledTitle}>Order cancelled</Text>
            {order.cancelReason && <Text style={text.muted}>{order.cancelReason}</Text>}
          </Card>
        ) : (
          <Card variant="muted">
            <Text style={[text.overline, styles.cardLabel]}>Order status</Text>
            <Timeline order={order} />
          </Card>
        )}

        <Card variant="muted">
          <View style={styles.storeRow}>
            <View style={styles.storeIcon}>
              <Store size={18} color={theme.textSecondary} />
            </View>
            <View style={styles.storeInfo}>
              <Text style={text.title} numberOfLines={2}>
                {order.storeName}
              </Text>
              {order.storeTagline && (
                <Text style={text.muted} numberOfLines={1}>
                  {order.storeTagline}
                </Text>
              )}
            </View>
            <Button
              label="Call Store"
              variant="outline"
              size="md"
              fullWidth={false}
              onPress={() => void Linking.openURL(`tel:${order.storePhone}`)}
            />
          </View>
        </Card>

        <Card variant="muted">
          <Text style={[text.overline, styles.cardLabel]}>
            Order items ({order.items.length})
          </Text>

          <View style={styles.itemList}>
            {order.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemQty}>{item.quantity}x</Text>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.itemPrice}>{formatMinor(item.lineTotalMinor)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          <View style={styles.billRow}>
            <Text style={text.muted}>Subtotal</Text>
            <Text style={text.muted}>{formatMinor(order.bill.itemTotalMinor)}</Text>
          </View>
          {order.bill.deliveryFeeMinor > 0 && (
            <View style={styles.billRow}>
              <Text style={text.muted}>Delivery Fee</Text>
              <Text style={text.muted}>{formatMinor(order.bill.deliveryFeeMinor)}</Text>
            </View>
          )}
          <View style={styles.billRow}>
            <Text style={text.muted}>Taxes & Charges</Text>
            <Text style={text.muted}>
              {formatMinor(order.bill.taxMinor + order.bill.platformFeeMinor)}
            </Text>
          </View>
          {order.bill.discountMinor > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.discountLabel}>
                {order.promotionCode ? `Discount (${order.promotionCode})` : 'Discount'}
              </Text>
              <Text style={styles.discountLabel}>-{formatMinor(order.bill.discountMinor)}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>{formatMinor(order.bill.totalMinor)}</Text>
          </View>
        </Card>

        {error && (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}

        {order.canCancel && (
          <Button
            label="Cancel Order"
            variant="destructive"
            onPress={cancel}
            loading={isCancelling}
          />
        )}
      </View>
    </ScrollView>
  );
}

/**
 * Status timeline (screen [24]).
 *
 * Steps CURRENT tak dikhte hain, plus ek pending next. Design mein PREPARING
 * par exactly yahi hai: Placed ✓, Accepted ✓, Preparing (current), Ready
 * (pending) — aur Out for Delivery / Delivered abhi nahi.
 *
 * Saare chhe steps hamesha dikhana card ko lamba kar deta hai un stages se
 * bhara hua jo abhi door hain; ek next step aage ka raasta bata deta hai
 * bina shor ke.
 */
function Timeline({ order }: { order: OrderDetail }) {
  const eventByStatus = new Map(order.timeline.map((e) => [e.status, e]));
  const currentIndex = TRACKING_STEPS.findIndex((s) => s === order.status);
  const visible: OrderStatus[] = TRACKING_STEPS.slice(0, Math.min(currentIndex + 2, TRACKING_STEPS.length));

  return (
    <View>
      {visible.map((step, index) => {
        const event = eventByStatus.get(step);
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isLast = index === visible.length - 1;

        return (
          <View key={step} style={styles.step}>
            <View style={styles.stepIndicator}>
              <View
                style={[
                  styles.dot,
                  isDone && styles.dotDone,
                  isCurrent && styles.dotCurrent,
                  !isDone && !isCurrent && styles.dotPending,
                ]}
              >
                {isDone && <Check size={12} color={theme.textInverse} strokeWidth={3} />}
                {isCurrent && <View style={styles.dotCurrentCore} />}
              </View>
              {!isLast && <View style={styles.line} />}
            </View>

            <View style={[styles.stepBody, isLast && styles.stepBodyLast]}>
              <Text style={[styles.stepLabel, !isDone && !isCurrent && styles.stepLabelPending]}>
                {STATUS_LABEL[step]}
              </Text>
              {event ? (
                isCurrent && order.currentStepNote ? (
                  <Text style={styles.stepNote}>{order.currentStepNote}</Text>
                ) : (
                  <Text style={text.muted}>{formatTime(new Date(event.occurredAt))}</Text>
                )
              ) : (
                <Text style={styles.stepPending}>Pending</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: theme.textPrimary },
  cardLabel: { marginBottom: spacing.lg },
  cancelledTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: theme.danger },

  step: { flexDirection: 'row', gap: spacing.md },
  stepIndicator: { alignItems: 'center', width: 22 },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: theme.success },
  dotCurrent: { backgroundColor: theme.primary },
  dotCurrentCore: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.surface },
  dotPending: { backgroundColor: theme.surface, borderWidth: 2, borderColor: theme.border },
  line: { flex: 1, width: 2, backgroundColor: theme.border, marginVertical: 3 },
  stepBody: { flex: 1, paddingBottom: spacing.xl, gap: 2 },
  stepBodyLast: { paddingBottom: 0 },
  stepLabel: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: theme.textPrimary },
  stepLabelPending: { color: theme.textDisabled, fontWeight: fontWeight.regular },
  stepNote: { fontSize: fontSize.base, color: theme.primary, fontWeight: fontWeight.medium },
  stepPending: { fontSize: fontSize.base, color: theme.textDisabled },

  storeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  storeIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeInfo: { flex: 1, gap: 2 },

  itemList: { gap: spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemQty: { fontSize: fontSize.base, color: theme.textPrimary, minWidth: 26 },
  itemName: { flex: 1, fontSize: fontSize.base, color: theme.textPrimary },
  itemPrice: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: theme.textPrimary },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: spacing.lg },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  discountLabel: { fontSize: fontSize.base, color: theme.primary },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: theme.textPrimary },
  totalValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: theme.textPrimary },
  error: { fontSize: fontSize.sm, color: theme.danger, textAlign: 'center' },
});
