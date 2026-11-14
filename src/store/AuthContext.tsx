import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface AuthContextValue {
  signedIn: boolean;
  loading: boolean;
  /** Returns an error message, or null on success. */
  signIn: (passcode: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/session', { credentials: 'same-origin' })
      .then(res => setSignedIn(res.ok))
      .catch(() => setSignedIn(false))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (passcode: string) => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        setSignedIn(true);
        return null;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return body.error ?? 'Could not sign in.';
    } catch {
      return 'Could not reach the server. Check your connection.';
    }
  }, []);

  const signOut = useCallback(async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    setSignedIn(false);
  }, []);

  return (
    <AuthContext.Provider value={{ signedIn, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
