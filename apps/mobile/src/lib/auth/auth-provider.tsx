import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { clearAllLocalData } from '@/lib/sqlite/clear-local-data';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; session: Session; profile: Profile };

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) {
    return null;
  }
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let isMounted = true;

    async function loadFromSession(session: Session | null) {
      if (!session) {
        if (isMounted) setState({ status: 'signedOut' });
        return;
      }
      const profile = await fetchProfile(session.user.id);
      if (!isMounted) return;
      if (!profile) {
        // Session exists but the profile row couldn't be read (e.g. RLS
        // denied it, or it hasn't been created yet) — treat as signed out
        // rather than crashing the app on a null profile.
        setState({ status: 'signedOut' });
        return;
      }
      setState({ status: 'signedIn', session, profile });
    }

    supabase.auth.getSession().then(({ data }) => loadFromSession(data.session));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      loadFromSession(session);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut: AuthContextValue['signOut'] = async () => {
    await supabase.auth.signOut();
    try {
      // Always clear the local cache/outbox on sign-out, so a different
      // account signing in on this device next never sees a previous
      // worker's cached customers or queued deliveries. Best-effort: a
      // failure here must never block sign-out itself.
      clearAllLocalData();
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
