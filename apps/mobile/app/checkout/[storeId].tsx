import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronLeft, CreditCard, MapPin } from 'lucide-react-native';
import { formatMinor } from '@nearbux/core';
import { ApiClientError } from '@nearbux/api-client';
import {
  BillSummary,
  Card,
  contentContainer,
  fontSize,
  fontWeight,
  spacing,
  text,
  theme,
} from '@nearbux/ui';
import { GradientButton } from '../../src/components/GradientButton';
import { api } from '../../src/lib/api';
import { CenteredSpinner } from '../../src/components/ScreenState';
import { keys, useAddresses } from '../../src/lib/queries';

/** Screens [8][9] — checkout aur order placement */
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

  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Idempotency key MOUNT par ek baar banti hai, har tap par nahi.
   *
   * Yahi poori baat hai: agar user double-tap kare ya network drop par retry
   * ho, wahi key jaati hai aur server pehla order wapas deta hai — do orders
   * aur do charges nahi.
   */
  const [idempotencyKey] = useState(() => globalThis.crypto.randomUUID());

  if (isLoading) return <CenteredSpinner insetTop={insets.top} />;

  const address = addresses?.find((a) => a.isDefault) ?? addresses?.[0];

  if (!cart || !address) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <Text style={text.muted}>
          {!cart ? 'Your cart is empty.' : 'Add a delivery address to continue.'}
        </Text>
      </View>
    );
  }

  async function placeOrder() {
    setError(null);
    setIsPlacing(true);
    try {
      const order = await api.orders.place({
        storeId: cart!.storeId,
        addressId: address!.id,
        paymentMethodType: 'UPI',
        expectedTotalMinor: cart!.bill.totalMinor,
        idempotencyKey,
      });
      router.replace(`/order/${order.id}?placed=1`);
    } catch (err) {
      // PRICE_CHANGED yahan sabse important case hai: user ko wapas cart par
      // bhejo taaki woh naya total dekh kar decide kare, chupchaap charge na ho
      if (err instanceof ApiClientError && err.code === 'PRICE_CHANGED') {
        setError('Prices changed while you were checking out. Please review your cart.');
      } else {
        setError(err instanceof ApiClientError ? err.message : 'Could not place your order.');
      }
    } finally {
      setIsPlacing(false);
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
          <Text style={text.sectionLabel}>Checkout</Text>
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
          <Pressable onPress={() => router.push('/cart')} style={styles.viewCart}>
            <Text style={text.link}>View Full Cart</Text>
          </Pressable>
        </Card>

        <Card variant="muted">
          <View style={styles.sectionRow}>
            <MapPin size={18} color={theme.textSecondary} />
            <View style={styles.sectionBody}>
              <Text style={text.overline}>Deliver to</Text>
              <Text style={text.title}>{address.formatted}</Text>
            </View>
          </View>
        </Card>

        <Card variant="muted">
          <View style={styles.sectionRow}>
            <CreditCard size={18} color={theme.textSecondary} />
            <View style={styles.sectionBody}>
              <Text style={text.overline}>Payment method</Text>
              <Text style={text.title}>UPI</Text>
              <Text style={text.muted}>Default preferred payment</Text>
            </View>
          </View>
        </Card>

        <Card variant="muted">
          <Text style={[text.overline, styles.billLabel]}>Bill details</Text>
          <BillSummary
            lines={[
              { label: 'Item Subtotal', value: formatMinor(cart.bill.itemTotalMinor) },
              ...(cart.bill.deliveryFeeMinor > 0
                ? [{ label: 'Delivery Fee', value: formatMinor(cart.bill.deliveryFeeMinor) }]
                : []),
              {
                label: 'Taxes & Fees',
                value: formatMinor(cart.bill.taxMinor + cart.bill.platformFeeMinor),
              },
              ...(cart.promotion
                ? [
                    {
                      label: `Discount (${cart.promotion.code})`,
                      value: `-${formatMinor(cart.bill.discountMinor)}`,
                      highlight: true,
                    },
                  ]
                : []),
            ]}
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
          iconRight={<ArrowRight size={18} color={theme.textInverse} />}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  summaryList: { gap: spacing.sm, marginTop: spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  summaryQty: { fontSize: fontSize.base, color: theme.textSecondary, minWidth: 26 },
  summaryName: { flex: 1, fontSize: fontSize.base, color: theme.textPrimary },
  summaryValue: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: theme.textPrimary },
  viewCart: { alignSelf: 'flex-end', marginTop: spacing.md },
  sectionRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  sectionBody: { flex: 1, gap: 2 },
  billLabel: { marginBottom: spacing.md },
  error: { fontSize: fontSize.sm, color: theme.danger, textAlign: 'center' },
});
