import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, ShoppingCart, Store, Tag } from 'lucide-react-native';
import { formatEta, formatMinor } from '@nearbux/core';
import type { Cart } from '@nearbux/types';
import {
  Badge,
  BillSummary,
  Card,
  CartItemRow,
  EmptyState,
  contentContainer,
  fontSize,
  fontWeight,
  spacing,
  text,
  theme,
} from '@nearbux/ui';
import { GradientButton } from '../../src/components/GradientButton';
import { CenteredSpinner } from './index';
import { useCartMutations, useCarts } from '../../src/lib/queries';

/** Screen [7] — My Cart */
export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: carts, isLoading } = useCarts();
  const { setQuantity, clear, applyPromotion, removePromotion } = useCartMutations();
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);

  if (isLoading) return <CenteredSpinner insetTop={insets.top} />;

  const activeCarts = carts ?? [];

  if (activeCarts.length === 0) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <EmptyState
          icon={<ShoppingCart size={40} color={theme.textDisabled} strokeWidth={1.5} />}
          title="Your cart is empty"
          message="Browse stores near you and add something you like."
          actionLabel="Find stores"
          onAction={() => router.push('/')}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
    >
      <View style={[contentContainer, styles.content, { paddingTop: insets.top + spacing.md }]}>
        {activeCarts.map((cart) => (
          <CartBlock
            key={cart.id}
            cart={cart}
            onChangeQuantity={(productId, quantity) =>
              setQuantity.mutate({ storeId: cart.storeId, productId, quantity })
            }
            onClear={() => clear.mutate(cart.storeId)}
            onApplyPromo={(code) => {
              setPromoError(null);
              applyPromotion.mutate(
                { storeId: cart.storeId, code },
                {
                  onError: (err) => setPromoError((err as Error).message),
                  onSuccess: () => setPromoCode(''),
                },
              );
            }}
            onRemovePromo={() => removePromotion.mutate(cart.storeId)}
            promoCode={promoCode}
            onPromoCodeChange={setPromoCode}
            promoError={promoError}
            onCheckout={() => router.push(`/checkout/${cart.storeId}`)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

interface CartBlockProps {
  cart: Cart;
  onChangeQuantity: (productId: string, quantity: number) => void;
  onClear: () => void;
  onApplyPromo: (code: string) => void;
  onRemovePromo: () => void;
  promoCode: string;
  onPromoCodeChange: (code: string) => void;
  promoError: string | null;
  onCheckout: () => void;
}

function CartBlock({
  cart,
  onChangeQuantity,
  onClear,
  onRemovePromo,
  onCheckout,
}: CartBlockProps) {
  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <Text style={text.screenTitle}>My Cart</Text>
        <Badge label={`${cart.itemCount} items`} tone="neutral" />
        <View style={styles.spacer} />
        <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button">
          <Text style={text.link}>Clear All</Text>
        </Pressable>
      </View>

      <Card variant="muted">
        <View style={styles.fulfilledRow}>
          <Store size={18} color={theme.textSecondary} />
          <View style={styles.fulfilledText}>
            <Text style={text.overline}>Fulfilled by</Text>
            <Text style={text.title} numberOfLines={1}>
              {cart.storeName}
            </Text>
          </View>
          <Badge
            label={formatEta(cart.etaMinMinutes, cart.etaMaxMinutes)}
            tone="neutral"
          />
        </View>
      </Card>

      {cart.items.map((item) => (
        <CartItemRow
          key={item.id}
          name={item.name}
          subtitle={item.unitLabel}
          imageUrl={item.imageUrl}
          priceLabel={formatMinor(item.lineTotalMinor)}
          quantity={item.quantity}
          onChangeQuantity={(q) => onChangeQuantity(item.productId, q)}
          onRemove={() => onChangeQuantity(item.productId, 0)}
        />
      ))}

      {cart.promotion && (
        <Card variant="muted">
          <View style={styles.promoRow}>
            <Tag size={18} color={theme.textSecondary} />
            <View style={styles.promoText}>
              <View style={styles.promoCodeRow}>
                <Text style={styles.promoCode}>{cart.promotion.code}</Text>
                <Text style={styles.promoApplied}>Applied</Text>
              </View>
              <Text style={text.muted}>{cart.promotion.label}</Text>
            </View>
            <Pressable onPress={onRemovePromo} hitSlop={8} accessibilityRole="button">
              <Text style={text.link}>Remove</Text>
            </Pressable>
          </View>
        </Card>
      )}

      <Card>
        <BillSummary
          lines={buildBillLines(cart)}
          totalValue={formatMinor(cart.bill.totalMinor)}
          totalCaption="Incl. all taxes & fees"
        />

        {!cart.meetsMinimumOrder && (
          <Text style={styles.minimumWarning}>
            Add {formatMinor(cart.minOrderMinor - cart.bill.itemTotalMinor)} more to meet the
            store minimum.
          </Text>
        )}

        <View style={styles.checkoutWrap}>
          <GradientButton
            label="Proceed to Checkout"
            onPress={onCheckout}
            disabled={!cart.meetsMinimumOrder || cart.items.some((i) => !i.isAvailable)}
            iconRight={<ArrowRight size={18} color={theme.textInverse} />}
          />
        </View>
      </Card>
    </View>
  );
}

/** Zero lines chhupa dete hain — "Discount ₹0.00" sirf noise hai */
function buildBillLines(cart: Cart) {
  const lines = [{ label: 'Subtotal', value: formatMinor(cart.bill.itemTotalMinor) }];

  if (cart.bill.discountMinor > 0 && cart.promotion) {
    lines.push({
      label: `Discount (${cart.promotion.code})`,
      value: `-${formatMinor(cart.bill.discountMinor)}`,
      highlight: true,
    } as { label: string; value: string; highlight?: boolean });
  }
  if (cart.bill.deliveryFeeMinor > 0) {
    lines.push({ label: 'Delivery Fee', value: formatMinor(cart.bill.deliveryFeeMinor) });
  }
  lines.push({
    label: 'Taxes & Fees',
    value: formatMinor(cart.bill.taxMinor + cart.bill.platformFeeMinor),
  });
  return lines;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  block: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  spacer: { flex: 1 },
  fulfilledRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  fulfilledText: { flex: 1, gap: 2 },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  promoText: { flex: 1, gap: 2 },
  promoCodeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  promoCode: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: theme.textPrimary },
  promoApplied: { fontSize: fontSize.sm, color: theme.primary, fontWeight: fontWeight.medium },
  minimumWarning: { marginTop: spacing.md, fontSize: fontSize.sm, color: theme.warningText },
  checkoutWrap: { marginTop: spacing.lg },
});
