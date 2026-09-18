import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { theme } from '@nearbux/ui';
import { SessionProvider, useSession } from '../src/lib/session';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Cold starts (Render + Neon dono suspend karte hain) network errors
      // jaise dikhte hain. Do retries se woh user tak pahunchne se pehle hi
      // recover ho jaate hain.
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Auth gate.
 *
 * Yeh ek jagah decide karta hai ki user (auth) group mein rahega ya (app)
 * group mein. Har screen mein alag-alag redirect likhne se hamesha koi ek
 * screen chhut jaati hai aur signed-out user protected content dekh leta hai.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isSignedIn && !inAuthGroup) {
      router.replace('/sign-in');
    } else if (isSignedIn && inAuthGroup) {
      router.replace('/');
    }
  }, [isSignedIn, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <StatusBar style="dark" />
          <AuthGate>
            <Stack screenOptions={{ headerShown: false, contentStyle: styles.content }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
            </Stack>
          </AuthGate>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background,
  },
  content: { backgroundColor: theme.background },
});
