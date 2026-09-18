import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Store } from 'lucide-react-native';
import { EmptyState, Screen, SearchBar, SectionHeader, text, spacing, theme } from '@nearbux/ui';
import { useSession } from '../../src/lib/session';

/**
 * Home.
 *
 * Abhi shell hai, poora feed nahi. Banners, offers aur nearby stores ke
 * endpoints backend par exist NAHI karte — woh Phase 5 hain. Fake data
 * dikhane se yeh screen kaam karti hui lagegi jabki kuch bhi juda nahi hai,
 * isliye deliberately honest empty state hai.
 */
export default function HomeScreen() {
  const { user } = useSession();
  const insets = useSafeAreaInsets();

  return (
    <Screen bottomInset={insets.bottom} style={{ paddingTop: insets.top + spacing.md }}>
      <View style={styles.header}>
        <Text style={text.overline}>Deliver to</Text>
        <Text style={styles.address}>Add a delivery address</Text>
      </View>

      <SearchBar readOnly onPress={() => {}} />

      <SectionHeader title="Stores near you" />

      <EmptyState
        icon={<Store size={40} color={theme.textDisabled} strokeWidth={1.5} />}
        title="Store discovery is coming"
        message={`Signed in as ${user?.fullName ?? 'guest'}. Browsing, cart and orders arrive in the next phase.`}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2 },
  address: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
});
