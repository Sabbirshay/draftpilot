'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { provisionUser, ProvisionResponse } from '@/lib/api';

interface OnboardingState {
  gmail_connected: boolean;
  first_macro_added: boolean;
  extension_installed: boolean;
  viewed_demo: boolean;
}

interface DbUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  team_id: string;
  role: string;
  teams: {
    id: string;
    name: string;
    plan: string;
  };
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  dbUser: DbUser | null;
  onboardingState: OnboardingState | null;
  isFirstLogin: boolean;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, teamName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshOnboardingState: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleProvision = useCallback(async (accessToken: string) => {
    try {
      const result: ProvisionResponse = await provisionUser(accessToken);
      setDbUser(result.user);
      setOnboardingState(result.onboardingState);
      setIsFirstLogin(result.isFirstLogin);

      // Also store in localStorage for the DashboardHeader (backward compat)
      if (typeof window !== 'undefined') {
        localStorage.setItem('draftpilot_token', accessToken);
        localStorage.setItem('draftpilot_user', JSON.stringify(result.user));
      }
    } catch (err) {
      console.error('Provision failed:', err);
      // If provision fails (e.g., API not running), still allow access with session
    }
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.access_token) {
        handleProvision(s.access_token).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        setSession(s);
        setUser(s?.user ?? null);

        if (event === 'SIGNED_IN' && s?.access_token) {
          await handleProvision(s.access_token);
        }

        if (event === 'SIGNED_OUT') {
          setDbUser(null);
          setOnboardingState(null);
          setIsFirstLogin(false);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('draftpilot_token');
            localStorage.removeItem('draftpilot_user');
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [handleProvision]);

  const signInWithGoogle = async () => {
    const redirectUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : undefined;

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, teamName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: email.split('@')[0],
          team_name: teamName || `${email.split('@')[0]}'s Team`,
        },
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const refreshOnboardingState = async () => {
    if (session?.access_token && dbUser) {
      try {
        const { getOnboardingState } = await import('@/lib/api');
        const state = await getOnboardingState(session.access_token);
        setOnboardingState(state);
      } catch (err) {
        console.error('Failed to refresh onboarding state:', err);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        dbUser,
        onboardingState,
        isFirstLogin,
        isLoading,
        signInWithGoogle,
        signInWithEmail,
        signUp,
        signOut,
        refreshOnboardingState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
