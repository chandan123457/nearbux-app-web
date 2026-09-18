import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { UserProfile } from '@nearbux/types';
import { api, apiClient, setUnauthenticatedHandler } from './api';

interface SessionValue {
  user: UserProfile | null;
  /** App boot par storage check chal raha hai */
  isLoading: boolean;
  isSignedIn: boolean;
  signIn: (user: UserProfile) => void;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const signOut = useCallback(async () => {
    await apiClient.clearTokens();
    setUser(null);
    // Cache clear karna zaroori hai — warna agla user pichle user ka data
    // dekh sakta hai jab tak refetch na ho jaaye
    queryClient.clear();
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await api.me.get());
    } catch {
      await signOut();
    }
  }, [signOut]);

  useEffect(() => {
    // Refresh fail hone par (token chori, session expired, account delete)
    // client yeh handler call karta hai
    setUnauthenticatedHandler(() => {
      void signOut();
    });
  }, [signOut]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Boot par: agar refresh token hai to profile fetch karke session
      // restore karo. Access token expire ho chuka hoga — client use
      // chupchaap refresh kar lega.
      if (await apiClient.isSignedIn()) {
        try {
          const profile = await api.me.get();
          if (!cancelled) setUser(profile);
        } catch {
          if (!cancelled) await apiClient.clearTokens();
        }
      }
      if (!cancelled) setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      isLoading,
      isSignedIn: user !== null,
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
