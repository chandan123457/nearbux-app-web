import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { UserProfile } from '@nearbux/types';
import { api, apiClient, setUnauthenticatedHandler } from './api';

/** App boot par user kahan hona chahiye */
export type OnboardingStage =
  /** Session restore ho rahi hai — kuch mat dikhao */
  | 'loading'
  /** Koi valid session nahi — screen [1] / [2] / [3] */
  | 'unauthenticated'
  /** Signed in, lekin koi delivery address nahi — screen [4] */
  | 'needs-address'
  /** Onboarding poori — home */
  | 'ready';

interface SessionValue {
  user: UserProfile | null;
  stage: OnboardingStage;
  /** Signup / login / password reset ke baad call karo */
  signIn: (user: UserProfile) => void;
  signOut: () => Promise<void>;
  /** Server se profile dobara laao (address add karne ke baad) */
  refreshUser: () => Promise<UserProfile | null>;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Session + onboarding state.
 *
 * App poori tarah sign-in ke peeche hai: account banaye bina koi screen nahi
 * khulti. Onboarding ke teen steps — account, phone verification, address —
 * poore hone par hi home aata hai.
 *
 * Sabse important cheez yeh hai ki stage SERVER ke profile se DERIVE hota
 * hai, local flags se nahi. Onboarding ko screen-to-screen navigation se
 * chalane par user beech mein app band kar de (ya app crash ho jaaye) to
 * agli launch par woh ek adhoori state mein pahunchta hai — signed in, par
 * bina address ke — aur har discovery call ke paas coordinates hi nahi
 * hote. `hasAddress` har `/me` response mein aata hai, isliye woh sawaal har
 * launch par dobara sahi jawab deta hai.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  /** Stored refresh token se session restore karta hai */
  const restore = useCallback(async (): Promise<UserProfile | null> => {
    if (!(await apiClient.isSignedIn())) return null;

    try {
      return await api.me.get();
    } catch {
      // Token dead hai (revoked, expired, password reset, ya account delete).
      // Local tokens clear karo taaki user sign-in par jaaye — warna har
      // request 401 deti rahegi aur app bina kisi wajah ke atki dikhegi.
      await apiClient.clearTokens();
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    await apiClient.clearTokens();
    setUser(null);
    // Cache clear karna zaroori hai — warna agla user pichle ka cart aur
    // orders dekh sakta hai jab tak refetch na ho
    queryClient.clear();
  }, [queryClient]);

  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const profile = await api.me.get();
      setUser(profile);
      return profile;
    } catch {
      await signOut();
      return null;
    }
  }, [signOut]);

  useEffect(() => {
    // Refresh fail hone par (token chori, session revoke, account delete)
    // API client yeh handler call karta hai
    setUnauthenticatedHandler(() => {
      void signOut();
    });
  }, [signOut]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const profile = await restore();
      if (cancelled) return;
      setUser(profile);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [restore]);

  const value = useMemo<SessionValue>(() => {
    const stage: OnboardingStage = isLoading
      ? 'loading'
      : user === null
        ? 'unauthenticated'
        : user.hasAddress
          ? 'ready'
          : 'needs-address';

    return { user, stage, signIn: setUser, signOut, refreshUser };
  }, [user, isLoading, signOut, refreshUser]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}
