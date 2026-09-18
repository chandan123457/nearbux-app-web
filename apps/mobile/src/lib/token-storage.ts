import { createMemoryTokenStorage, type TokenStorage } from '@nearbux/api-client';

/**
 * Fallback jab koi platform-specific file match na ho.
 *
 * Practice mein Metro hamesha `.native.ts` ya `.web.ts` chunta hai. Yeh file
 * static web build ke Node pre-render pass ke liye hai, jahan na SecureStore
 * hai na localStorage. Memory storage matlab pre-render hamesha
 * signed-out render karta hai, jo sahi hai — build-time HTML kisi khaas user
 * ka nahi hona chahiye.
 */
export const tokenStorage: TokenStorage = createMemoryTokenStorage();
