import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { fontSize, radius, spacing, theme } from '../theme.js';

export interface SearchBarProps {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  onClear?: () => void;
  /**
   * Home screen par search bar sirf ek BUTTON hai jo search screen kholta hai —
   * wahan type nahi hota. `readOnly` isi liye hai.
   */
  readOnly?: boolean;
  onPress?: () => void;
  autoFocus?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search stores or products',
  onSubmit,
  onClear,
  readOnly = false,
  onPress,
  autoFocus = false,
}: SearchBarProps) {
  const showClear = !readOnly && !!value && value.length > 0;

  const content = (
    <View style={styles.container}>
      <Search size={18} color={theme.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        style={styles.input}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        autoFocus={autoFocus}
        editable={!readOnly}
        // Read-only mode mein input ko taps nahi lene chahiye — Pressable
        // wrapper ko milne chahiye, warna keyboard khul jaata hai
        pointerEvents={readOnly ? 'none' : 'auto'}
        accessibilityLabel={placeholder}
      />
      {showClear && (
        <Pressable onPress={onClear} hitSlop={10} accessibilityLabel="Clear search">
          <X size={18} color={theme.textSecondary} />
        </Pressable>
      )}
    </View>
  );

  if (readOnly || onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="search" style={styles.pressableWrap}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  pressableWrap: Platform.select({
    web: { cursor: 'pointer' } as object,
    default: {},
  }) as object,
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: theme.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 46,
  },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    color: theme.textPrimary,
    // Web par input ka default focus outline RN styling se takrata hai
    ...Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
  },
});
