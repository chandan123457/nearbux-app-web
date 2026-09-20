/**
 * Platform ka fallback centre (Bengaluru).
 *
 * Yeh sirf tab lagta hai jab device location na de — permission deny, GPS
 * off, ya web par insecure origin. Us halat mein onboarding rukta nahi;
 * address fallback coordinates ke saath save hota hai aur screen user ko
 * saaf batati hai ki stores city centre ke aas-paas ke dikhenge.
 *
 * Baaki har jagah coordinates SERVER par resolve hote hain, user ke default
 * address se — dekho apps/api ka stores.routes.ts. Client se coordinates
 * bhejne par home feed asli address aane se pehle galat shehar dikhata tha.
 */
export const DEFAULT_COORDS = { latitude: 12.9716, longitude: 77.5946 };

export interface Coords {
  latitude: number;
  longitude: number;
}
