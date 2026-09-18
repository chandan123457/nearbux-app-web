import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, Phone, Store } from 'lucide-react-native';
import { formatEta, formatMinor, formatTime, STATUS_LABEL, TRACKING_STEPS } from '@nearbux/core';
import type { OrderDetail } from '@nearbux/types';
import {
  BillSummary,
  Button,
  Card,
  contentContainer,
  fontSize,
  fontWeight,
  spacing,
  text,
  theme,
} from '@nearbux/ui';
import { api } from '../../../src/lib/api';
import { CenteredSpinner } from '../index';
import { keys, useOrder } from '../../../src/lib/queries';

/** Screens [9][10][14] — success, tracking aur receipt */
export default function OrderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const { data: order, isLoading } = useOrder(id ?? '');
  const [isCancelling, setIsCancelling] = useState(false);

  if (isLoading || !order) return <CenteredSpinner insetTop={insets.top} />;

  const justPlaced = placed === '1' && order.status === 'PLACED';

  async function cancel() {
    const confirmed =
      Platform.OS === 'web'
        ? (globalThis.confirm?.('Cancel this order?') ?? false)
        : true;
    if (!confirmed) return;

    setIsCancelling(true);
    try {
      await api.orders.cancel(order!.id, { reason: 'Changed my mind' });
      void qc.invalidateQueries({ queryKey: keys.order(order!.id) });
      void qc.invalidateQueries({ queryKey: ['orders'] });
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
        {justPlaced ? (
          <View style={styles.success}>
            <View style={styles.successCircle}>
              <Check size={38} color={theme.textInverse} strokeWidth={3} />
            </View>
            <Text style={styles.successTitle}>Order placed!</Text>
            <Text style={styles.successMessage}>
              Your order from {order.storeName} has been confirmed
            </Text>
          </View>
        ) : (
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
              <ChevronLeft size={24} color={theme.textPrimary} />
            </Pressable>
            <Text style={[text.sectionLabel, styles.headerTitle]}>
              Order {order.orderNumber}
            </Text>
          </View>
        )}

        <Card variant="muted">
          <View style={styles.summaryRow}>
            <Text style={text.muted}>Order ID</Text>
            <Text style={styles.summaryValue}>{order.orderNumber}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={text.muted}>Estimated arrival</Text>
            <Text style={styles.summaryValue}>
              {formatEta(order.etaMinMinutes, order.etaMaxMinutes)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={text.muted}>Total paid</Text>
            <Text style={styles.summaryValue}>{formatMinor(order.bill.totalMinor)}</Text>
          </View>
        </Card>

        {order.status !== 'CANCELLED' && <Timeline order={order} />}

        {order.status === 'CANCELLED' && (
          <Card variant="muted">
            <Text style={styles.cancelledTitle}>Order cancelled</Text>
            {order.cancelReason && <Text style={text.muted}>{order.cancelReason}</Text>}
          </Card>
        )}

        <Card variant="muted">
          <View style={styles.storeRow}>
            <View style={styles.storeIcon}>
              <Store size={18} color={theme.textSecondary} />
            </View>
            <View style={styles.storeInfo}>
              <Text style={text.title} numberOfLines={1}>
                {order.storeName}
              </Text>
              {order.storeTagline && <Text style={text.muted}>{order.storeTagline}</Text>}
            </View>
            <Button
              label="Call Store"
              variant="outline"
              size="md"
              fullWidth={false}
              onPress={() => void Linking.openURL(`tel:${order.storePhone}`)}
              iconLeft={<Phone size={15} color={theme.primary} />}
            />
          </View>
        </Card>

        <Card variant="muted">
          <Text style={[text.overline, styles.itemsLabel]}>
            Order items ({order.items.length})
          </Text>
          <View style={styles.itemList}>
            {order.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemQty}>{item.quantity}×</Text>
                <View style={styles.itemBody}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={text.muted}>{item.unitLabel}</Text>
                </View>
                <Text style={styles.itemPrice}>{formatMinor(item.lineTotalMinor)}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card variant="muted">
          <BillSummary
            lines={[
              { label: 'Item Total', value: formatMinor(order.bill.itemTotalMinor) },
              ...(order.bill.deliveryFeeMinor > 0
                ? [{ label: 'Delivery Fee', value: formatMinor(order.bill.deliveryFeeMinor) }]
                : []),
              {
                label: 'Taxes & Platform Fee',
                value: formatMinor(order.bill.taxMinor + order.bill.platformFeeMinor),
              },
              ...(order.bill.discountMinor > 0
                ? [
                    {
                      label: order.promotionCode
                        ? `Discount (${order.promotionCode})`
                        : 'Discount',
                      value: `-${formatMinor(order.bill.discountMinor)}`,
                      highlight: true,
                    },
                  ]
                : []),
            ]}
            totalLabel="Total Paid"
            totalValue={formatMinor(order.bill.totalMinor)}
          />

          <View style={styles.metaFooter}>
            <Text style={text.muted}>Delivered to: {order.deliveryAddress}</Text>
            {order.payment?.displayLabel && (
              <Text style={text.muted}>Paid via {order.payment.displayLabel}</Text>
            )}
          </View>
        </Card>

        {justPlaced && (
          <Button label="Continue Shopping" variant="outline" onPress={() => router.replace('/')} />
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

/** Screen [10] ka status timeline */
function Timeline({ order }: { order: OrderDetail }) {
  const reached = new Map(order.timeline.map((e) => [e.status, e]));
  const currentIndex = TRACKING_STEPS.findIndex((s) => s === order.status);

  return (
    <Card variant="muted">
      <Text style={[text.overline, styles.itemsLabel]}>Order status</Text>
      {TRACKING_STEPS.map((step, index) => {
        const event = reached.get(step);
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;

        return (
          <View key={step} style={styles.step}>
            <View style={styles.stepIndicator}>
              <View
                style={[
                  styles.stepDot,
                  isDone && styles.stepDotDone,
                  isCurrent && styles.stepDotCurrent,
                  isPending && styles.stepDotPending,
                ]}
              >
                {isDone && <Check size={11} color={theme.textInverse} strokeWidth={3} />}
              </View>
              {index < TRACKING_STEPS.length - 1 && <View style={styles.stepLine} />}
            </View>

            <View style={styles.stepBody}>
              <Text style={[styles.stepLabel, isPending && styles.stepLabelPending]}>
                {STATUS_LABEL[step]}
              </Text>
              {event ? (
                <Text style={text.muted}>{formatTime(new Date(event.occurredAt))}</Text>
              ) : isCurrent && order.currentStepNote ? (
                <Text style={styles.stepNote}>{order.currentStepNote}</Text>
              ) : (
                <Text style={styles.stepPendingLabel}>Pending</Text>
              )}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerTitle: { flex: 1 },
  success: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing['2xl'] },
  successCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: theme.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: theme.textPrimary },
  successMessage: { fontSize: fontSize.base, color: theme.textSecondary, textAlign: 'center' },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryValue: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: theme.textPrimary },
  cancelledTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: theme.danger },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  storeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeInfo: { flex: 1, gap: 2 },
  itemsLabel: { marginBottom: spacing.md },
  itemList: { gap: spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemQty: { fontSize: fontSize.base, color: theme.textSecondary, minWidth: 26 },
  itemBody: { flex: 1, gap: 1 },
  itemName: { fontSize: fontSize.base, color: theme.textPrimary },
  itemPrice: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: theme.textPrimary },
  metaFooter: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: spacing.xs,
  },
  step: { flexDirection: 'row', gap: spacing.md },
  stepIndicator: { alignItems: 'center', width: 22 },
  stepDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepDotDone: { backgroundColor: theme.success },
  stepDotCurrent: { backgroundColor: theme.primary, borderWidth: 4, borderColor: theme.primarySubtle },
  stepDotPending: { backgroundColor: theme.surface, borderWidth: 2, borderColor: theme.border },
  stepLine: { flex: 1, width: 2, backgroundColor: theme.border, marginVertical: 2 },
  stepBody: { flex: 1, paddingBottom: spacing.lg, gap: 1 },
  stepLabel: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: theme.textPrimary },
  stepLabelPending: { color: theme.textDisabled, fontWeight: fontWeight.regular },
  stepNote: { fontSize: fontSize.sm, color: theme.primary, fontWeight: fontWeight.medium },
  stepPendingLabel: { fontSize: fontSize.sm, color: theme.textDisabled },
});
