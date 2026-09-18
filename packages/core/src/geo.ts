import type { Coordinates } from '@nearbux/types';

const EARTH_RADIUS_KM = 6371;

/**
 * Haversine distance. Yeh UI display ke liye hai ("1.2 km").
 * Nearby-store QUERY server par `earthdistance` + GiST index se hoti hai —
 * har store ko JS mein loop karke filter karna scale nahi karega.
 */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** "1.2 km" / "800 m" */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
