import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { ImagePlaceholder } from './ImagePlaceholder.js';
import { QuantityStepper } from './QuantityStepper.js';
import { cardStyle, fontSize, fontWeight, radius, spacing, text, theme } from '../theme.js';

export interface CartItemRowProps {
  name: string;
  /** "2 pcs pack • 350g" */
  subtitle: string;
  imageUrl?: string | null;
  /** Line total — unitPrice × quantity, sirf unit price nahi */
  priceLabel: string;
  quantity: number;
  onChangeQuantity: (next: number) => void;
  onRemove: () => void;
}

/** Cart ka row (screen [7]) */
export function CartItemRow({
  name,
  subtitle,
  imageUrl,
  priceLabel,
  quantity,
  onChangeQuantity,
  onRemove,
}: CartItemRowProps) {
  return (
    <View style={styles.row}>
      <ImagePlaceholder uri={imageUrl} style={styles.image} iconSize={22} accessibilityLabel={name} />

      <View style={styles.middle}>
        <Text style={text.title} numberOfLines={2}>
          {name}
        </Text>
        <Text style={text.muted} numberOfLines={1}>
          {subtitle}
        </Text>
        <View style={styles.stepperWrap}>
          <QuantityStepper quantity={quantity} onChange={onChangeQuantity} min={1} />
        </View>
      </View>

      <View style={styles.right}>
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${name} from cart`}
        >
          <Trash2 size={18} color={theme.danger} />
        </Pressable>
        <Text style={styles.price}>{priceLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    ...cardStyle,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  image: { width: 72, height: 72, borderRadius: radius.md },
  middle: { flex: 1, gap: 2 },
  stepperWrap: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  // Trash upar, price neeche — screenshot jaisa
  right: { justifyContent: 'space-between', alignItems: 'flex-end' },
  price: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: theme.textPrimary },
});
