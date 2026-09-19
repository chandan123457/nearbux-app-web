import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ShoppingCart, Star } from 'lucide-react-native';
import { formatMinor } from '@nearbux/core';
import {
  Badge,
  Card,
  FavoriteHeart,
  ImagePlaceholder,
  ProductCard,
  QuantityStepper,
  SectionHeader,
  contentContainer,
  fontSize,
  fontWeight,
  spacing,
  text,
  theme,
} from '@nearbux/ui';
import { GradientButton } from '../../src/components/GradientButton';
import { CenteredSpinner } from '../../src/components/ScreenState';
import { useCartMutations, useFavoriteMutations, useProduct } from '../../src/lib/queries';

/** Screen [6] — product detail */
export default function ProductScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, isLoading } = useProduct(id ?? '');
  const { addItem, setQuantity } = useCartMutations();
  const { toggleProduct } = useFavoriteMutations();

  if (isLoading || !product) return <CenteredSpinner insetTop={insets.top} />;

  const inCart = product.cartQuantity > 0;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
        <View style={styles.hero}>
          <ImagePlaceholder
            uri={product.images[0] ?? null}
            style={styles.image}
            accessibilityLabel={product.name}
          />
          <View style={[styles.heroActions, { top: insets.top + spacing.md }]}>
            <Pressable onPress={() => router.back()} style={styles.circleButton} accessibilityLabel="Go back">
              <ChevronLeft size={22} color={theme.textPrimary} />
            </Pressable>
            <FavoriteHeart
              isFavorite={product.isFavorite}
              onToggle={() =>
                toggleProduct.mutate({ productId: product.id, isFavorite: product.isFavorite })
              }
            />
          </View>
        </View>

        <View style={[contentContainer, styles.content]}>
          <View style={styles.titleRow}>
            <Text style={styles.storeName} numberOfLines={1}>
              {product.storeName.toUpperCase()}
            </Text>
            <Badge
              label={product.isAvailable ? 'IN STOCK' : 'UNAVAILABLE'}
              tone={product.isAvailable ? 'info' : 'neutral'}
            />
          </View>

          <Text style={styles.name}>{product.name}</Text>
          <Text style={text.muted}>
            {product.unitLabel}
            {product.unitDetail ? ` (${product.unitDetail})` : ''}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatMinor(product.priceMinor)}</Text>
            {product.mrpMinor && (
              <Text style={styles.mrp}>{formatMinor(product.mrpMinor)}</Text>
            )}
            {product.discountPercent !== null && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>{product.discountPercent}% OFF</Text>
              </View>
            )}
          </View>

          {product.ratingCount > 0 && (
            <View style={styles.ratingRow}>
              <Star size={15} color={theme.rating} fill={theme.rating} />
              <Text style={styles.ratingValue}>{product.ratingAvg.toFixed(1)}</Text>
              <Text style={text.muted}>· {product.ratingCount} verified reviews</Text>
              {product.recommendPercent !== null && (
                <Text style={styles.recommend}>· {product.recommendPercent}% recommended</Text>
              )}
            </View>
          )}

          <Card variant="muted">
            <View style={styles.quantityRow}>
              <View>
                <Text style={text.title}>Quantity</Text>
                <Text style={text.muted}>
                  {inCart ? `In cart: ${product.cartQuantity}` : 'Not in cart'}
                </Text>
              </View>
              <QuantityStepper
                quantity={Math.max(product.cartQuantity, 1)}
                onChange={(q) =>
                  inCart
                    ? setQuantity.mutate({ storeId: product.storeId, productId: product.id, quantity: q })
                    : addItem.mutate({ productId: product.id, quantity: q })
                }
                min={1}
                size="md"
              />
            </View>
          </Card>

          {(product.description || product.shelfLife || product.storageInfo) && (
            <Card variant="muted">
              <View style={styles.aboutHeader}>
                <Text style={text.title}>About this product</Text>
                {product.badges[0] && <Text style={styles.badgeText}>{product.badges[0]}</Text>}
              </View>
              {product.description && <Text style={styles.description}>{product.description}</Text>}

              {(product.shelfLife || product.storageInfo) && (
                <View style={styles.specRow}>
                  {product.shelfLife && <Spec label="Shelf Life" value={product.shelfLife} />}
                  {product.storageInfo && <Spec label="Storage" value={product.storageInfo} />}
                </View>
              )}
            </Card>
          )}

          {product.relatedProducts.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="You may also like" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedRow}>
                {product.relatedProducts.map((related) => (
                  <View key={related.id} style={styles.relatedCell}>
                    <ProductCard
                      name={related.name}
                      unitLabel={related.unitLabel}
                      priceLabel={formatMinor(related.priceMinor)}
                      imageUrl={related.imageUrl}
                      isAvailable={related.isAvailable}
                      cartQuantity={related.cartQuantity}
                      onChangeQuantity={(q) =>
                        related.cartQuantity === 0
                          ? addItem.mutate({ productId: related.id, quantity: q })
                          : setQuantity.mutate({
                              storeId: related.storeId,
                              productId: related.id,
                              quantity: q,
                            })
                      }
                      onPress={() => router.replace(`/product/${related.id}`)}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky CTA — screen [6] jaisa */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={contentContainer}>
          <GradientButton
            label={
              inCart
                ? `In cart — ${formatMinor(product.priceMinor * product.cartQuantity)}`
                : `Add to Cart — ${formatMinor(product.priceMinor)}`
            }
            disabled={!product.isAvailable}
            loading={addItem.isPending}
            onPress={() =>
              inCart
                ? router.push('/cart')
                : addItem.mutate({ productId: product.id, quantity: 1 })
            }
            iconLeft={<ShoppingCart size={18} color={theme.textInverse} />}
          />
        </View>
      </View>
    </View>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.spec}>
      <Text style={text.muted}>{label}</Text>
      <Text style={styles.specValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  hero: { position: 'relative' },
  image: { height: 260, borderRadius: 0 },
  heroActions: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circleButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  storeName: { flex: 1, fontSize: fontSize.xs, color: theme.textSecondary, letterSpacing: 0.6 },
  name: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: theme.textPrimary },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  price: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: theme.textPrimary },
  mrp: { fontSize: fontSize.lg, color: theme.textDisabled, textDecorationLine: 'line-through' },
  discountBadge: {
    backgroundColor: theme.primarySubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: theme.primary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  ratingValue: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: theme.textPrimary },
  recommend: { fontSize: fontSize.sm, color: theme.primary },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aboutHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  badgeText: { fontSize: fontSize.sm, color: theme.primary, fontWeight: fontWeight.medium },
  description: { fontSize: fontSize.base, color: theme.textSecondary, lineHeight: 22 },
  specRow: {
    flexDirection: 'row',
    gap: spacing['2xl'],
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  spec: { gap: 2 },
  specValue: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: theme.textPrimary },
  section: { gap: spacing.md, marginTop: spacing.sm },
  relatedRow: { gap: spacing.md, paddingRight: spacing.lg },
  relatedCell: { width: 160 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
