import { Stack } from 'expo-router';
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
 * Onboarding gate.
 *
 * App poori tarah sign-in ke peeche hai. Home tab tak pahunchne se pehle
 * teen cheezein poori honi chahiye — account, verified phone, aur ek
 * delivery address:
 *
 *   [1] Log in  /  [2] Sign up → [3] Verify OTP → [4] Add address → home
 *
 * Gate `Stack.Protected` se DECLARATIVE hai, `router.replace()` wale effects
 * se nahi. Dono mein farak yeh hai: redirect-effect wale gate mein protected
 * screen pehle MOUNT hoti hai, apni queries fire karti hai, aur phir hat
 * jaati hai — matlab ek unauthenticated user bhi ek pal ke liye home ko
 * render kara deta hai aur uski saari API calls 401 leke aati hain. Guard
 * ke saath woh screens navigator mein hoti hi nahi.
 *
 * Address wala step deliberately IS gate ka hissa hai, ek "baad mein karo"
 * banner nahi: poori discovery (nearby stores, distance sort, delivery
 * radius) coordinates par chalti hai. Bina address ke home feed dikhane ka
 * matlab hai ek khaali screen, ya kisi random default city ke stores.
 */
function RootNavigator() {
  const { stage } = useSession();

  // Session restore hone tak kuch mat dikhao. Yahan koi bhi screen render
  // karna matlab use ek pal baad badal dena — aur woh flash har launch par
  // dikhta hai.
  if (stage === 'loading') {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: styles.content }}>
      <Stack.Protected guard={stage === 'ready'}>
        {/*
          Stack order matter karta hai — (tabs) pehla hai, isliye wahi initial
          route hai. store/product/order/checkout tabs ke UPAR push hote hain,
          isliye unka apna full screen milta hai bina tab bar ke.
        */}
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="store/[slug]" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="order-placed/[id]" />
        <Stack.Screen name="checkout/[storeId]" />
        <Stack.Screen name="notifications" />
      </Stack.Protected>

      <Stack.Protected guard={stage !== 'ready'}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  content: { backgroundColor: theme.background },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background,
  },
});
