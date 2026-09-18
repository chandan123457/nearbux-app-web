/**
 * Delivery coordinates.
 *
 * Har discovery call ko lat/lng chahiye. User ke saved address se lete hain,
 * uske na hone par Bengaluru centre — taaki naya user pehli baar app kholte
 * hi khaali screen na dekhe. Asli GPS permission flow baad mein.
 */
export const DEFAULT_COORDS = { latitude: 12.9716, longitude: 77.5946 };

export interface Coords {
  latitude: number;
  longitude: number;
}

export function coordsFrom(address: Coords | null | undefined): Coords {
  return address ? { latitude: address.latitude, longitude: address.longitude } : DEFAULT_COORDS;
}
