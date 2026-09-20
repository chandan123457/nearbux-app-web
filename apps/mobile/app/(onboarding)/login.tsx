import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { loginSchema, phoneSchema } from '@nearbux/validation';
import { ApiClientError } from '@nearbux/api-client';
import { fontSize, fontWeight, spacing, theme } from '@nearbux/ui';
import {
  AuthHeader,
  AuthScreen,
  AuthSwitch,
  Field,
  FormError,
  PasswordField,
  PhoneField,
} from '../../src/components/AuthForm';
import { GradientButton } from '../../src/components/GradientButton';
import { api } from '../../src/lib/api';
import { otpFlow } from '../../src/lib/otp-flow';
import { phoneAuth } from '../../src/lib/phone-auth';
import { useSession } from '../../src/lib/session';

/** Screen [1] — Welcome back */
export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useSession();

  const [digits, setDigits] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const phone = `+91${digits}`;
  const canSubmit = digits.length === 10 && password.length > 0;

  async function handleLogin() {
    setError(null);

    const parsed = loginSchema.safeParse({ phone, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your details and try again');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.auth.login(parsed.data);
      // Tokens client ne already store kar liye; ab profile laao taaki gate
      // ko pata chale ki address hai ya nahi
      signIn(await api.me.get());
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Could not log you in. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * "Forgot Password?" wahi phone use karta hai jo user upar type kar chuka
   * hai.
   *
   * Ek alag screen par dobara number maangna bekaar ka step hai — number
   * screen par pehle se hai. Khaali ya galat hone par error usi field par
   * dikhta hai.
   */
  async function handleForgotPassword() {
    setError(null);

    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setError('Enter your mobile number first, then tap Forgot Password.');
      return;
    }

    setIsSendingOtp(true);
    try {
      const session = await phoneAuth.sendOtp(parsed.data);
      otpFlow.setVerification({ mode: 'reset', phone: parsed.data, session });
      router.push('/verify');
    } catch {
      setError('Could not send the verification code. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  }

  return (
    <AuthScreen
      footer={
        <>
          <AuthSwitch
            prompt="Don't have an account?"
            actionLabel="Sign up"
            onPress={() => router.push('/signup')}
          />
          <GradientButton
            label="Log In"
            shape="pill"
            onPress={handleLogin}
            loading={isSubmitting}
            disabled={!canSubmit}
          />
        </>
      }
    >
      <AuthHeader title="Welcome back" subtitle="Log in to your NearBux account" />

      <Field label="Phone Number">
        <PhoneField
          value={digits}
          onChangeText={(next) => {
            setDigits(next);
            setError(null);
          }}
          hasError={error !== null}
        />
      </Field>

      <Field label="Password">
        <PasswordField
          value={password}
          onChangeText={(next) => {
            setPassword(next);
            setError(null);
          }}
          placeholder="Enter your password"
          hasError={error !== null}
          onSubmitEditing={handleLogin}
        />
      </Field>

      <View style={styles.forgotRow}>
        <Pressable
          onPress={handleForgotPassword}
          disabled={isSendingOtp}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={[styles.forgot, isSendingOtp && styles.forgotDisabled]}>
            {isSendingOtp ? 'Sending code…' : 'Forgot Password?'}
          </Text>
        </Pressable>
      </View>

      <FormError message={error} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  forgotRow: { alignItems: 'flex-end', marginTop: -spacing.sm, marginBottom: spacing.lg },
  forgot: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: theme.primary },
  forgotDisabled: { color: theme.textDisabled },
});
