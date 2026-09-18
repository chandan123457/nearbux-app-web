import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, text } from '../theme.js';

export interface SectionHeaderProps {
  title: string;
  /** "See All" / "See all" link */
  actionLabel?: string;
  onAction?: () => void;
  /** "OFFERS FOR YOU" uppercase hai; "Stores Near You" title-case */
  uppercase?: boolean;
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  uppercase = false,
}: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={uppercase ? text.overline : text.sectionLabel}>{title}</Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text style={text.link}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
