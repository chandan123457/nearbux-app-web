import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronLeft, ChevronRight, CreditCard, MapPin } from 'lucide-react-native';
import { formatMinor } from '@nearbux/core';
import type { Cart, SavedPaymentMethod } from '@nearbux/types';
import { ApiClientError } from '@nearbux/api-client';
import {
  BillSummary,
  Card,
  contentContainer,
  fontSize,
  fontWeight,
  radius,
  spacing,
  text,
  theme,
} from '@nearbux/ui';
import { GradientButton } from '../../src/components/GradientButton';
import { CenteredSpinner } from '../../src/components/ScreenState';
import { api } from '../../src/lib/api';
import { keys, useAddresses } from '../../src/lib/queries';

/** Screen [22] — Checkout */
export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { storeId } = useLocalSearchParams<{ storeId: string }>();

  const { data: cart, isLoading } = useQuery({
    queryKey: keys.cart(storeId ?? ''),
    queryFn: () => api.cart.get(storeId!),
    enabled: !!storeId,
  });
  const { data: addresses } = useAddresses();
  const { data: paymentMethods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => api.me.paymentMethods(),
  });

  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [showMethods, setShowMethods] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Idempotency key MOUNT par ek baar banti hai, har tap par nahi.
   *
   * Yahi poori baat hai: double-tap ya network retry par wahi key jaati hai
   * aur server pehla order wapas deta hai — do orders aur do charges nahi.
   */
  const [idempotencyKey] = useState(() => globalThis.crypto.randomUUID());

  const address = addresses?.find((a) => a.isDefault) ?? addresses?.[0];
  const method = useMemo<SavedPaymentMethod | undefined>(
    () =>
      paymentMethods?.find((m) => m.id === selectedMethodId) ??
      paymentMethods?.find((m) => m.isDefault) ??
      paymentMethods?.[0],
    [paymentMethods, selectedMethodId],
  );

  if (isLoading) return <CenteredSpinner insetTop={insets.top} />;

  if (!cart || cart.items.length === 0) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <Text style={text.muted}>Your cart is empty.</Text>
      </View>
    );
  }

  async function placeOrder() {
    // Bina address ke order place karna DB par fail hota hai. Pehle hi rok do
    // aur user ko address add karne bhejo, taaki "Place Order" tap karke
    // error na mile.
    if (!address) {
      setError('Add a delivery address before placing your order.');
      return;
    }

    setError(null);
    setIsPlacing(true);
    try {
      const order = await api.orders.place({
        storeId: cart!.storeId,
        addressId: address.id,
        paymentMethodId: method?.id ?? null,
        paymentMethodType: method?.type ?? 'UPI',
        expectedTotalMinor: cart!.bill.totalMinor,
        idempotencyKey,
      });
      router.replace(`/order-placed/${order.id}`);
    } catch (err) {
      // PRICE_CHANGED yahan sabse important case hai: user ko wapas cart par
      // bhejo taaki woh naya total dekh kar decide kare, chupchaap charge na ho
      setError(
        err instanceof ApiClientError && err.code === 'PRICE_CHANGED'
          ? 'Prices changed while you were checking out. Please review your cart.'
          : err instanceof ApiClientError
            ? err.message
            : 'Could not place your order. Please try again.',
      );
    } finally {
      setIsPlacing(false);
    }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
    >
      <View style={[contentContainer, styles.content, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
            <ChevronLeft size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Checkout</Text>
        </View>

        <Card variant="muted">
          <Text style={text.overline}>Order summary</Text>
          <View style={styles.summaryList}>
            {cart.items.map((item) => (
              <View key={item.id} style={styles.summaryRow}>
                <Text style={styles.summaryQty}>{item.quantity}×</Text>
                <Text style={styles.summaryName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.summaryValue}>{formatMinor(item.lineTotalMinor)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          <Pressable
            onPress={() => router.push('/cart')}
            style={styles.viewCart}
            accessibilityRole="button"
          >
            <Text style={text.link}>View Full Cart</Text>
            <ChevronRight size={16} color={theme.primary} />
          </Pressable>
        </Card>

        <Card variant="muted">
          <View style={styles.cardHeader}>
            <Text style={text.overline}>Payment method</Text>
            {(paymentMethods?.length ?? 0) > 1 && (
              <Pressable
                onPress={() => setShowMethods((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={text.link}>Change</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.methodRow}>
            <View style={styles.methodIcon}>
              <CreditCard size={18} color={theme.textSecondary} />
            </View>
            <View style={styles.methodText}>
              <Text style={text.title}>
                {method ? `${method.type} • ${method.displayLabel}` : 'UPI'}
              </Text>
              <Text style={text.muted}>
                {method?.isDefault ? 'Default preferred payment' : 'Selected for this order'}
              </Text>
            </View>
          </View>

          {showMethods &&
            paymentMethods?.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => {
                  setSelectedMethodId(m.id);
                  setShowMethods(false);
                }}
                style={styles.methodOption}
                accessibilityRole="button"
                accessibilityState={{ selected: m.id === method?.id }}
              >
                <Text style={[styles.methodLabel, m.id === method?.id && styles.methodLabelActive]}>
                  {m.type} • {m.displayLabel}
                </Text>
              </Pressable>
            ))}
        </Card>

        {/*
          Design mein address card nahi hai — address home ke "Deliver to"
          selector se aata hai. Address na hone par yahan ek line dikhate hain,
          warna "Place Order" server par fail hota aur user ko samajh hi nahi
          aata ki kyun.
        */}
        {!address && (
          <Card variant="muted">
            <View style={styles.methodRow}>
              <View style={styles.methodIcon}>
                <MapPin size={18} color={theme.danger} />
              </View>
              <View style={styles.methodText}>
                <Text style={text.title}>No delivery address</Text>
                <Text style={text.muted}>Add one to place this order.</Text>
              </View>
            </View>
          </Card>
        )}

        <Card variant="muted">
          <Text style={[text.overline, styles.billLabel]}>Bill details</Text>
          <BillSummary
            lines={billLines(cart)}
            totalLabel="Total Amount"
            totalValue={formatMinor(cart.bill.totalMinor)}
            totalCaption="Incl. all applicable taxes"
          />
        </Card>

        {error && (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}

        <GradientButton
          label={`Place Order • ${formatMinor(cart.bill.totalMinor)}`}
          onPress={placeOrder}
          loading={isPlacing}
          disabled={!address}
          iconRight={<ArrowRight size={18} color={theme.textInverse} />}
        />
      </View>
    </ScrollView>
  );
}

function billLines(cart: Cart) {
  const lines: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: 'Item Subtotal', value: formatMinor(cart.bill.itemTotalMinor) },
  ];
  if (cart.bill.deliveryFeeMinor > 0) {
    lines.push({ label: 'Delivery Fee', value: formatMinor(cart.bill.deliveryFeeMinor) });
  }
  lines.push({
    label: 'Taxes & Fees',
    value: formatMinor(cart.bill.taxMinor + cart.bill.platformFeeMinor),
  });
  if (cart.bill.discountMinor > 0 && cart.promotion) {
    lines.push({
      label: `Community Discount (${cart.promotion.code})`,
      value: `-${formatMinor(cart.bill.discountMinor)}`,
      highlight: true,
    });
  }
  return lines;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: theme.textPrimary },
  summaryList: { gap: spacing.md, marginTop: spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  summaryQty: { fontSize: fontSize.base, color: theme.textSecondary, minWidth: 26 },
  summaryName: { flex: 1, fontSize: fontSize.base, color: theme.textPrimary },
  summaryValue: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: theme.textPrimary },
  divider: { height: 1, backgroundColor: theme.border, marginTop: spacing.lg },
  viewCart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-end',
    marginTop: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodText: { flex: 1, gap: 2 },
  methodOption: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: theme.surface,
  },
  methodLabel: { fontSize: fontSize.base, color: theme.textPrimary },
  methodLabelActive: { color: theme.primary, fontWeight: fontWeight.semibold },
  billLabel: { marginBottom: spacing.md },
  error: { fontSize: fontSize.sm, color: theme.danger, textAlign: 'center' },
});
