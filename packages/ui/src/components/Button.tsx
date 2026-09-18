import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { fontSize, fontWeight, radius, spacing, theme } from '../theme.js';

export type ButtonVariant = 'primary' | 'outline' | 'destructive' | 'ghost';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Screenshots mein "Proceed to Checkout →" aur cart icon ke saath */
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  iconLeft,
  iconRight,
  fullWidth = true,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const v = variants[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        sizes[size],
        v.container,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.label.color} size="small" />
      ) : (
        <View style={styles.content}>
          {iconLeft}
          <Text style={[styles.label, sizeLabels[size], v.label]} numberOfLines={1}>
            {label}
          </Text>
          {iconRight}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    // Web par pointer aur transition — native par yeh keys ignore ho jaati hain.
    // RNW ke saath desktop interactions manual effort maangte hain; unhe
    // chhod dene par button clickable to hota hai par "clickable lagta" nahi.
    ...Platform.select({
      web: { cursor: 'pointer', transitionDuration: '120ms' } as object,
      default: {},
    }),
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  label: { fontWeight: fontWeight.semibold },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});

const sizes = StyleSheet.create({
  md: { height: 44, paddingHorizontal: spacing.lg },
  lg: { height: 54, paddingHorizontal: spacing.xl },
});

const sizeLabels = StyleSheet.create({
  md: { fontSize: fontSize.base },
  lg: { fontSize: fontSize.md },
});

const variants: Record<ButtonVariant, { container: ViewStyle; label: { color: string } }> = {
  // Screenshots mein ye halka left→right blue gradient hai. Gradient ke liye
  // expo-linear-gradient chahiye; abhi solid primary use karte hain aur
  // Phase 4 mein app ke andar gradient wrap kar denge — package ko Expo par
  // depend karaye bina.
  primary: {
    container: { backgroundColor: theme.primary },
    label: { color: theme.textInverse },
  },
  outline: {
    container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.primary },
    label: { color: theme.primary },
  },
  // "Log Out", "Cancel Order"
  destructive: {
    container: { backgroundColor: theme.danger },
    label: { color: theme.textInverse },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    label: { color: theme.primary },
  },
};
