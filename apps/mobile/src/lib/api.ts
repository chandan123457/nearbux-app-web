import Constants from 'expo-constants';
import { createApiClient, createEndpoints } from '@nearbux/api-client';
import { tokenStorage } from './token-storage';

/**
 * API base URL.
 *
 * Native par `localhost` DEVICE ko point karta hai, tumhare laptop ko nahi —
 * yeh har developer ko ek baar pareshan karta hai. Dev mein Expo host ka LAN
 * IP nikal lete hain taaki phone laptop ka server dhoondh sake.
 */
function resolveBaseUrl(): string {
  const configured = Constants.expoConfig?.extra?.apiUrl as string | undefined;

  if (configured && !configured.includes('localhost')) return configured;

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost') return `http://${host}:3000`;
  }
  return configured ?? 'http://localhost:3000';
}

let onUnauthenticated: (() => void) | null = null;

/** Root layout ise register karta hai taaki dead session sign-in par bheje */
export function setUnauthenticatedHandler(handler: () => void) {
  onUnauthenticated = handler;
}

export const apiClient = createApiClient({
  baseUrl: resolveBaseUrl(),
  storage: tokenStorage,
  onAuthFailure: () => onUnauthenticated?.(),
});

export const api = createEndpoints(apiClient);
export { tokenStorage };
