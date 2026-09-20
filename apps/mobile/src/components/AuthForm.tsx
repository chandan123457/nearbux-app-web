import { forwardRef, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeOff, Lock, Smartphone } from 'lucide-react-native';
import { fontSize, fontWeight, radius, spacing, theme } from '@nearbux/ui';

/**
 * Onboarding ke form building blocks.
 *
 * Chaaron onboarding screens ek hi input language share karti hain — wahi
 * label style, wahi field height, wahi focus aur error treatment. Har screen
 * mein alag-alag TextInput likhne par woh dheere-dheere diverge karte hain
 * (ek jagah 52px height, doosri jagah 48), aur signup se login jaate waqt
 * woh farak saaf dikhta hai.
 */

/** Auth forms ko phone-width column mein rakha jaata hai, poori screen par nahi */
const AUTH_MAX_WIDTH = 420;

const FIELD_HEIGHT = 54;

// ─────────────────────────── layout ───────────────────────────

export function AuthScreen({
  children,
  footer,
}: {
  children: React.ReactNode;
  /**
   * Screen ke NEECHE chipka rehne wala hissa (CTA, "already have an
   * account?").
   *
   * Designs mein CTA hamesha neeche hai, form ke turant baad nahi. `flexGrow`
   * + spacer se woh chhoti screen par bhi neeche rehta hai aur bade form par
   * scroll ho jaata hai — dono ke liye alag layout likhe bina.
   */
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing['2xl'] },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>{children}</View>
        <View style={styles.spacer} />
        {footer && <View style={styles.column}>{footer}</View>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthHeader({
  title,
  subtitle,
  showBrand = true,
}: {
  title: string;
  subtitle?: string;
  showBrand?: boolean;
}) {
  return (
    <View style={styles.header}>
      {showBrand && <Text style={styles.brand}>NearBux</Text>}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

// ─────────────────────────── fields ───────────────────────────

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {/*
        Error hint ko REPLACE karta hai, uske neeche nahi aata. Dono ek saath
        dikhane par field ke neeche do lines ho jaati hain aur baaki form
        neeche khisak jaata hai — validation ke waqt layout kabhi nahi hilna
        chahiye.
      */}
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export const TextField = forwardRef<TextInput, TextInputProps & { hasError?: boolean }>(
  function TextField({ hasError, style, ...props }, ref) {
    return (
      <TextInput
        ref={ref}
        placeholderTextColor={theme.textDisabled}
        style={[styles.input, hasError && styles.inputError, style]}
        {...props}
      />
    );
  },
);

/**
 * Phone field ka "+91" ek FIXED prefix hai, editable text nahi.
 *
 * Country code type karwana signup ka sabse aam drop-off hai: log "98765…"
 * likhte hain, validation fail hoti hai, aur error unhe yeh nahi batata ki
 * "+91" bhi chahiye tha. Prefix dikhakar woh sawaal hi khatam ho jaata hai,
 * aur input sirf 10 digits leta hai.
 */
export function PhoneField({
  value,
  onChangeText,
  hasError,
  editable = true,
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (digits: string) => void;
  hasError?: boolean;
  editable?: boolean;
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={[styles.row, hasError && styles.inputError, !editable && styles.rowDisabled]}>
      <Smartphone size={18} color={theme.textSecondary} />
      <Text style={styles.prefix}>+91</Text>
      <View style={styles.rowDivider} />
      <TextInput
        value={value}
        onChangeText={(next) => onChangeText(next.replace(/\D/g, '').slice(0, 10))}
        placeholder="10-digit mobile number"
        placeholderTextColor={theme.textDisabled}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        maxLength={10}
        editable={editable}
        onSubmitEditing={onSubmitEditing}
        style={styles.rowInput}
        accessibilityLabel="Mobile number"
      />
    </View>
  );
}

export function PasswordField({
  value,
  onChangeText,
  placeholder,
  hasError,
  isNew = false,
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  hasError?: boolean;
  /** Naya password banaya ja raha hai (signup / reset) — autofill ko batata hai */
  isNew?: boolean;
  onSubmitEditing?: () => void;
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={[styles.row, hasError && styles.inputError]}>
      <Lock size={18} color={theme.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textDisabled}
        secureTextEntry={!isVisible}
        autoCapitalize="none"
        autoCorrect={false}
        // Password managers ko batao ki yeh naya password hai, warna woh
        // purana wala bhar dete hain aur user ko samajh hi nahi aata
        textContentType={isNew ? 'newPassword' : 'password'}
        autoComplete={isNew ? 'new-password' : 'current-password'}
        onSubmitEditing={onSubmitEditing}
        style={[styles.rowInput, styles.passwordInput]}
        accessibilityLabel={placeholder}
      />
      <Pressable
        onPress={() => setIsVisible((v) => !v)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={isVisible ? 'Hide password' : 'Show password'}
      >
        {isVisible ? (
          <Eye size={18} color={theme.textSecondary} />
        ) : (
          <EyeOff size={18} color={theme.textSecondary} />
        )}
      </Pressable>
    </View>
  );
}

const OTP_LENGTH = 6;

/**
 * 6-box OTP input.
 *
 * Boxes dikhte hain, lekin input EK hi hai — ek transparent TextInput jo
 * poore row ke upar faila hua hai, aur boxes uski value se render hote hain.
 *
 * Chhe alag-alag TextInput rakhna seedha lagta hai aur practice mein tootta
 * hai: SMS autofill poora code ek hi field mein daalta hai, paste bhi ek hi
 * field mein jaata hai, aur backspace par focus manually peeche le jaana
 * padta hai (jo har platform par alag behave karta hai). Ek input woh saari
 * class of bugs hata deta hai.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  hasError,
}: {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  hasError?: boolean;
}) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      accessibilityRole="none"
      style={styles.otpRow}
    >
      {Array.from({ length: OTP_LENGTH }).map((_, index) => {
        const char = value[index] ?? '';
        const isActive = isFocused && index === Math.min(value.length, OTP_LENGTH - 1);
        return (
          <View
            key={index}
            style={[
              styles.otpBox,
              isActive && styles.otpBoxActive,
              hasError && styles.otpBoxError,
            ]}
          >
            <Text style={styles.otpChar}>{char}</Text>
          </View>
        );
      })}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(next) => {
          const digits = next.replace(/\D/g, '').slice(0, OTP_LENGTH);
          onChange(digits);
          // Poora code aate hi apne aap submit — ek extra tap bachta hai,
          // aur SMS autofill ke baad to woh tap waise bhi ajeeb lagta hai
          if (digits.length === OTP_LENGTH) onComplete?.(digits);
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        keyboardType="number-pad"
        // SMS se OTP autofill: iOS oneTimeCode, Android sms-otp
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        autoFocus
        maxLength={OTP_LENGTH}
        style={styles.otpHiddenInput}
        // caret aur text dono chhupe rehte hain — boxes hi asli UI hain
        caretHidden
        accessibilityLabel="Verification code"
      />
    </Pressable>
  );
}

// ─────────────────────────── misc ───────────────────────────

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text style={styles.formError} accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}

/** "Don't have an account? Sign up" */
export function AuthSwitch({
  prompt,
  actionLabel,
  onPress,
}: {
  prompt: string;
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchPrompt}>{prompt} </Text>
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
        <Text style={styles.switchAction}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.surface },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl },
  column: { width: '100%', maxWidth: AUTH_MAX_WIDTH, alignSelf: 'center' },
  spacer: { flex: 1, minHeight: spacing['2xl'] },

  header: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing['3xl'] },
  brand: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: theme.textPrimary,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 30,
    fontWeight: fontWeight.bold,
    color: theme.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  field: { gap: spacing.sm, marginBottom: spacing.xl },
  label: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: theme.textPrimary },
  hint: { fontSize: fontSize.sm, color: theme.textSecondary },
  error: { fontSize: fontSize.sm, color: theme.danger },
  formError: {
    fontSize: fontSize.base,
    color: theme.danger,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  input: {
    height: FIELD_HEIGHT,
    backgroundColor: theme.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.md,
    color: theme.textPrimary,
    ...Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
  },
  inputError: { borderColor: theme.danger },

  row: {
    height: FIELD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: theme.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: spacing.lg,
  },
  rowDisabled: { opacity: 0.6 },
  rowDivider: { width: 1, height: 22, backgroundColor: theme.border },
  rowInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: theme.textPrimary,
    ...Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
  },
  passwordInput: { marginLeft: -spacing.xs },
  prefix: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: theme.textPrimary },

  otpRow: { flexDirection: 'row', gap: spacing.sm, position: 'relative' },
  otpBox: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 56,
    backgroundColor: theme.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: { borderColor: theme.primary, backgroundColor: theme.surface },
  otpBoxError: { borderColor: theme.danger },
  otpChar: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: theme.textPrimary },
  otpHiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    // Native par opacity 0 kaafi hai; web par color transparent bhi chahiye,
    // warna autofill ki value ek pal ke liye boxes ke upar dikh jaati hai
    color: 'transparent',
    fontSize: fontSize.xl,
    ...Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
  },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  switchPrompt: { fontSize: fontSize.md, color: theme.textSecondary },
  switchAction: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: theme.primary },
});
