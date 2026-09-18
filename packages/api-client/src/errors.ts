import type { ApiError } from '@nearbux/types';

/**
 * Har failure ek ApiClientError banti hai — network, HTTP, ya validation.
 *
 * UI ko `code` par branch karna chahiye, `message` par nahi. Messages badalte
 * rehte hain (aur localise ho sakte hain); codes contract hain.
 */
export class ApiClientError extends Error implements ApiError {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  /** Server tak pahunche hi nahi — offline, DNS, timeout */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /** Retry karna safe hai */
  get isRetryable(): boolean {
    return this.isNetworkError || this.status >= 500 || this.status === 429;
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }
}

export const ERROR_CODES = {
  NETWORK: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  UNKNOWN: 'INTERNAL_ERROR',
} as const;
