import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { fontSize, fontWeight, spacing, text, theme } from '@nearbux/ui';

/** Web par yeh asli 404 hai — native par yeh galat deep link par dikhta hai */
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Page not found</Text>
        <Text style={text.muted}>This screen does not exist.</Text>
        <Link href="/" style={styles.link}>
          Go to home
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: theme.background,
  },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: theme.textPrimary },
  link: { marginTop: spacing.md, color: theme.primary, fontWeight: fontWeight.semibold },
});
