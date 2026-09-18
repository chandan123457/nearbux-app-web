import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { verifyOtpSchema } from '@nearbux/validation';
import { ApiClientError } from '@nearbux/api-client';
import { contentContainer, fontSize, fontWeight, radius, spacing, text, theme } from '@nearbux/ui';
import { GradientButton } from '../../src/components/GradientButton';
import { api } from '../../src/lib/api';
import { useSession } from '../../src/lib/session';

const RESEND_SECONDS = 30;

export default function VerifyScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { signIn } = useSession();
  const insets = useSafeAreaInsets();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputRef = useRef<TextInput>(null);

  // Resend cooldown. Server bhi per-phone throttle karta hai, lekin user ko
  // dikhna chahiye ki kitna wait karna hai — warna woh baar-baar tap karke
  // 429 khaata rahega.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function handleVerify(submittedCode: string) {
    setError(null);

    const parsed = verifyOtpSchema.safeParse({ phone, code: submittedCode });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter the 6-digit code');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.auth.verifyOtp(parsed.data);
      // Tokens client ne already store kar liye; ab profile laao
      const profile = await api.me.get();
      signIn(profile);
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Verification failed. Try again.');
      setCode('');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (secondsLeft > 0) return;
    setError(null);
    setCode('');
    try {
      await api.auth.requestOtp({ phone: phone! });
      setSecondsLeft(RESEND_SECONDS);
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not resend the code.');
    }
  }

  return (
    <View style={[styles.container, contentContainer, { paddingTop: insets.top + spacing.lg }]}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={10}
        style={styles.back}
      >
        <ChevronLeft size={24} color={theme.textPrimary} />
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>Verify your number</Text>
        <Text style={text.muted}>
          We sent a 6-digit code to <Text style={styles.phone}>{phone}</Text>
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(value) => {
            const digits = value.replace(/\D/g, '').slice(0, 6);
            setCode(digits);
            setError(null);
            // Poora code aate hi apne aap submit — ek extra tap bachta hai
            if (digits.length === 6) void handleVerify(digits);
          }}
          placeholder="••••••"
          placeholderTextColor={theme.textDisabled}
          keyboardType="number-pad"
          // SMS se OTP autofill: iOS oneTimeCode, Android sms-otp
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          autoFocus
          maxLength={6}
          style={[styles.codeInput, error != null && styles.codeInputError]}
          accessibilityLabel="Verification code"
        />

        {error && (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}

        <GradientButton
          label="Verify"
          onPress={() => handleVerify(code)}
          loading={isSubmitting}
          disabled={code.length !== 6}
        />

        <Pressable onPress={handleResend} disabled={secondsLeft > 0} hitSlop={8}>
          <Text style={[styles.resend, secondsLeft > 0 && styles.resendDisabled]}>
            {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.xl, backgroundColor: theme.background },
  back: { alignSelf: 'flex-start' },
  header: { gap: spacing.sm },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: theme.textPrimary },
  phone: { color: theme.textPrimary, fontWeight: fontWeight.semibold },
  form: { gap: spacing.lg },
  codeInput: {
    backgroundColor: theme.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    height: 60,
    textAlign: 'center',
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    letterSpacing: 10,
    color: theme.textPrimary,
    ...Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
  },
  codeInputError: { borderColor: theme.danger },
  error: { fontSize: fontSize.sm, color: theme.danger, textAlign: 'center' },
  resend: {
    textAlign: 'center',
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: theme.primary,
  },
  resendDisabled: { color: theme.textDisabled },
});
