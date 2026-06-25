import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getSupabase } from '../utils/supabase';
import { useProfile } from '../hooks/useProfile';
import { queryClient } from '../lib/queryClient';
import { readSsoCookie, writeSsoCookie, clearSsoCookie } from '../utils/ssoCookie';
import { notifySignupIfNeeded } from '../utils/accountNotifications';

interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  role: 'admin' | 'user';
  subscriptionTier: 'free' | 'premium';
  subscriptionExpiresAt?: string;
  stripeCustomerId?: string;
  subscriptionStatus?: 'active' | 'canceling' | 'canceled' | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: (nextPath?: string) => Promise<void>;
  signInWithApple: (nextPath?: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (
    email: string,
    password: string,
    nextPath?: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function setAuthNextCookie(nextPath: string) {
  const safeNextPath =
    nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/';
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `whatif_auth_next=${encodeURIComponent(
    safeNextPath,
  )}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const notifiedSignupUserIdsRef = useRef<Set<string>>(new Set());
  const pendingSignupNotificationUserIdsRef = useRef<Set<string>>(new Set());

  // Use React Query for profile fetching
  const { data: profileData, isLoading: profileLoading } = useProfile(user?.id);

  useEffect(() => {
    let isActive = true;
    let unsubscribe: (() => void) | undefined;

    const bootstrapAuth = async () => {
      try {
        const supabase = await getSupabase();

        if (!isActive) {
          return;
        }

        console.log('[AuthContext] Getting initial session...');
        let { data: { session } } = await supabase.auth.getSession();

        if (!isActive) {
          return;
        }

        // Cross-subdomain SSO: if there is no local session but the shared
        // cookie (set by whatif-ep.xyz) carries tokens, adopt that session.
        // Any failure (invalid/expired tokens) falls back to logged-out.
        if (!session) {
          try {
            const ssoTokens = readSsoCookie();
            if (ssoTokens) {
              const { data: ssoData, error: ssoError } = await supabase.auth.setSession({
                access_token: ssoTokens.access_token,
                refresh_token: ssoTokens.refresh_token,
              });
              if (!ssoError && ssoData.session) {
                session = ssoData.session;
              }
            }
          } catch {
            // Ignore SSO failures; continue as logged-out.
          }
        }

        if (!isActive) {
          return;
        }

        console.log('[AuthContext] Got session:', session);
        setSession(session);
        setUser(session?.user ?? null);
        setAuthLoading(false);

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, nextSession) => {
          setSession(nextSession);
          setUser(nextSession?.user ?? null);
          setAuthLoading(false);

          // Keep the shared SSO cookie in sync (side-effect only; never
          // call setSession from here to avoid auth-event loops).
          try {
            // Only a confirmed sign-out should delete the shared cookie. A null
            // local session on this subdomain does not prove the sibling app is
            // also signed out, so clearing here can break cross-subdomain SSO.
            if (event === 'SIGNED_OUT') {
              clearSsoCookie();
            } else if (
              event === 'INITIAL_SESSION' ||
              event === 'SIGNED_IN' ||
              event === 'TOKEN_REFRESHED'
            ) {
              if (nextSession?.access_token && nextSession?.refresh_token) {
                writeSsoCookie({
                  access_token: nextSession.access_token,
                  refresh_token: nextSession.refresh_token,
                });
              }
            }
          } catch {
            // Never let SSO cookie sync break auth.
          }
        });

        unsubscribe = () => subscription.unsubscribe();
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.error('[AuthContext] Error getting session:', error);
        setAuthLoading(false);
      }
    };

    bootstrapAuth();

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, []);

  const oauthRedirectTo = `${window.location.origin}/auth/callback`;

  const signInWithGoogle = async (nextPath = '/') => {
    setAuthNextCookie(nextPath);
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: oauthRedirectTo,
      },
    });
    if (error) {
      console.error('Error signing in with Google:', error.message);
    }
  };

  const signInWithApple = async (nextPath = '/') => {
    setAuthNextCookie(nextPath);
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: oauthRedirectTo,
      },
    });
    if (error) {
      console.error('Error signing in with Apple:', error.message);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  const signUpWithEmail = async (email: string, password: string, nextPath = '/') => {
    setAuthNextCookie(nextPath);
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: oauthRedirectTo,
      },
    });
    return {
      error: error?.message || null,
      needsConfirmation: !error && !data?.session,
    };
  };

  const resetPassword = async (email: string) => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    return { error: error?.message || null };
  };

  const updatePassword = async (password: string) => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message || null };
  };

  const signOut = async () => {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      console.error('Error signing out:', error.message);
    }
    // Ensure the shared SSO cookie is removed even if no event fires.
    clearSsoCookie();
    queryClient.clear();
  };

  // Provide optimistic default profile while loading
  const profile: UserProfile | null = profileData || (user ? {
    id: user.id,
    email: user.email || '',
    fullName: undefined,
    avatarUrl: undefined,
    role: 'user',
    subscriptionTier: 'free',
  } : null);

  const loading = authLoading || (user ? profileLoading : false);

  useEffect(() => {
    if (!user?.id || !session?.access_token || loading) {
      return;
    }

    if (notifiedSignupUserIdsRef.current.has(user.id)) {
      return;
    }

    if (pendingSignupNotificationUserIdsRef.current.has(user.id)) {
      return;
    }

    void (async () => {
      pendingSignupNotificationUserIdsRef.current.add(user.id);

      try {
        const retryDelaysMs = [0, 1500, 4000];

        for (const delayMs of retryDelaysMs) {
          if (delayMs > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, delayMs));
          }

          const result = await notifySignupIfNeeded(session.access_token);
          if (result?.sent || result?.alreadySent || result?.skipped === 'not_recent_signup') {
            notifiedSignupUserIdsRef.current.add(user.id);
            return;
          }

          if (result?.skipped !== 'email_not_verified') {
            return;
          }
        }
      } finally {
        pendingSignupNotificationUserIdsRef.current.delete(user.id);
      }
    })();
  }, [loading, session?.access_token, user?.email_confirmed_at, user?.id]);

  const value = {
    user,
    session,
    profile,
    loading,
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    updatePassword,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
