import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, ShoppingCart, Store, Tag } from 'lucide-react-native';
import { formatEta, formatMinor } from '@nearbux/core';
import type { Cart } from '@nearbux/types';
import { ApiClientError } from '@nearbux/api-client';
import {
  BillSummary,
  Card,
  CartItemRow,
  EmptyState,
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
import { SignInPrompt } from '../../src/components/SignInPrompt';
import { useCartMutations, useCarts } from '../../src/lib/queries';
import { useSession } from '../../src/lib/session';

/** Screen [21] — My Cart */
export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useSession();
  const { data: carts, isLoading } = useCarts(isSignedIn);

  if (!isSignedIn) {
    return (
      <SignInPrompt
        insetTop={insets.top}
        title="Sign in to see your cart"
        message="Your cart is saved to your account so it follows you across devices."
      />
    );
  }

  if (isLoading) return <CenteredSpinner insetTop={insets.top} />;

  const activeCarts = carts ?? [];

  if (activeCarts.length === 0) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
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
          <StoreCart key={cart.id} cart={cart} />
        ))}
      </View>
    </ScrollView>
  );
}

function StoreCart({ cart }: { cart: Cart }) {
  const router = useRouter();
  const { setQuantity, clear, removePromotion } = useCartMutations();
  const [error, setError] = useState<string | null>(null);

  function changeQuantity(productId: string, quantity: number) {
    setError(null);
    setQuantity.mutate(
      { storeId: cart.storeId, productId, quantity },
      { onError: (err) => setError(err instanceof ApiClientError ? err.message : 'Could not update your cart.') },
    );
  }

  const hasUnavailable = cart.items.some((item) => !item.isAvailable);

  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <Text style={text.screenTitle}>My Cart</Text>
        <View style={styles.countChip}>
          <Text style={styles.countLabel}>
            {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <View style={styles.spacer} />
        <Pressable
          onPress={() => clear.mutate(cart.storeId)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear all items"
        >
          <Text style={text.link}>Clear All</Text>
        </Pressable>
      </View>

      {/* "Fulfilled by …" — ek cart hamesha EK store ka hota hai */}
      <Card variant="muted">
        <View style={styles.fulfilledRow}>
          <Store size={18} color={theme.textSecondary} />
          <View style={styles.fulfilledText}>
            <Text style={text.overline}>Fulfilled by</Text>
            <Text style={text.title} numberOfLines={1}>
              {cart.storeName}
            </Text>
          </View>
          <View style={styles.etaPill}>
            <View style={styles.etaDot} />
            <Text style={styles.etaLabel}>
              {formatEta(cart.etaMinMinutes, cart.etaMaxMinutes)}
            </Text>
          </View>
        </View>
      </Card>

      {cart.items.map((item) => (
        <CartItemRow
          key={item.id}
          name={item.name}
          subtitle={[item.unitLabel, item.unitDetail].filter(Boolean).join(' • ')}
          imageUrl={item.imageUrl}
          // Line total, unit price nahi — qty 2 par "₹499" dikhana galat
          // total suggest karta hai aur subtotal se match nahi karta
          priceLabel={formatMinor(item.lineTotalMinor)}
          quantity={item.quantity}
          onChangeQuantity={(q) => changeQuantity(item.productId, q)}
          onRemove={() => changeQuantity(item.productId, 0)}
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
              <Text style={text.muted} numberOfLines={1}>
                {cart.promotion.label}
              </Text>
            </View>
            <Pressable
              onPress={() => removePromotion.mutate(cart.storeId)}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={text.link}>Remove</Text>
            </Pressable>
          </View>
        </Card>
      )}

      <Card variant="muted">
        <BillSummary
          lines={billLines(cart)}
          totalValue={formatMinor(cart.bill.totalMinor)}
          totalCaption="Incl. all taxes & fees"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        {hasUnavailable && (
          <Text style={styles.warning}>
            Some items are no longer available. Remove them to continue.
          </Text>
        )}

        {!cart.meetsMinimumOrder && (
          <Text style={styles.warning}>
            Add {formatMinor(cart.minOrderMinor - cart.bill.itemTotalMinor)} more to meet the store
            minimum.
          </Text>
        )}

        <View style={styles.checkoutWrap}>
          <GradientButton
            label="Proceed to Checkout"
            onPress={() => router.push(`/checkout/${cart.storeId}`)}
            disabled={!cart.meetsMinimumOrder || hasUnavailable}
            iconRight={<ArrowRight size={18} color={theme.textInverse} />}
          />
        </View>
      </Card>
    </View>
  );
}

/**
 * Screen [21] ka bill.
 *
 * Zero lines chhupti hain — "Discount ₹0.00" sirf shor hai. Discount promo
 * ke baad aata hai taaki user turant dekh sake ki code ne kya kiya.
 */
function billLines(cart: Cart) {
  const lines: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: 'Subtotal', value: formatMinor(cart.bill.itemTotalMinor) },
  ];

  if (cart.bill.discountMinor > 0 && cart.promotion) {
    lines.push({
      label: `Discount (${cart.promotion.code})`,
      value: `-${formatMinor(cart.bill.discountMinor)}`,
      highlight: true,
    });
  }
  if (cart.bill.deliveryFeeMinor > 0) {
    lines.push({ label: 'Delivery Fee', value: formatMinor(cart.bill.deliveryFeeMinor) });
  }
  lines.push({
    label: 'Estimated Tax',
    value: formatMinor(cart.bill.taxMinor + cart.bill.platformFeeMinor),
  });
  return lines;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  block: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  countChip: {
    backgroundColor: theme.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  countLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: theme.textSecondary },
  spacer: { flex: 1 },
  fulfilledRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  fulfilledText: { flex: 1, gap: 2 },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: theme.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  etaDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.primary },
  etaLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: theme.textPrimary },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  promoText: { flex: 1, gap: 2 },
  promoCodeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  promoCode: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: theme.textPrimary },
  promoApplied: { fontSize: fontSize.sm, color: theme.primary, fontWeight: fontWeight.medium },
  error: { marginTop: spacing.md, fontSize: fontSize.sm, color: theme.danger },
  warning: { marginTop: spacing.md, fontSize: fontSize.sm, color: theme.warningText },
  checkoutWrap: {
    marginTop: spacing.lg,
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
});
