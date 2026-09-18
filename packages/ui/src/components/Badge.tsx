import { StyleSheet, Text, View } from 'react-native';
import { fontSize, fontWeight, radius, spacing, theme } from '../theme.js';

export type BadgeTone = 'success' | 'neutral' | 'warning' | 'info' | 'danger';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

/**
 * Status pill. Screens mein har jagah: "Open Now" / "Closed" / "IN STOCK" /
 * "In Progress" / "Completed" / "SPONSORED" / "Applied".
 */
export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  return (
    <View style={[styles.base, toneStyles[tone].container]}>
      <Text style={[styles.label, toneStyles[tone].label]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});

const toneStyles: Record<BadgeTone, { container: object; label: object }> = {
  // "Open Now" — solid green, white text
  success: {
    container: { backgroundColor: theme.success },
    label: { color: theme.textInverse },
  },
  // "Closed" — muted, deliberately kam prominent
  neutral: {
    container: { backgroundColor: theme.surfaceMuted },
    label: { color: theme.textSecondary },
  },
  // "In Progress"
  warning: {
    container: { backgroundColor: theme.warningSubtle },
    label: { color: theme.warningText },
  },
  // "IN STOCK", "Completed"
  info: {
    container: { backgroundColor: theme.successSubtle },
    label: { color: theme.successText },
  },
  danger: {
    container: { backgroundColor: theme.dangerSubtle },
    label: { color: theme.danger },
  },
};
