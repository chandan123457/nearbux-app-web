import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MapPin, TriangleAlert } from 'lucide-react-native';
import { onboardingAddressSchema } from '@nearbux/validation';
import { ApiClientError } from '@nearbux/api-client';
import { fontSize, radius, spacing, theme } from '@nearbux/ui';
import {
  AuthHeader,
  AuthScreen,
  Field,
  FormError,
  TextField,
} from '../../src/components/AuthForm';
import { GradientButton } from '../../src/components/GradientButton';
import { api } from '../../src/lib/api';
import { resolveCurrentPlace, type ResolvedPlace } from '../../src/lib/geocode';
import { useSession } from '../../src/lib/session';

/**
 * Screen [4] — Add your address (onboarding ka aakhri step).
 *
 * Yeh step optional nahi hai. Poori discovery — nearby stores, distance sort,
 * delivery radius — coordinates par chalti hai; bina address ke home feed ya
 * to khaali hoga ya kisi random default city ka.
 *
 * Fields sirf do hain. Baaki sab (city, state, pincode, lat/lng) device ki
 * location se aata hai: onboarding ke beech mein paanch aur fields bharwana
 * wahi jagah hai jahan sabse zyada log drop karte hain.
 */
export default function AddressScreen() {
  const { refreshUser } = useSession();

  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [place, setPlace] = useState<ResolvedPlace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Location screen khulte hi maangte hain, "Continue" par nahi.
   *
   * Permission dialog aur GPS fix dono mein waqt lagta hai. Submit par
   * maangne se user ko ek tap ke baad rukna padta hai aur lagta hai button
   * kaam nahi kiya — jabki yahan woh address type karte waqt background
   * mein ho jaata hai.
   */
  useEffect(() => {
    let cancelled = false;
    void resolveCurrentPlace().then((resolved) => {
      if (!cancelled) setPlace(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleContinue() {
    if (!place) return;
    setError(null);
    setFieldError(null);

    const parsed = onboardingAddressSchema.safeParse({
      line1,
      line2: line2.trim() || null,
      latitude: place.latitude,
      longitude: place.longitude,
      ...(place.city ? { city: place.city } : {}),
      ...(place.state ? { state: place.state } : {}),
      ...(place.pincode ? { pincode: place.pincode } : {}),
    });

    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Please enter your address');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.addresses.createOnboarding(parsed.data);
      // Profile dobara laao — `hasAddress` ab true hai, aur gate khud home
      // par le jaayega. Yahan se navigate karna us decision ko do jagah
      // rakh deta.
      await refreshUser();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Could not save your address. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreen
      footer={
        <GradientButton
          label="Continue"
          shape="pill"
          onPress={handleContinue}
          loading={isSubmitting}
          disabled={line1.trim().length < 3 || place === null}
        />
      }
    >
      <AuthHeader
        title="Add your address"
        subtitle="Find and shop the best local stores near you"
      />

      <Field label="Home Address" error={fieldError}>
        <TextField
          value={line1}
          onChangeText={(next) => {
            setLine1(next);
            setFieldError(null);
          }}
          placeholder="House / flat no, building, street"
          autoCapitalize="words"
          autoComplete="street-address"
          hasError={Boolean(fieldError)}
        />
      </Field>

      <Field label="Additional Address (Optional)">
        <TextField
          value={line2}
          onChangeText={setLine2}
          placeholder="Area, landmark"
          autoCapitalize="words"
          onSubmitEditing={handleContinue}
        />
      </Field>

      <LocationStatus place={place} />

      <FormError message={error} />
    </AuthScreen>
  );
}

/**
 * Location ka status saaf dikhana zaroori hai.
 *
 * Permission deny hone par hum fallback coordinates use karte hain, aur us
 * halat mein "Stores near you" asal mein user ke paas ke stores nahi hote.
 * Yeh chupchaap hona sabse buri baat hogi — user ko lagega app hi kharab
 * hai. Isliye woh state yahan par explicitly likhi jaati hai.
 */
function LocationStatus({ place }: { place: ResolvedPlace | null }) {
  if (place === null) {
    return (
      <View style={styles.status}>
        <ActivityIndicator size="small" color={theme.textSecondary} />
        <Text style={styles.statusText}>Finding your location…</Text>
      </View>
    );
  }

  if (!place.isPrecise) {
    return (
      <View style={[styles.status, styles.statusWarning]}>
        <TriangleAlert size={16} color={theme.warningText} />
        <Text style={[styles.statusText, styles.statusWarningText]}>
          Location is off, so we'll show stores around the city centre. You can update your
          address any time from your profile.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.status}>
      <MapPin size={16} color={theme.successText} />
      <Text style={styles.statusText}>
        {place.label
          ? `Using your current location · ${place.label}`
          : 'Using your current location'}
        {place.pincode ? ` · ${place.pincode}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: theme.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  statusWarning: { backgroundColor: theme.warningSubtle, alignItems: 'flex-start' },
  statusText: { flex: 1, fontSize: fontSize.sm, color: theme.textSecondary, lineHeight: 19 },
  statusWarningText: { color: theme.warningText },
});
