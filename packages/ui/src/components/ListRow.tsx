import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { fontSize, spacing, text, theme } from '../theme.js';

export interface ListRowProps {
  title: string;
  subtitle?: string | null;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  /** Profile menu rows mein chevron hota hai */
  showChevron?: boolean;
  /** Section ka aakhri row separator nahi dikhata */
  isLast?: boolean;
}

/** Profile menu, search results, order items — sab ek hi row (screens [2][4][12]) */
export function ListRow({
  title,
  subtitle,
  left,
  right,
  onPress,
  showChevron = false,
  isLast = false,
}: ListRowProps) {
  const body = (
    <View style={[styles.row, !isLast && styles.divider]}>
      {left}
      <View style={styles.content}>
        <Text style={text.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
      {showChevron && <ChevronRight size={18} color={theme.textDisabled} />}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => [pressed && styles.pressed, styles.pressable]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: Platform.select({ web: { cursor: 'pointer' } as object, default: {} }) as object,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: theme.border },
  content: { flex: 1, gap: 2 },
  subtitle: { fontSize: fontSize.sm, color: theme.textSecondary },
  pressed: { opacity: 0.7 },
});
