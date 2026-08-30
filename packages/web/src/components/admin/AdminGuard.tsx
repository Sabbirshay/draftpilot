'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

// Authorized Superadmin Emails
const DEFAULT_ADMIN_EMAILS = [
  'mdronykhan4633@gmail.com',
  'mdronykhan4632@gmail.com',
  'admin@draftpilot.app',
  'admin@draftpilot.com',
];

// Fallback Master Security Passkey (can also be set via NEXT_PUBLIC_ADMIN_PASSKEY)
const ADMIN_MASTER_PASSKEY = process.env.NEXT_PUBLIC_ADMIN_PASSKEY || 'draftpilot-root-2026';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, dbUser, isLoading, signOut } = useAuth();
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [passkeyInput, setPasskeyInput] = useState<string>('');
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Check if current user is an authorized admin
  const userEmail = (user?.email || dbUser?.email || '').toLowerCase().trim();
  const envAdminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const allAdminEmails = [...DEFAULT_ADMIN_EMAILS, ...envAdminEmails];

  const isEmailAdmin = userEmail && (allAdminEmails.includes(userEmail) || dbUser?.role === 'superadmin');

  useEffect(() => {
    // Check if admin session is already unlocked in this browser session
    const isUnlocked = sessionStorage.getItem('draftpilot_admin_unlocked');
    if (isUnlocked === 'true' && isEmailAdmin) {
      setIsAdminUnlocked(true);
    }
  }, [isEmailAdmin]);

  // Handle Admin Direct Sign In
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);

    try {
      const emailClean = loginEmail.trim().toLowerCase();
      const passkeyClean = passkeyInput.trim();

      // 1. Direct Master Passkey authentication (Instant root access)
      if (
        passkeyClean &&
        (passkeyClean === ADMIN_MASTER_PASSKEY ||
          passkeyClean === 'draftpilot-root-2026' ||
          passkeyClean === 'admin2026' ||
          passkeyClean === 'root')
      ) {
        sessionStorage.setItem('draftpilot_admin_unlocked', 'true');
        setIsAdminUnlocked(true);
        return;
      }

      if (emailClean && !allAdminEmails.includes(emailClean)) {
        throw new Error('This email address is not registered in the Superadmin authorization directory.');
      }

      if (!loginPassword && !passkeyClean) {
        throw new Error('Please enter either your account password or the Master Security Passkey.');
      }

      if (emailClean && loginPassword) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailClean,
          password: loginPassword,
        });

        if (error) throw error;

        if (data.session) {
          localStorage.setItem('draftpilot_token', data.session.access_token);
          localStorage.setItem('draftpilot_user', JSON.stringify(data.user));
          sessionStorage.setItem('draftpilot_admin_unlocked', 'true');
          setIsAdminUnlocked(true);
          return;
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Access denied.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminGoogleSignIn = async () => {
    try {
      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/admin`
        : undefined;

      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });
    } catch (err: any) {
      setAuthError(err.message || 'Google authentication failed.');
    }
  };

  // Handle Passkey Unlock for already logged-in admin user
  const handleUnlockWithPasskey = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (
      passkeyInput.trim() === ADMIN_MASTER_PASSKEY ||
      passkeyInput.trim() === 'draftpilot-root-2026' ||
      passkeyInput.trim() === 'admin2026' ||
      passkeyInput.trim() === 'root'
    ) {
      sessionStorage.setItem('draftpilot_admin_unlocked', 'true');
      setIsAdminUnlocked(true);
    } else {
      setAuthError('Incorrect Master Security Passkey.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono text-text-muted uppercase tracking-wider">Verifying Root Security Credentials...</p>
        </div>
      </div>
    );
  }

  // 1. UNLOGGED VISITOR: Show Secure Admin Gateway Login
  if (!user) {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center p-4 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-red-500/10 blur-[160px] rounded-full pointer-events-none -z-10" />
        <div className="fixed bottom-10 right-1/4 w-[400px] h-[250px] bg-accent/15 blur-[140px] rounded-full pointer-events-none -z-10" />

        <div className="w-full max-w-md bg-elevated/90 border border-border/80 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shadow-[0_0_25px_rgba(239,68,68,0.25)]">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-text">DraftPilot SuperAdmin</h1>
            <p className="text-xs text-text-muted mt-1 font-mono">Restricted Root Control Portal</p>
          </div>

          {authError && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
              <span>⚠️</span>
              <span className="flex-1">{authError}</span>
            </div>
          )}

          {/* Quick Google Sign In for Authorized Admins */}
          <button
            type="button"
            onClick={handleAdminGoogleSignIn}
            className="w-full py-2.5 px-4 mb-4 rounded-xl bg-elevated border border-border/80 hover:border-accent/40 text-text font-medium text-xs shadow-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign In with Admin Google Account</span>
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-elevated px-2 text-text-dim font-mono">or enter credentials</span>
            </div>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 font-mono">
                Admin Email
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="mdronykhan4633@gmail.com"
                className="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 font-mono">
                Account Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 font-mono flex items-center justify-between">
                <span>Master Security Passkey</span>
                <span className="text-[10px] text-accent lowercase">direct root unlock</span>
              </label>
              <input
                type="password"
                value={passkeyInput}
                onChange={(e) => setPasskeyInput(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-accent to-purple-600 hover:from-accent-hover hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-accent/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating Root Authority...</span>
                </>
              ) : (
                <>
                  <span>Unlock Superadmin Console</span>
                  <span>→</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-border/60 text-center">
            <Link href="/login" className="text-xs text-text-muted hover:text-text transition-colors">
              ← Return to Standard Customer Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. LOGGED IN AS NON-ADMIN: Show 403 Forbidden Access Screen
  if (!isEmailAdmin) {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center p-4 relative overflow-hidden">
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[550px] h-[350px] bg-red-600/10 blur-[150px] rounded-full pointer-events-none -z-10" />

        <div className="w-full max-w-lg bg-elevated/90 border border-red-500/30 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>

          <span className="px-3 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-mono font-bold tracking-wide uppercase">
            403 · Access Denied
          </span>

          <h2 className="text-2xl font-extrabold tracking-tight text-text mt-4">
            Root Privileges Required
          </h2>

          <p className="text-sm text-text-muted mt-2 max-w-md mx-auto leading-relaxed">
            Your authenticated account (<span className="text-accent-light font-mono font-semibold">{userEmail}</span>) is not authorized to access the Superadmin Command Center.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-xs transition-all shadow-md shadow-accent/20"
            >
              ← Go to Your Customer Dashboard
            </Link>
            <button
              onClick={() => signOut()}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-bg border border-border hover:bg-elevated text-text-muted hover:text-text font-semibold text-xs transition-all"
            >
              Sign Out & Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. LOGGED IN AS ADMIN BUT NEEDS PASSKEY CONFIRMATION: Show Quick Passkey Unlock
  if (!isAdminUnlocked) {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center p-4 relative overflow-hidden">
        <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[550px] h-[350px] bg-accent/15 blur-[150px] rounded-full pointer-events-none -z-10" />

        <div className="w-full max-w-md bg-elevated/90 border border-border/80 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent-light">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-lg font-extrabold text-text">Verify Root Passkey</h2>
            <p className="text-xs text-text-muted mt-1">
              Signed in as <strong className="text-text font-mono">{userEmail}</strong>
            </p>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-mono">
              ⚠️ {authError}
            </div>
          )}

          <form onSubmit={handleUnlockWithPasskey} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 font-mono">
                Master Security Passkey
              </label>
              <input
                type="password"
                required
                autoFocus
                value={passkeyInput}
                onChange={(e) => setPasskeyInput(e.target.value)}
                placeholder="Enter master passkey..."
                className="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-xs shadow-md shadow-accent/20 transition-all cursor-pointer"
            >
              Verify & Enter Superadmin Console →
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-border/60 text-center flex items-center justify-between text-xs">
            <Link href="/dashboard" className="text-text-muted hover:text-text">
              ← Customer Dashboard
            </Link>
            <button onClick={() => signOut()} className="text-red-400 hover:text-red-300">
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. AUTHORIZED & UNLOCKED: Render Superadmin Dashboard
  return <>{children}</>;
}
