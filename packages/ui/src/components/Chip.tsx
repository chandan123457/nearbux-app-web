import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { fontSize, fontWeight, radius, spacing, theme } from '../theme.js';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  /**
   * Selected state ka rang. Designs mein do alag hain:
   *   'dark'    store ki category chips (screen [18]) — almost-black
   *   'primary' orders ke filter tabs (screen [25]) — brand blue
   *
   * Yeh ek hi component ke do use hain, do components nahi: filter tabs aur
   * category chips ka behaviour same hai, sirf emphasis alag hai. Category
   * chips content filter karti hain aur peeche rehni chahiye; filter tabs
   * hi us screen ka primary control hain.
   */
  tone?: 'dark' | 'primary';
}

/**
 * Do jagah use hota hai:
 *  - Store page ke category chips (Fruits & Veg / Dairy…) — selected dark
 *  - Recent search chips (clock icon ke saath) — kabhi selected nahi
 */
export function Chip({ label, selected = false, onPress, icon, tone = 'dark' }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected } : undefined}
      style={({ pressed }) => [
        styles.base,
        selected
          ? tone === 'primary'
            ? styles.selectedPrimary
            : styles.selectedDark
          : styles.unselected,
        pressed && onPress && styles.pressed,
      ]}
    >
      {icon}
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
  selectedDark: { backgroundColor: theme.textPrimary },
  selectedPrimary: { backgroundColor: theme.primary },
  unselected: { backgroundColor: theme.surfaceMuted },
  label: { fontSize: fontSize.base, fontWeight: fontWeight.medium },
  labelSelected: { color: theme.textInverse },
  labelUnselected: { color: theme.textPrimary },
  pressed: { opacity: 0.75 },
});
