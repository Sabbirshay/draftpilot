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

  // Auto-provisions or retrieves user & team in Supabase via secure server route
  const handleProvision = useCallback(async (currentSession: Session) => {
    const authUser = currentSession.user;
    if (!authUser) return;

    try {
      // 1. Fetch user & team from server route /api/auth/me
      const res = await fetch(`/api/auth/me?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      });

      if (res.ok) {
        const result = await res.json();
        if (result?.user && result?.user?.team_id) {
          setDbUser(result.user);
          setOnboardingState(result.onboardingState);
          setIsFirstLogin(false);

          if (typeof window !== 'undefined') {
            localStorage.setItem('draftpilot_token', currentSession.access_token);
            localStorage.setItem('draftpilot_user', JSON.stringify(result.user));
          }
          return;
        }
      }
    } catch (err) {
      console.warn('API /api/auth/me profile sync notice:', err);
    }

    const email = authUser.email || '';
    const metadata = authUser.user_metadata || {};
    const fullName = metadata.full_name || metadata.name || email.split('@')[0] || 'User';
    const avatarUrl = metadata.avatar_url || metadata.picture || null;
    const defaultTeamName = metadata.team_name || `${fullName}'s Team`;

    // 2. Fallback to direct client-side Supabase query
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('*, teams(*)')
        .eq('id', authUser.id)
        .maybeSingle();

      if (existingUser && existingUser.team_id) {
        const { data: obState } = await supabase
          .from('onboarding_state')
          .select('*')
          .eq('team_id', existingUser.team_id)
          .maybeSingle();

        const formattedUser: DbUser = {
          id: existingUser.id,
          email: existingUser.email,
          full_name: existingUser.full_name || fullName,
          avatar_url: existingUser.avatar_url || avatarUrl,
          team_id: existingUser.team_id,
          role: existingUser.role || 'owner',
          teams: existingUser.teams || {
            id: existingUser.team_id,
            name: defaultTeamName,
            plan: 'free',
          },
        };

        setDbUser(formattedUser);
        setOnboardingState(obState || {
          gmail_connected: false,
          first_macro_added: false,
          extension_installed: false,
          viewed_demo: false,
        });
        setIsFirstLogin(false);

        if (typeof window !== 'undefined') {
          localStorage.setItem('draftpilot_token', currentSession.access_token);
          localStorage.setItem('draftpilot_user', JSON.stringify(formattedUser));
        }
      } else {
        // User not in DB yet: auto-provision Team + User + OnboardingState in Supabase
        const { data: newTeam, error: teamErr } = await supabase
          .from('teams')
          .insert({ name: defaultTeamName })
          .select()
          .single();

        if (teamErr) throw teamErr;

        const { data: newUser, error: userErr } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            team_id: newTeam.id,
            email,
            full_name: fullName,
            avatar_url: avatarUrl,
            role: 'owner',
          })
          .select('*, teams(*)')
          .single();

        if (userErr) throw userErr;

        // Create team_members junction and onboarding_state
        try {
          await supabase.from('team_members').insert({
            team_id: newTeam.id,
            user_id: authUser.id,
            role: 'owner',
          });
        } catch {
          // Ignore
        }

        let newObState = null;
        try {
          const { data } = await supabase
            .from('onboarding_state')
            .insert({ team_id: newTeam.id })
            .select()
            .single();
          newObState = data;
        } catch {
          // Ignore
        }

        const formattedUser: DbUser = {
          id: newUser.id,
          email: newUser.email,
          full_name: fullName,
          avatar_url: avatarUrl,
          team_id: newTeam.id,
          role: 'owner',
          teams: newTeam,
        };

        setDbUser(formattedUser);
        setOnboardingState(newObState || {
          gmail_connected: false,
          first_macro_added: false,
          extension_installed: false,
          viewed_demo: false,
        });
        setIsFirstLogin(true);

        if (typeof window !== 'undefined') {
          localStorage.setItem('draftpilot_token', currentSession.access_token);
          localStorage.setItem('draftpilot_user', JSON.stringify(formattedUser));
        }
      }
    } catch (err) {
      console.error('Supabase auto-provision error:', err);
    }
  }, []);

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

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        setSession(s);
        setUser(s?.user ?? null);

        if (event === 'SIGNED_IN' && s) {
          setIsLoading(true);
          await handleProvision(s);
          setIsLoading(false);
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

  // Real-time synchronization for team plan and quota updates
  useEffect(() => {
    if (!dbUser?.team_id) return;

    const teamChannel = supabase
      .channel(`team-live-${dbUser.team_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `id=eq.${dbUser.team_id}` },
        async (payload: any) => {
          if (payload.new) {
            setDbUser((prev) => {
              if (!prev) return null;
              const updated = {
                ...prev,
                teams: {
                  ...prev.teams,
                  ...payload.new,
                },
              };
              if (typeof window !== 'undefined') {
                localStorage.setItem('draftpilot_user', JSON.stringify(updated));
              }
              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(teamChannel);
    };
  }, [dbUser?.team_id]);

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
    if (dbUser?.team_id) {
      try {
        const { data } = await supabase
          .from('onboarding_state')
          .select('*')
          .eq('team_id', dbUser.team_id)
          .maybeSingle();

        if (data) setOnboardingState(data);
      } catch (err) {
        console.warn('Failed to refresh onboarding state:', err);
      }
    }
  };

  const updateOnboardingFlag = async (updates: Partial<OnboardingState>) => {
    if (!dbUser?.team_id) return;
    try {
      const { data } = await supabase
        .from('onboarding_state')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('team_id', dbUser.team_id)
        .select()
        .maybeSingle();

      if (data) {
        setOnboardingState(data);
      } else {
        setOnboardingState((prev) => prev ? { ...prev, ...updates } : null);
      }
    } catch (err) {
      console.warn('Failed to update onboarding state in Supabase:', err);
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
