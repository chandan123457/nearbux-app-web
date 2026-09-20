import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { FavoriteHeart } from './FavoriteHeart.js';
import { ImagePlaceholder } from './ImagePlaceholder.js';
import { QuantityStepper } from './QuantityStepper.js';
import { cardStyle, fontSize, fontWeight, radius, spacing, text, theme } from '../theme.js';

export interface ProductCardProps {
  name: string;
  unitLabel: string;
  priceLabel: string;
  imageUrl?: string | null;
  /** Cross-store search results mein store ka naam upar dikhta hai */
  storeName?: string | null;
  isAvailable?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  /** 0 = "+" button; >0 = stepper. Screens [5] mein dono dikhte hain. */
  cartQuantity: number;
  onChangeQuantity: (next: number) => void;
  onPress?: () => void;
}

/** Catalog grid ka product card (screens [3][4][5]) */
export function ProductCard({
  name,
  unitLabel,
  priceLabel,
  imageUrl,
  storeName,
  isAvailable = true,
  isFavorite = false,
  onToggleFavorite,
  cartQuantity,
  onChangeQuantity,
  onPress,
}: ProductCardProps) {
  /*
   * Card ke teen interactive hisse hain — khud card, favourite heart, aur
   * add/stepper — aur teeno ek dusre ke SIBLINGS hain, nested nahi.
   *
   * Web par react-native-web `accessibilityRole="button"` wale Pressable ko
   * asli <button> banata hai. Ek ko dusre ke andar rakhne se <button> ke
   * andar <button> banta hai: invalid HTML, browser DOM restructure kar
   * deta hai, aur screen reader nested controls padhta hai.
   *
   * Isse ek UX fayda bhi hua: price aur add button par tap ab product page
   * nahi kholta, jo wahi behaviour hai jo user expect karta hai.
   */
  return (
    <View style={styles.card}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${name}, ${unitLabel}, ${priceLabel}`}
        style={({ pressed }) => [styles.pressableArea, pressed && onPress && styles.pressed]}
      >
        <ImagePlaceholder uri={imageUrl} style={styles.image} accessibilityLabel={name} />

        <View style={styles.body}>
          {storeName && (
            <Text style={styles.storeName} numberOfLines={1}>
              {storeName}
            </Text>
          )}
          <Text style={text.title} numberOfLines={1}>
            {name}
          </Text>
          <Text style={text.muted} numberOfLines={1}>
            {unitLabel}
          </Text>
        </View>
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.price}>{priceLabel}</Text>

        {/* Out of stock par na "+" na stepper — sirf disabled label */}
        {!isAvailable ? (
          <Text style={styles.unavailable}>Unavailable</Text>
        ) : cartQuantity > 0 ? (
          <QuantityStepper quantity={cartQuantity} onChange={onChangeQuantity} />
        ) : (
          <Pressable
            onPress={() => onChangeQuantity(1)}
            accessibilityRole="button"
            accessibilityLabel={`Add ${name} to cart`}
            hitSlop={8}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Plus size={20} color={theme.textInverse} strokeWidth={2.5} />
          </Pressable>
        )}
      </View>

      {onToggleFavorite && (
        <View style={styles.heart}>
          <FavoriteHeart isFavorite={isFavorite} onToggle={onToggleFavorite} size={17} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...cardStyle, flex: 1, position: 'relative' },
  pressableArea: Platform.select({
    web: { cursor: 'pointer' } as object,
    default: {},
  }) as object,
  pressed: { opacity: 0.9 },
  image: { height: 132, borderRadius: 0 },
  heart: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: 2 },
  storeName: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    fontWeight: fontWeight.medium,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    minHeight: 34,
  },
  price: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: theme.textPrimary },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailable: { fontSize: fontSize.sm, color: theme.textDisabled },
});
