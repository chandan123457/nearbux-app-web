import { Stack } from 'expo-router';
import { theme } from '@nearbux/ui';
import { useSession } from '../../src/lib/session';

/**
 * Onboarding stack.
 *
 * Do phases ek hi group mein, dono guard ke peeche:
 *
 *   unauthenticated → login · signup · verify · reset-password
 *   needs-address   → address
 *
 * Address screen ka alag guard hone ki wajah yeh hai ki us waqt user SIGNED
 * IN hai — uske paas valid tokens hain, bas address nahi. Agar woh login ke
 * saath ek hi guard mein hoti, to user address screen se back karke login
 * par laut sakta tha aur wahan se ek doosra account bana sakta tha, jabki
 * session pehle se chal rahi hoti.
 */
export default function OnboardingLayout() {
  const { stage } = useSession();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Protected guard={stage === 'unauthenticated'}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="verify" />
        <Stack.Screen name="reset-password" />
      </Stack.Protected>

      <Stack.Protected guard={stage === 'needs-address'}>
        <Stack.Screen name="address" />
      </Stack.Protected>
    </Stack>
  );
}
