import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { passwordSchema } from '@nearbux/validation';
import { ApiClientError } from '@nearbux/api-client';
import {
  AuthHeader,
  AuthScreen,
  Field,
  FormError,
  PasswordField,
} from '../../src/components/AuthForm';
import { GradientButton } from '../../src/components/GradientButton';
import { api } from '../../src/lib/api';
import { otpFlow } from '../../src/lib/otp-flow';
import { useSession } from '../../src/lib/session';

/**
 * "Forgot Password?" ka doosra hissa.
 *
 * Yeh screen shared designs mein nahi hai, lekin uske bina reset flow poora
 * hota hi nahi: OTP yeh saabit karta hai ki number user ka hai, par naya
 * password kahin to type karna padega. Design language baaki onboarding
 * screens jaisi hi rakhi hai.
 *
 * Yahan tak pahunchne ka ek hi raasta hai — verify screen par OTP pass
 * karna. Direct aane par (web reload) user wapas login par chala jaata hai.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { signIn } = useSession();

  const pending = otpFlow.getReset();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!pending) router.replace('/login');
  }, [pending, router]);

  if (!pending) return null;

  async function handleSubmit() {
    if (!pending) return;
    setError(null);
    setFieldError(null);
    setConfirmError(null);

    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Choose a stronger password');
      return;
    }
    if (password !== confirmPassword) {
      setConfirmError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.auth.resetPassword({
        phone: pending.phone,
        password: parsed.data,
        ...(pending.idToken ? { firebaseIdToken: pending.idToken } : {}),
      });
      otpFlow.clearReset();
      // Reset server par saare purane sessions revoke karta hai aur is
      // device ke liye naye tokens deta hai — dobara login karne ki
      // zaroorat nahi
      signIn(await api.me.get());
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Could not reset your password. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreen
      footer={
        <GradientButton
          label="Reset Password"
          shape="pill"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={password.length === 0 || confirmPassword.length === 0}
        />
      }
    >
      <AuthHeader
        title="Set a new password"
        subtitle="Your number is verified. Choose a new password to log in with."
      />

      <Field label="New Password" error={fieldError}>
        <PasswordField
          value={password}
          onChangeText={(next) => {
            setPassword(next);
            setFieldError(null);
          }}
          placeholder="Create a password"
          isNew
          hasError={Boolean(fieldError)}
        />
      </Field>

      <Field label="Confirm Password" error={confirmError}>
        <PasswordField
          value={confirmPassword}
          onChangeText={(next) => {
            setConfirmPassword(next);
            setConfirmError(null);
          }}
          placeholder="Re-enter password"
          isNew
          hasError={Boolean(confirmError)}
          onSubmitEditing={handleSubmit}
        />
      </Field>

      <FormError message={error} />
    </AuthScreen>
  );
}
