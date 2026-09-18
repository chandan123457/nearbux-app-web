import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Home, ShoppingCart, ReceiptText, User } from 'lucide-react-native';
import { contentContainer, fontSize, fontWeight, spacing, theme } from '../theme.js';

export type TabKey = 'home' | 'cart' | 'orders' | 'profile';

export interface BottomTabBarProps {
  active: TabKey;
  onSelect: (tab: TabKey) => void;
  /** Cart tab par item count badge */
  cartCount?: number;
  /** iOS home indicator / Android nav bar ke liye */
  bottomInset?: number;
}

const TABS: Array<{ key: TabKey; label: string; Icon: typeof Home }> = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'cart', label: 'Cart', Icon: ShoppingCart },
  { key: 'orders', label: 'Orders', Icon: ReceiptText },
  { key: 'profile', label: 'Profile', Icon: User },
];

/**
 * Bottom tabs (har screen par).
 *
 * Web par bhi yahi rehta hai — humne "centered mobile width" chuna tha, to
 * desktop par sidebar nahi aata. Content phone column mein center rehta hai
 * aur navigation har jagah ek jaisi dikhti hai.
 */
export function BottomTabBar({ active, onSelect, cartCount = 0, bottomInset = 0 }: BottomTabBarProps) {
  return (
    <View style={[styles.wrapper, { paddingBottom: bottomInset }]}>
      <View style={[styles.inner, contentContainer]}>
        {TABS.map(({ key, label, Icon }) => {
          const isActive = key === active;
          const color = isActive ? theme.primary : theme.textSecondary;
          return (
            <Pressable
              key={key}
              onPress={() => onSelect(key)}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: isActive }}
              style={styles.tab}
            >
              <View>
                <Icon size={22} color={color} strokeWidth={isActive ? 2.4 : 2} />
                {key === 'cart' && cartCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, { color }, isActive && styles.labelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  inner: { flexDirection: 'row', paddingTop: spacing.md, paddingBottom: spacing.sm },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
  label: { fontSize: fontSize.sm },
  labelActive: { fontWeight: fontWeight.semibold },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: theme.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: theme.textInverse,
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
});
