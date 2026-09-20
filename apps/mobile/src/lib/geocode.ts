import * as Location from 'expo-location';
import { DEFAULT_COORDS, type Coords } from './location';

/**
 * Screen [4] ka address resolution.
 *
 * User sirf apna ghar ka address likhta hai; city, state, pincode aur —
 * sabse zaroori — coordinates device se aate hain. Onboarding ke beech mein
 * paanch aur fields bharwana wahi jagah hai jahan sabse zyada log drop karte
 * hain.
 *
 * Coordinates hi yahan asli payload hain: poori discovery (nearby stores,
 * distance sort, delivery radius) unhi par chalti hai. City aur pincode
 * sirf display ke liye hain.
 */
export interface ResolvedPlace extends Coords {
  city: string | null;
  state: string | null;
  pincode: string | null;
  /** User ne permission di, ya hum fallback coordinates par hain? */
  isPrecise: boolean;
  /** "Indiranagar, Bengaluru" — screen par confirm dikhane ke liye */
  label: string | null;
}

const FALLBACK: ResolvedPlace = {
  ...DEFAULT_COORDS,
  city: null,
  state: null,
  pincode: null,
  isPrecise: false,
  label: null,
};

/**
 * Location resolve karta hai, aur KABHI throw nahi karta.
 *
 * Har step alag se fail ho sakta hai — permission deny, GPS off, web par
 * insecure origin, ya reverse geocoding ka unavailable hona — aur in mein se
 * koi bhi onboarding ko rokna nahi chahiye. Fail hone par user fallback
 * coordinates ke saath aage badh jaata hai aur address baad mein theek kar
 * sakta hai; ek blocked onboarding screen usse app se hi bahar kar deti hai.
 */
export async function resolveCurrentPlace(): Promise<ResolvedPlace> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return FALLBACK;

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const coords = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };

    // Reverse geocoding web par supported nahi hai (aur native par bhi
    // offline fail ho sakti hai). Coordinates phir bhi mil chuke hain, jo
    // asli zaroorat hai — isliye yeh apne try/catch mein hai.
    try {
      const [place] = await Location.reverseGeocodeAsync(coords);
      if (place) {
        const city = place.city ?? place.subregion ?? null;
        return {
          ...coords,
          city,
          state: place.region ?? null,
          pincode: normalisePincode(place.postalCode),
          isPrecise: true,
          label: [place.district, city].filter(Boolean).join(', ') || null,
        };
      }
    } catch {
      // geocoding unavailable — coordinates ke saath hi aage badho
    }

    return { ...coords, city: null, state: null, pincode: null, isPrecise: true, label: null };
  } catch {
    return FALLBACK;
  }
}

/**
 * Sirf 6-digit Indian PIN codes hi aage jaate hain.
 *
 * Reverse geocoding kabhi-kabhi "560001-1234" jaise extended codes ya doosre
 * deshon ke formats deti hai. Server ka schema 6 digits maangta hai, aur ek
 * galat format poore address save ko 400 kar deta — jabki pincode sirf
 * display ke liye hai. Shaq hone par use chhod dena behtar hai.
 */
function normalisePincode(postalCode: string | null | undefined): string | null {
  const match = postalCode?.match(/^[1-9]\d{5}$/);
  return match ? match[0] : null;
}
