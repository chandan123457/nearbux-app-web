import { useState } from 'react';
import { useRouter } from 'expo-router';
import { signupFormSchema } from '@nearbux/validation';
import { ApiClientError } from '@nearbux/api-client';
import {
  AuthHeader,
  AuthScreen,
  AuthSwitch,
  Field,
  FormError,
  PasswordField,
  PhoneField,
  TextField,
} from '../../src/components/AuthForm';
import { GradientButton } from '../../src/components/GradientButton';
import { api } from '../../src/lib/api';
import { otpFlow } from '../../src/lib/otp-flow';
import { phoneAuth } from '../../src/lib/phone-auth';

type FieldErrors = Partial<Record<'fullName' | 'phone' | 'password' | 'confirmPassword', string>>;

/** Screen [2] — Create your account */
export default function SignupScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [digits, setDigits] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const phone = `+91${digits}`;
  const canSubmit =
    fullName.trim().length > 0 &&
    digits.length === 10 &&
    password.length > 0 &&
    confirmPassword.length > 0;

  function clearError(field: keyof FieldErrors) {
    setError(null);
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  /**
   * "Verify OTP" teen kaam karta hai, is order mein:
   *
   *   1. form validate  — invalid input par SMS bhejne ka koi matlab nahi
   *   2. number already registered? — OTP ke BAAD yeh batana matlab user se
   *      poora verification karwa kar phir "account already exists" dikhana
   *   3. tab ja kar OTP
   *
   * Har SMS ke paise lagte hain, isliye woh sabse aakhir mein hai — jab
   * baaki sab pass ho chuka ho.
   */
  async function handleSubmit() {
    setError(null);
    setFieldErrors({});

    const parsed = signupFormSchema.safeParse({ fullName, phone, password, confirmPassword });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FieldErrors | undefined;
        if (field && !errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const { exists } = await api.auth.checkPhone(parsed.data.phone);
      if (exists) {
        setFieldErrors({ phone: 'This number is already registered. Log in instead.' });
        return;
      }

      const session = await phoneAuth.sendOtp(parsed.data.phone);
      // Password navigation params mein NAHI jaata — woh web par URL aur
      // browser history mein chala jaata. Dekho lib/otp-flow.ts
      otpFlow.setVerification({
        mode: 'signup',
        phone: parsed.data.phone,
        fullName: parsed.data.fullName,
        password: parsed.data.password,
        session,
      });
      router.push('/verify');
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Could not send the verification code. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreen
      footer={
        <GradientButton
          label="Verify OTP"
          shape="pill"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!canSubmit}
        />
      }
    >
      <AuthHeader
        title="Create your account"
        subtitle="Find and shop the best local stores near you"
      />

      <Field label="Full Name" error={fieldErrors.fullName}>
        <TextField
          value={fullName}
          onChangeText={(next) => {
            setFullName(next);
            clearError('fullName');
          }}
          placeholder="Enter your name"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          hasError={Boolean(fieldErrors.fullName)}
        />
      </Field>

      <Field
        label="Phone Number"
        hint="We'll send an OTP to verify your number"
        error={fieldErrors.phone}
      >
        <PhoneField
          value={digits}
          onChangeText={(next) => {
            setDigits(next);
            clearError('phone');
          }}
          hasError={Boolean(fieldErrors.phone)}
        />
      </Field>

      <Field label="Password" error={fieldErrors.password}>
        <PasswordField
          value={password}
          onChangeText={(next) => {
            setPassword(next);
            clearError('password');
          }}
          placeholder="Create a password"
          isNew
          hasError={Boolean(fieldErrors.password)}
        />
      </Field>

      <Field label="Confirm Password" error={fieldErrors.confirmPassword}>
        <PasswordField
          value={confirmPassword}
          onChangeText={(next) => {
            setConfirmPassword(next);
            clearError('confirmPassword');
          }}
          placeholder="Re-enter password"
          isNew
          hasError={Boolean(fieldErrors.confirmPassword)}
          onSubmitEditing={handleSubmit}
        />
      </Field>

      <AuthSwitch
        prompt="Already have an account?"
        actionLabel="Log in"
        onPress={() => router.back()}
      />

      <FormError message={error} />
    </AuthScreen>
  );
}
