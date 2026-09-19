import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  MapPin,
  ShoppingCart,
  Star,
  Store,
} from 'lucide-react-native';
import { formatMinor, formatTime, isInProgress, STATUS_LABEL, TRACKING_STEPS } from '@nearbux/core';
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

/**
 * Screens [24] aur [28] — ek order, do presentations.
 *
 * Active order ka sawaal hai "kahan hai": timeline, Call Store, Cancel.
 * Finished order ka sawaal hai "kya charge hua": receipt, Rate, Help.
 *
 * Do alag routes banane par har call site ko status dekh kar decide karna
 * padta ki kahan bhejein — aur woh har nayi jagah par galat ho sakta hai.
 * Ek route jo apni state ke hisaab se render kare, wahi sahi hai.
 */
export default function OrderScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading } = useOrder(id ?? '');

  if (isLoading || !order) return <CenteredSpinner insetTop={insets.top} />;

  return isInProgress(order.status) ? (
    <TrackingView order={order} insetTop={insets.top} insetBottom={insets.bottom} />
  ) : (
    <ReceiptView order={order} insetTop={insets.top} insetBottom={insets.bottom} />
  );
}

// ────────────────────────────── [24] TRACKING ──────────────────────────────

function TrackingView({
  order,
  insetTop,
  insetBottom,
}: {
  order: OrderDetail;
  insetTop: number;
  insetBottom: number;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (Platform.OS === 'web' && !(globalThis.confirm?.('Cancel this order?') ?? false)) return;

    setError(null);
    setIsCancelling(true);
    try {
      await api.orders.cancel(order.id, { reason: 'Changed my mind' });
      void qc.invalidateQueries({ queryKey: keys.order(order.id) });
      void qc.invalidateQueries({ queryKey: ['orders'] });
    } catch (err) {
      // Store accept karne ke baad window band ho jaati hai. Server authority
      // hai; client ka button sirf ek hint hai.
      setError(err instanceof ApiClientError ? err.message : 'Could not cancel this order.');
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insetBottom + spacing.xl }}
    >
      <View style={[contentContainer, styles.content, { paddingTop: insetTop + spacing.md }]}>
        <Header title="Order Tracking" onBack={() => router.back()} />

        <Card variant="muted">
          <Text style={[text.overline, styles.cardLabel]}>Order status</Text>
          <Timeline order={order} />
        </Card>

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
          <Text style={[text.overline, styles.cardLabel]}>Order items ({order.items.length})</Text>
          <View style={styles.compactList}>
            {order.items.map((item) => (
              <View key={item.id} style={styles.compactRow}>
                <Text style={styles.compactQty}>{item.quantity}x</Text>
                <Text style={styles.compactName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.compactPrice}>{formatMinor(item.lineTotalMinor)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />
          <BillRow label="Subtotal" value={formatMinor(order.bill.itemTotalMinor)} muted />
          {order.bill.deliveryFeeMinor > 0 && (
            <BillRow label="Delivery Fee" value={formatMinor(order.bill.deliveryFeeMinor)} muted />
          )}
          <BillRow
            label="Taxes & Charges"
            value={formatMinor(order.bill.taxMinor + order.bill.platformFeeMinor)}
            muted
          />
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
          <Button label="Cancel Order" variant="destructive" onPress={cancel} loading={isCancelling} />
        )}
      </View>
    </ScrollView>
  );
}

/**
 * Timeline current step tak dikhta hai, plus ek pending next.
 *
 * PREPARING par yeh exactly design jaisa hai — Placed, Accepted, Preparing,
 * Ready — aur har dusre status par bhi sensibly degrade hota hai. Saare chhe
 * hamesha dikhane se card un stages se bhar jaata hai jo ghanton door hain.
 */
function Timeline({ order }: { order: OrderDetail }) {
  const eventByStatus = new Map(order.timeline.map((e) => [e.status, e]));
  const currentIndex = TRACKING_STEPS.findIndex((s) => s === order.status);
  const visible: OrderStatus[] = TRACKING_STEPS.slice(
    0,
    Math.min(currentIndex + 2, TRACKING_STEPS.length),
  );

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

// ────────────────────────────── [28] RECEIPT ──────────────────────────────

function ReceiptView({
  order,
  insetTop,
  insetBottom,
}: {
  order: OrderDetail;
  insetTop: number;
  insetBottom: number;
}) {
  const router = useRouter();
  const wasCancelled = order.status === 'CANCELLED';

  /**
   * "Help" us channel par le jaata hai jo humare paas ASAL mein hai — store ka
   * phone. Ek support screen jo exist nahi karti, uska link dena ek dead tap
   * hai, aur order ke baare mein sawaal store hi answer kar sakta hai.
   */
  function openHelp() {
    const callStore = () => void Linking.openURL(`tel:${order.storePhone}`);

    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`Call ${order.storeName} about this order?`)) callStore();
      return;
    }
    Alert.alert('Need help?', `Call ${order.storeName} about order ${order.orderNumber}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call store', onPress: callStore },
    ]);
  }

  return (
    <View style={styles.root}>
      <View style={[contentContainer, styles.receiptHeader, { paddingTop: insetTop + spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
          <ChevronLeft size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Order #{order.orderNumber}</Text>
        <Pressable onPress={openHelp} hitSlop={8} accessibilityRole="button">
          <Text style={text.link}>Help</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insetBottom + spacing.xl }}>
        <View style={[contentContainer, styles.content, styles.receiptContent]}>
          <Card variant="muted" padded={false}>
            <Pressable
              onPress={() => order.storeSlug && router.push(`/store/${order.storeSlug}`)}
              disabled={!order.storeSlug}
              accessibilityRole={order.storeSlug ? 'button' : undefined}
              accessibilityLabel={`Visit ${order.storeName}`}
              style={({ pressed }) => [styles.storeLink, pressed && styles.pressed]}
            >
              <View style={styles.storeTile}>
                <ShoppingCart size={18} color={theme.textSecondary} />
              </View>
              <View style={styles.storeInfo}>
                <Text style={text.title} numberOfLines={1}>
                  {order.storeName}
                </Text>
                {order.storeTagline && (
                  <Text style={text.muted} numberOfLines={1}>
                    {order.storeTagline}
                  </Text>
                )}
              </View>
              {order.storeSlug && <ChevronRight size={18} color={theme.textDisabled} />}
            </Pressable>
          </Card>

          <Card variant="muted">
            <View style={styles.itemsHeader}>
              <Text style={text.overline}>Order items ({order.items.length})</Text>
              <Text style={styles.itemized}>Itemized</Text>
            </View>

            {order.items.map((item, index) => (
              <View
                key={item.id}
                style={[styles.itemRow, index < order.items.length - 1 && styles.itemDivider]}
              >
                <View style={styles.itemBody}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>{formatMinor(item.lineTotalMinor)}</Text>
              </View>
            ))}
          </Card>

          <Card variant="muted">
            <Text style={[text.overline, styles.cardLabel]}>Bill summary</Text>

            <BillRow label="Item Total" value={formatMinor(order.bill.itemTotalMinor)} muted />
            {order.bill.deliveryFeeMinor > 0 && (
              <BillRow label="Delivery Fee" value={formatMinor(order.bill.deliveryFeeMinor)} muted />
            )}
            <BillRow
              label="Taxes & Platform Fee"
              value={formatMinor(order.bill.taxMinor + order.bill.platformFeeMinor)}
              muted
            />
            {order.bill.discountMinor > 0 && (
              <BillRow
                label={order.promotionCode ? `Discount (${order.promotionCode})` : 'Store Discount'}
                value={`-${formatMinor(order.bill.discountMinor)}`}
                muted
              />
            )}

            <View style={styles.dashedDivider} />

            <View style={styles.totalRow}>
              <Text style={styles.paidLabel}>{wasCancelled ? 'Order Total' : 'Total Paid'}</Text>
              <Text style={styles.paidValue}>{formatMinor(order.bill.totalMinor)}</Text>
            </View>
          </Card>

          <Card variant="muted">
            <View style={styles.metaRow}>
              <MapPin size={16} color={theme.textSecondary} />
              <Text style={styles.metaText}>
                <Text style={text.muted}>Delivered to: </Text>
                {order.deliveryAddress}
              </Text>
            </View>
            {order.payment?.displayLabel && (
              <>
                <View style={styles.divider} />
                <View style={styles.metaRow}>
                  <CreditCard size={16} color={theme.textSecondary} />
                  <Text style={styles.metaText}>
                    <Text style={text.muted}>Paid via: </Text>
                    {order.payment.displayLabel}
                  </Text>
                </View>
              </>
            )}
          </Card>

          {wasCancelled && order.cancelReason && (
            <Card variant="muted">
              <Text style={styles.cancelledTitle}>Order cancelled</Text>
              <Text style={text.muted}>{order.cancelReason}</Text>
            </Card>
          )}

          {order.canRate && (
            <Button
              label="Rate this Order"
              variant="outline"
              onPress={() => {}}
              iconLeft={<Star size={17} color={theme.primary} />}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ────────────────────────────── shared ──────────────────────────────

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Go back">
        <ChevronLeft size={24} color={theme.textPrimary} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function BillRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.billRow}>
      <Text style={muted ? text.muted : styles.itemName}>{label}</Text>
      <Text style={muted ? text.muted : styles.itemName}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  receiptContent: { paddingTop: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: theme.textPrimary },
  cardLabel: { marginBottom: spacing.lg },
  pressed: { opacity: 0.7 },

  // Timeline
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

  // Store
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  storeLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  storeIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeTile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeInfo: { flex: 1, gap: 2 },

  // Items — receipt
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  itemized: { fontSize: fontSize.sm, color: theme.textSecondary },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  itemDivider: { borderBottomWidth: 1, borderBottomColor: theme.border },
  itemBody: { flex: 1, gap: 2 },
  itemName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: theme.textPrimary },
  itemQty: { fontSize: fontSize.sm, color: theme.textSecondary },
  itemPrice: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: theme.textPrimary },

  // Items — tracking (compact)
  compactList: { gap: spacing.md },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  compactQty: { fontSize: fontSize.base, color: theme.textPrimary, minWidth: 26 },
  compactName: { flex: 1, fontSize: fontSize.base, color: theme.textPrimary },
  compactPrice: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: theme.textPrimary },

  // Bill
  billRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: spacing.md },
  dashedDivider: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.border,
    marginVertical: spacing.lg,
  },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: theme.textPrimary },
  totalValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: theme.textPrimary },
  paidLabel: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: theme.textPrimary },
  paidValue: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: theme.textPrimary },

  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  metaText: { flex: 1, fontSize: fontSize.base, color: theme.textPrimary, lineHeight: 21 },

  cancelledTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: theme.danger },
  error: { fontSize: fontSize.sm, color: theme.danger, textAlign: 'center' },
});
