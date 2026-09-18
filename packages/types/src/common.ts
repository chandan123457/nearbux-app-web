export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** API error envelope — client isi shape par depend karta hai */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };
