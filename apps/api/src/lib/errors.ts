/**
 * Ek hi error shape poore API mein. Client `code` par branch karta hai,
 * `message` par nahi — messages badalte rehte hain, codes contract hain.
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  badRequest: (message: string, details?: unknown) =>
    new AppError(400, 'BAD_REQUEST', message, details),

  unauthorized: (message = 'Authentication required') =>
    new AppError(401, 'UNAUTHORIZED', message),

  forbidden: (message = 'You do not have access to this resource') =>
    new AppError(403, 'FORBIDDEN', message),

  notFound: (resource: string) => new AppError(404, 'NOT_FOUND', `${resource} not found`),

  conflict: (code: string, message: string, details?: unknown) =>
    new AppError(409, code, message, details),

  tooManyRequests: (message = 'Too many requests. Please try again shortly.') =>
    new AppError(429, 'TOO_MANY_REQUESTS', message),

  internal: (message = 'Something went wrong') => new AppError(500, 'INTERNAL_ERROR', message),
} as const;
