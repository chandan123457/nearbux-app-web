import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { fontSize, fontWeight, radius, spacing, theme } from '../theme.js';

export interface QuantityStepperProps {
  quantity: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** Cart mein compact, product detail par bada */
  size?: 'sm' | 'md';
}

/**
 * "− 2 +" stepper.
 *
 * Screenshots mein do jagah dikhta hai: cart rows par (compact, white pill
 * jiska "+" blue circle hai) aur product detail par (bada).
 *
 * Clamping yahin hoti hai taaki har call site apna bound logic na likhe —
 * warna ek jagah max miss ho jaata hai aur user 999 avocado order kar deta hai.
 */
export function QuantityStepper({
  quantity,
  onChange,
  min = 0,
  max = 20,
  disabled = false,
  size = 'sm',
}: QuantityStepperProps) {
  const dim = size === 'sm' ? 30 : 36;
  const canDecrease = !disabled && quantity > min;
  const canIncrease = !disabled && quantity < max;

  return (
    <View style={[styles.container, { borderRadius: radius.pill }]}>
      <Pressable
        onPress={() => canDecrease && onChange(quantity - 1)}
        disabled={!canDecrease}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        style={[styles.circle, styles.decrease, { width: dim, height: dim, borderRadius: dim / 2 }, !canDecrease && styles.faded]}
      >
        <Minus size={size === 'sm' ? 15 : 18} color={theme.textPrimary} strokeWidth={2.5} />
      </Pressable>

      <Text style={[styles.value, size === 'md' && styles.valueLg]} accessibilityLiveRegion="polite">
        {quantity}
      </Text>

      <Pressable
        onPress={() => canIncrease && onChange(quantity + 1)}
        disabled={!canIncrease}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        style={[styles.circle, styles.increase, { width: dim, height: dim, borderRadius: dim / 2 }, !canIncrease && styles.faded]}
      >
        <Plus size={size === 'sm' ? 15 : 18} color={theme.textInverse} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...Platform.select({ web: { cursor: 'default' } as object, default: {} }),
  },
  circle: { alignItems: 'center', justifyContent: 'center' },
  decrease: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  increase: { backgroundColor: theme.primary },
  value: {
    minWidth: 20,
    textAlign: 'center',
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: theme.textPrimary,
  },
  valueLg: { fontSize: fontSize.md },
  faded: { opacity: 0.4 },
});
