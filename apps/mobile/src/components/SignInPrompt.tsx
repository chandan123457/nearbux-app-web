import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { LogIn } from 'lucide-react-native';
import { EmptyState, theme } from '@nearbux/ui';

/**
 * Guest ke liye sign-in prompt.
 *
 * Browsing guest ke liye khuli hai, lekin cart, orders aur profile ek identity
 * maangte hain. Yeh 401 error dikhane se behtar hai: user ne kuch galat nahi
 * kiya, use bas pata nahi tha ki sign in karna hai.
 */
export function SignInPrompt({
  title,
  message,
  insetTop = 0,
}: {
  title: string;
  message: string;
  insetTop?: number;
}) {
  const router = useRouter();
  return (
    <View style={[styles.container, { paddingTop: insetTop }]}>
      <EmptyState
        icon={<LogIn size={40} color={theme.textDisabled} strokeWidth={1.5} />}
        title={title}
        message={message}
        actionLabel="Sign in"
        onAction={() => router.push('/sign-in')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background,
  },
});
