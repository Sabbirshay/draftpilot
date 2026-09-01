'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const DEFAULT_ADMIN_EMAILS = [
  'mdronykhan4633@gmail.com',
  'mdronykhan4632@gmail.com',
  'admin@draftpilot.app',
  'admin@draftpilot.com',
];

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passkey, setPasskey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const emailClean = email.trim().toLowerCase();
      const envAdminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const allAdminEmails = [...DEFAULT_ADMIN_EMAILS, ...envAdminEmails];

      if (!allAdminEmails.includes(emailClean)) {
        throw new Error('This account does not have Superadmin privileges.');
      }

      const passkeyClean = passkey.trim();
      if (!passkeyClean) {
        throw new Error('Master Security Passkey is required for Superadmin login.');
      }

      // Verify passkey against server API
      const verifyRes = await fetch('/api/admin/metrics', {
        headers: { 'x-admin-passkey': passkeyClean },
      });
      if (!verifyRes.ok) {
        throw new Error('Invalid Superadmin Master Passkey.');
      }

      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: emailClean,
        password,
      });

      if (authErr) throw authErr;

      if (data.user) {
        sessionStorage.setItem('draftpilot_admin_unlocked', 'true');
        sessionStorage.setItem('draftpilot_admin_passkey', passkeyClean);
        window.location.href = '/admin';
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-red-500/10 blur-[160px] rounded-full pointer-events-none -z-10" />

      <div className="w-full max-w-md bg-elevated/90 border border-border/80 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shadow-[0_0_25px_rgba(239,68,68,0.25)]">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-text">SuperAdmin Login</h1>
          <p className="text-xs text-text-muted mt-1 font-mono">Restricted Access · Root Control</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-mono">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 font-mono">
              Admin Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@draftpilot.app"
              className="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 font-mono">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 font-mono">
              Master Security Passkey
            </label>
            <input
              type="password"
              required
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-accent to-purple-600 hover:from-accent-hover hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-accent/25 transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? 'Authenticating...' : 'Sign In as SuperAdmin →'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-border/60 text-center">
          <Link href="/login" className="text-xs text-text-muted hover:text-text">
            ← Back to Customer Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
