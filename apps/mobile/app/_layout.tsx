import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StyleSheet } from 'react-native';
import { theme } from '@nearbux/ui';
import { SessionProvider } from '../src/lib/session';

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
 * Root navigator.
 *
 * Koi auth gate NAHI hai: app hamesha home par khulti hai. Browsing guest ke
 * liye khuli hai (discovery endpoints `optionalAuth` par hain), aur login
 * tab maanga jaata hai jab woh sach mein zaroori ho — cart, orders, profile
 * aur checkout par.
 *
 * Yeh sirf dev convenience nahi hai. Browsing ke liye account maangna funnel
 * ka sabse mehnga step hai: user pehle dekhna chahta hai ki uske area mein
 * kya milta hai, tabhi woh number dene ko taiyaar hota hai.
 *
 * Stack order matter karta hai — (tabs) pehla hai, isliye wahi initial route
 * hai. store/product/order/checkout tabs ke UPAR push hote hain, isliye
 * unka apna full screen milta hai bina tab bar ke.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: styles.content }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="store/[slug]" />
            <Stack.Screen name="product/[id]" />
            <Stack.Screen name="order/[id]" />
            <Stack.Screen name="checkout/[storeId]" />
            <Stack.Screen name="notifications" />
            {/* Auth screens abhi bhi hain — checkout unhe push karega */}
            <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
          </Stack>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  content: { backgroundColor: theme.background },
});
