import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { fontSize, fontWeight, radius, spacing, theme } from '../theme.js';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
}

/**
 * Do jagah use hota hai:
 *  - Store page ke category chips (Fruits & Veg / Dairy…) — selected dark
 *  - Recent search chips (clock icon ke saath) — kabhi selected nahi
 */
export function Chip({ label, selected = false, onPress, icon }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected } : undefined}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.unselected,
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
  // Screenshots mein active chip almost-black hai, brand blue nahi
  selected: { backgroundColor: theme.textPrimary },
  unselected: { backgroundColor: theme.surfaceMuted },
  label: { fontSize: fontSize.base, fontWeight: fontWeight.medium },
  labelSelected: { color: theme.textInverse },
  labelUnselected: { color: theme.textPrimary },
  pressed: { opacity: 0.75 },
});
