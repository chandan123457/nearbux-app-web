import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { EmptyState, theme } from '@nearbux/ui';

/**
 * Loading aur error states.
 *
 * Yeh apni file mein hain, kisi route file mein nahi. Pehle `CenteredSpinner`
 * home screen se export hota tha aur aadhi app usse import karti thi — matlab
 * ek product screen kholne par home screen ka poora module graph load hota
 * tha, aur routes ko move karte hi har import toot jaata tha.
 */
export function CenteredSpinner({ insetTop = 0 }: { insetTop?: number }) {
  return (
    <View style={[styles.centered, { paddingTop: insetTop }]}>
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );
}

export function ScreenError({
  message = 'Check your connection and try again.',
  onRetry,
  insetTop = 0,
}: {
  message?: string;
  onRetry?: () => void;
  insetTop?: number;
}) {
  return (
    <View style={[styles.centered, { paddingTop: insetTop }]}>
      <EmptyState
        title="Something went wrong"
        message={message}
        actionLabel={onRetry ? 'Retry' : undefined}
        onAction={onRetry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background,
  },
});
