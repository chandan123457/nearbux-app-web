import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { contentContainer, spacing, theme } from '../theme.js';

export interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  /** Cart/checkout ke sticky CTA ke liye extra bottom space */
  contentPadding?: boolean;
  style?: ViewStyle;
  bottomInset?: number;
}

/**
 * Har screen ka wrapper.
 *
 * Yahi woh jagah hai jahan "centered mobile width" wala decision rehta hai:
 * content 480px column mein center hota hai aur baaki jagah background.
 * Designs mobile ke liye bane hain — desktop par unhe stretch karne se cart
 * rows 10 inch chaudi ho jaati hain aur layout toot jaata hai.
 *
 * Native par maxWidth kuch nahi karta (screen pehle hi chhoti hai), isliye ek
 * hi component teeno platforms par kaam karta hai — koi Platform check nahi.
 */
export function Screen({
  children,
  scrollable = true,
  contentPadding = true,
  style,
  bottomInset = 0,
}: ScreenProps) {
  const inner = (
    <View
      style={[
        contentContainer,
        contentPadding && styles.padded,
        { paddingBottom: spacing.xl + bottomInset },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!scrollable) {
    return <View style={styles.root}>{inner}</View>;
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {inner}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  scrollContent: { flexGrow: 1 },
  padded: { paddingHorizontal: spacing.lg, gap: spacing.lg },
});
