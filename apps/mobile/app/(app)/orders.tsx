import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShoppingCart } from 'lucide-react-native';
import { EmptyState, Screen, SectionHeader, spacing, theme } from '@nearbux/ui';

/** Placeholder — orders ke endpoints Phase 5 mein aayenge */
export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  return (
    <Screen bottomInset={insets.bottom} style={{ paddingTop: insets.top + spacing.md }}>
      <SectionHeader title="Orders" />
      <EmptyState
        icon={<ShoppingCart size={40} color={theme.textDisabled} strokeWidth={1.5} />}
        title="Nothing here yet"
        message="This screen is wired up and waiting for its API, which lands in the next phase."
      />
    </Screen>
  );
}
