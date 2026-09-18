import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { cardStyle, radius, spacing, theme } from '../theme.js';

export interface CardProps extends ViewProps {
  /** Screenshots mein do surfaces: white cards aur gray inset panels */
  variant?: 'surface' | 'muted';
  padded?: boolean;
  style?: ViewStyle;
}

/**
 * Base surface. Screenshots mein cards ka koi border nahi hai — woh gray
 * background par apne fill se alag dikhte hain.
 */
export function Card({ variant = 'surface', padded = true, style, children, ...rest }: CardProps) {
  return (
    <View
      style={[
        cardStyle,
        variant === 'muted' && styles.muted,
        padded && styles.padded,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // "Fulfilled by…", "BILL DETAILS", "About this product" panels
  muted: { backgroundColor: theme.surfaceMuted, borderRadius: radius.md },
  padded: { padding: spacing.lg },
});
