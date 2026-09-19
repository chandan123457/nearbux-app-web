import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { UserProfile } from '@nearbux/types';
import { api, apiClient, setUnauthenticatedHandler } from './api';

interface SessionValue {
  user: UserProfile | null;
  /** Pehli session establish ho rahi hai */
  isLoading: boolean;
  /** Koi bhi session hai — guest bhi. API calls iske baad safe hain. */
  hasSession: boolean;
  /** Verified phone hai (guest nahi) */
  isVerified: boolean;
  signIn: (user: UserProfile) => void;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Session lifecycle.
 *
 * Har device ko pehli launch par ek ANONYMOUS account milta hai. Iska matlab
 * cart, orders aur profile shuru se kaam karte hain — koi sign-in wall nahi.
 * Phone tab maanga jaata hai jab woh sach mein zaroori ho (checkout), aur
 * verify karne par wahi account upgrade hota hai, naya nahi banta, isliye
 * guest ka cart aur orders bach jaate hain.
 *
 * Sign out karne par turant ek NAYA guest session banti hai. User kabhi
 * bina session ke nahi rehta, isliye kisi screen ko "signed out" state
 * handle karne ki zaroorat hi nahi — aur wahi state har jagah bhoolne ki
 * sabse aam galti hai.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  /** Session establish karta hai: restore karo, warna guest banao */
  const establish = useCallback(async (): Promise<UserProfile | null> => {
    if (await apiClient.isSignedIn()) {
      try {
        return await api.me.get();
      } catch {
        // Token dead hai (revoked, expired, ya account delete) — neeche naya
        // guest ban jaayega
        await apiClient.clearTokens();
      }
    }

    try {
      await api.auth.createGuest();
      return await api.me.get();
    } catch {
      // Offline ya server down. App phir bhi chalti hai — discovery guest
      // requests ke bina bhi kaam karti hai, aur agli launch par retry hoga.
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    await apiClient.clearTokens();
    setUser(null);
    // Cache clear karna zaroori hai — warna agla user pichle ka data dekh
    // sakta hai jab tak refetch na ho
    queryClient.clear();
    // Turant naya guest — user ko wall par nahi chhodna
    setUser(await establish());
    void queryClient.invalidateQueries();
  }, [queryClient, establish]);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await api.me.get());
    } catch {
      await signOut();
    }
  }, [signOut]);

  useEffect(() => {
    // Refresh fail hone par (token chori, session revoke, account delete)
    // client yeh handler call karta hai
    setUnauthenticatedHandler(() => {
      void signOut();
    });
  }, [signOut]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const profile = await establish();
      if (cancelled) return;
      setUser(profile);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [establish]);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      isLoading,
      hasSession: user !== null,
      isVerified: user !== null && !user.isGuest,
      signIn: setUser,
      signOut,
      refreshUser,
    }),
    [user, isLoading, signOut, refreshUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}
