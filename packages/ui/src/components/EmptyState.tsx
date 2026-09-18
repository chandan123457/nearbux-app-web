import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button.js';
import { fontSize, fontWeight, spacing, theme } from '../theme.js';

export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Empty aur error states.
 *
 * Screenshots mein ye nahi hain — mocks hamesha data ke saath bane hote hain.
 * Lekin khaali cart, "no results", aur failed requests asli states hain jo
 * pehle din se dikhengi. Inhe abhi banana baad mein har screen par ad-hoc
 * "no data" text likhne se behtar hai.
 */
export function EmptyState({ title, message, icon, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon}
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} fullWidth={false} size="md" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.xl,
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: theme.textPrimary },
  message: {
    fontSize: fontSize.base,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
});
