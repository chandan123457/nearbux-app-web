import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { ApiClientError } from '@nearbux/api-client';
import { fontSize, fontWeight, spacing, theme } from '@nearbux/ui';
import {
  AuthHeader,
  AuthScreen,
  FormError,
  OtpInput,
} from '../../src/components/AuthForm';
import { GradientButton } from '../../src/components/GradientButton';
import { api } from '../../src/lib/api';
import { otpFlow } from '../../src/lib/otp-flow';
import { phoneAuth } from '../../src/lib/phone-auth';
import { useSession } from '../../src/lib/session';

const RESEND_SECONDS = 45;

/** Screen [3] — Verify OTP */
export default function VerifyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();

  const pending = otpFlow.getVerification();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  /**
   * Pending state gayab ho gayi (web par reload) — wapas shuruaat par bhejo.
   *
   * Yahan atak jaane ka matlab hai ek aisi verify screen jiske paas na phone
   * hai na Firebase ka confirmation handle: koi bhi code daalo, kuch nahi
   * hoga, aur user ko samajh hi nahi aayega kyun.
   */
  useEffect(() => {
    if (!pending) router.replace('/login');
  }, [pending, router]);

  // Resend cooldown. Firebase ka apna abuse protection alag hai, lekin user
  // ko dikhna chahiye ki kitna wait karna hai — warna woh baar-baar tap
  // karke rate limit kha jaata hai.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  if (!pending) return null;

  async function handleVerify(submittedCode: string) {
    if (!pending) return;
    if (submittedCode.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      // Code Firebase ko jaata hai, humare server ko nahi. Wapas ek signed
      // ID token milta hai, jise server verify karke phone number nikaalta
      // hai — client ka bheja number akela kabhi trust nahi hota.
      const idToken = await pending.session.confirm(submittedCode);

      if (pending.mode === 'signup') {
        await api.auth.signup({
          fullName: pending.fullName!,
          phone: pending.phone,
          password: pending.password!,
          ...(idToken ? { firebaseIdToken: idToken } : {}),
        });
        otpFlow.clearVerification();
        // Profile aate hi gate khud address screen par le jaayega —
        // yahan se navigate karne ki zaroorat nahi
        signIn(await api.me.get());
        return;
      }

      otpFlow.setReset({ phone: pending.phone, idToken });
      otpFlow.clearVerification();
      router.replace('/reset-password');
    } catch (err) {
      setCode('');
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'That code did not work. Please check and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (secondsLeft > 0 || !pending) return;
    setError(null);
    setCode('');
    try {
      otpFlow.replaceSession(await phoneAuth.sendOtp(pending.phone));
      setSecondsLeft(RESEND_SECONDS);
    } catch {
      setError('Could not resend the code. Please try again.');
    }
  }

  return (
    <AuthScreen
      footer={
        <GradientButton
          label="Verify & Proceed"
          shape="pill"
          onPress={() => void handleVerify(code)}
          loading={isSubmitting}
          disabled={code.length !== 6}
        />
      }
    >
      <View style={[styles.navBar, { marginTop: insets.top > 0 ? 0 : spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.back}
        >
          <ChevronLeft size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.navTitle}>Verify OTP</Text>
      </View>

      <AuthHeader
        title="Verify your number"
        subtitle={`Enter the 6-digit code sent to ${maskPhone(pending.phone)}`}
        showBrand={false}
      />

      <OtpInput
        value={code}
        onChange={(next) => {
          setCode(next);
          setError(null);
        }}
        onComplete={(next) => void handleVerify(next)}
        hasError={error !== null}
      />

      <View style={styles.resendRow}>
        <Text style={styles.resendPrompt}>Didn't receive the code? </Text>
        <Pressable onPress={handleResend} disabled={secondsLeft > 0} hitSlop={8}>
          <Text style={[styles.resend, secondsLeft > 0 && styles.resendWaiting]}>
            {secondsLeft > 0 ? `Resend in ${formatCountdown(secondsLeft)}` : 'Resend code'}
          </Text>
        </Pressable>
      </View>

      <FormError message={error} />
    </AuthScreen>
  );
}

/** "+919876543210" → "+91 98765 XXXXX" */
function maskPhone(phone: string): string {
  const match = phone.match(/^\+91(\d{5})(\d{5})$/);
  return match ? `+91 ${match[1]} XXXXX` : phone;
}

/** 45 → "0:45" */
function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  return `${mins}:${String(seconds % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  back: { position: 'absolute', left: 0 },
  navTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: theme.textPrimary },

  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: spacing['2xl'],
  },
  resendPrompt: { fontSize: fontSize.base, color: theme.textSecondary },
  resend: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: theme.primary },
  resendWaiting: { color: theme.textSecondary, fontWeight: fontWeight.regular },
});
