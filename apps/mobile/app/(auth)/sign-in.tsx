import { useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { requestOtpSchema } from '@nearbux/validation';
import { ApiClientError } from '@nearbux/api-client';
import { contentContainer, fontSize, fontWeight, radius, spacing, text, theme } from '@nearbux/ui';
import { GradientButton } from '../../src/components/GradientButton';
import { api } from '../../src/lib/api';

export default function SignInScreen() {
  const router = useRouter();
  // Sirf 10 digits rakhte hain; "+91" UI mein fixed prefix hai, taaki user
  // country code type karna na bhoole (yeh sabse common signup drop-off hai)
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const insets = useSafeAreaInsets();

  const phone = `+91${digits}`;

  async function handleSubmit() {
    setError(null);

    const parsed = requestOtpSchema.safeParse({ phone });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid mobile number');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.auth.requestOtp(parsed.data);
      router.push({ pathname: '/verify', params: { phone } });
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, contentContainer, { paddingTop: insets.top + spacing['3xl'] }]}>
        <View style={styles.header}>
          <Text style={styles.brand}>NearBux</Text>
          <Text style={styles.tagline}>Fresh groceries and local stores, delivered near you.</Text>
        </View>

        <View style={styles.form}>
          <Text style={text.overline}>Mobile number</Text>

          <View style={[styles.inputRow, error != null && styles.inputRowError]}>
            <Text style={styles.prefix}>+91</Text>
            <TextInput
              value={digits}
              onChangeText={(value) => {
                setDigits(value.replace(/\D/g, '').slice(0, 10));
                setError(null);
              }}
              placeholder="98765 43210"
              placeholderTextColor={theme.textDisabled}
              keyboardType="phone-pad"
              // Android/iOS dono par SMS se OTP autofill ke liye
              textContentType="telephoneNumber"
              autoComplete="tel"
              style={styles.input}
              maxLength={10}
              accessibilityLabel="Mobile number"
              onSubmitEditing={handleSubmit}
            />
          </View>

          {error && (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}

          <GradientButton
            label="Continue"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={digits.length !== 10}
          />

          <Text style={styles.legal}>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  container: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing['3xl'] },
  header: { gap: spacing.sm },
  brand: { fontSize: fontSize['3xl'], fontWeight: fontWeight.bold, color: theme.primary },
  tagline: { fontSize: fontSize.md, color: theme.textSecondary, lineHeight: 23 },
  form: { gap: spacing.md },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: theme.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: spacing.lg,
    height: 54,
  },
  inputRowError: { borderColor: theme.danger },
  prefix: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: theme.textSecondary },
  input: {
    flex: 1,
    fontSize: fontSize.md,
    color: theme.textPrimary,
    ...Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
  },
  error: { fontSize: fontSize.sm, color: theme.danger },
  legal: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 17,
  },
});
