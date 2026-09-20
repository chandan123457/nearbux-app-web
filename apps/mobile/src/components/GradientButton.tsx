import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { fontSize, fontWeight, radius, spacing, theme } from '@nearbux/ui';

export interface GradientButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  /**
   * Onboarding screens ka CTA fully rounded hai, in-app ka rectangular.
   * Yeh sirf cosmetic nahi hai: onboarding par button hi screen ka akela
   * action hota hai, aur pill shape use uss role mein saaf alag karta hai.
   */
  shape?: 'rounded' | 'pill';
}

/**
 * Primary CTA ka gradient version ("Add to Cart", "Proceed to Checkout",
 * "Place Order").
 *
 * Yeh app mein rehta hai, @nearbux/ui mein nahi, kyunki gradients ke liye
 * expo-linear-gradient chahiye — aur UI package ko Expo par depend karana
 * usse kisi bhi non-Expo React Native app ke liye bekaar bana deta.
 * Package solid `Button` deta hai; app usse gradient mein wrap kar leta hai.
 */
export function GradientButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  iconLeft,
  iconRight,
  shape = 'rounded',
}: GradientButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.pressable,
        shape === 'pill' && styles.pill,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={[...theme.primaryGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradient, isDisabled && styles.disabled]}
      >
        {loading ? (
          <ActivityIndicator color={theme.textInverse} />
        ) : (
          <View style={styles.content}>
            {iconLeft}
            <Text style={styles.label}>{label}</Text>
            {iconRight}
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radius.md,
    overflow: 'hidden',
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
  pill: { borderRadius: radius.pill },
  pressed: { opacity: 0.9 },
  gradient: { height: 54, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: {
    color: theme.textInverse,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
