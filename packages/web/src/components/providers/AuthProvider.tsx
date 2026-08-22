'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { provisionUser, ProvisionResponse } from '@/lib/api';

export interface OnboardingState {
  gmail_connected: boolean;
  first_macro_added: boolean;
  extension_installed: boolean;
  viewed_demo: boolean;
}

export interface DbUser {
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
  updateOnboardingFlag: (updates: Partial<OnboardingState>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to construct a resilient fallback user directly from OAuth / Supabase user session
  const buildUserFromSession = useCallback((authUser: User): DbUser => {
    const email = authUser.email || '';
    const metadata = authUser.user_metadata || {};
    const fullName = metadata.full_name || metadata.name || email.split('@')[0] || 'User';
    const avatarUrl = metadata.avatar_url || metadata.picture || null;
    const teamName = metadata.team_name || `${fullName}'s Team`;

    return {
      id: authUser.id,
      email,
      full_name: fullName,
      avatar_url: avatarUrl,
      team_id: authUser.id,
      role: 'owner',
      teams: {
        id: authUser.id,
        name: teamName,
        plan: 'free',
      },
    };
  }, []);

  const handleProvision = useCallback(async (currentSession: Session) => {
    const authUser = currentSession.user;
    if (!authUser) return;

    // Immediately set a baseline user so UI is never blank or showing placeholder 'agent@company.com'
    const fallbackUser = buildUserFromSession(authUser);
    setDbUser(fallbackUser);

    try {
      // 1. Try server provision endpoint if backend API is reachable
      const result: ProvisionResponse = await provisionUser(currentSession.access_token);
      if (result?.user) {
        setDbUser(result.user);
        setOnboardingState(result.onboardingState);
        setIsFirstLogin(result.isFirstLogin);

        if (typeof window !== 'undefined') {
          localStorage.setItem('draftpilot_token', currentSession.access_token);
          localStorage.setItem('draftpilot_user', JSON.stringify(result.user));
        }
        return;
      }
    } catch (err) {
      console.warn('API provision unreachable, falling back to direct Supabase client sync:', err);
    }

    // 2. Direct client-side Supabase sync (handles serverless/standalone frontend deployments)
    try {
      // Check if user exists in Supabase DB
      const { data: existingUser } = await supabase
        .from('users')
        .select('*, teams(*)')
        .eq('id', authUser.id)
        .maybeSingle();

      if (existingUser) {
        const { data: obState } = await supabase
          .from('onboarding_state')
          .select('*')
          .eq('team_id', existingUser.team_id)
          .maybeSingle();

        const formattedUser: DbUser = {
          id: existingUser.id,
          email: existingUser.email,
          full_name: existingUser.full_name || fallbackUser.full_name,
          avatar_url: existingUser.avatar_url || fallbackUser.avatar_url,
          team_id: existingUser.team_id,
          role: existingUser.role || 'owner',
          teams: existingUser.teams || fallbackUser.teams,
        };

        setDbUser(formattedUser);
        setOnboardingState(obState || {
          gmail_connected: false,
          first_macro_added: false,
          extension_installed: false,
          viewed_demo: false,
        });
        setIsFirstLogin(false);
      } else {
        // First login — default to onboarding state
        setIsFirstLogin(true);
        setOnboardingState({
          gmail_connected: false,
          first_macro_added: false,
          extension_installed: false,
          viewed_demo: false,
        });
      }
    } catch (dbErr) {
      console.warn('Direct Supabase sync note:', dbErr);
      // Ensure onboarding state exists so new users enter onboarding flow
      setOnboardingState({
        gmail_connected: false,
        first_macro_added: false,
        extension_installed: false,
        viewed_demo: false,
      });
      setIsFirstLogin(true);
    }
  }, [buildUserFromSession]);

  useEffect(() => {
    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s) {
        handleProvision(s).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth events (e.g. OAuth redirect callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        setSession(s);
        setUser(s?.user ?? null);

        if (event === 'SIGNED_IN' && s) {
          await handleProvision(s);
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
    const fullName = email.split('@')[0];
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          name: fullName,
          team_name: teamName || `${fullName}'s Team`,
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
    if (session?.user) {
      try {
        const { data } = await supabase
          .from('onboarding_state')
          .select('*')
          .eq('team_id', dbUser?.team_id || session.user.id)
          .maybeSingle();

        if (data) {
          setOnboardingState(data);
        }
      } catch (err) {
        console.error('Failed to refresh onboarding state:', err);
      }
    }
  };

  const updateOnboardingFlag = async (updates: Partial<OnboardingState>) => {
    setOnboardingState((prev) => prev ? { ...prev, ...updates } : null);
    if (session?.user && dbUser?.team_id) {
      try {
        await supabase
          .from('onboarding_state')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('team_id', dbUser.team_id);
      } catch (err) {
        console.error('Failed to update onboarding flag in Supabase:', err);
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
        updateOnboardingFlag,
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
