'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

export default function SecuritySettings() {
  const { user, signOut } = useAuth();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    // Defensive client validation
    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasLetter || !hasNumber) {
      setErrorMessage('Password must contain at least one letter and at least one numeral.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      setSuccessMessage('Password updated successfully. Please use your new credentials on your next sign-in.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Password update failed:', err);
      setErrorMessage(err?.message || 'Failed to update password. Please check your session.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSignOutGlobal = async () => {
    if (!window.confirm('Are you sure you want to sign out of all active browser sessions and extensions?')) {
      return;
    }

    setIsSigningOutAll(true);
    try {
      await supabase.auth.signOut({ scope: 'global' });
      await signOut();
    } catch (err) {
      console.warn('Global sign out warning:', err);
      await signOut();
    } finally {
      setIsSigningOutAll(false);
    }
  };

  const handleCopyUid = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  const isEmailVerified = user?.email_confirmed_at !== null && user?.email_confirmed_at !== undefined;
  const lastSignInFormatted = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown';

  return (
    <div className="space-y-8">
      {/* ─────────────────────────────────────────────────────────────
          1. PASSWORD UPDATE SECTION
      ───────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-text">Security &amp; Authentication</h3>
          <p className="text-xs text-text-dim">
            Update your master password and manage active authentication tokens.
          </p>
        </div>

        {successMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
            <span>✓</span>
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="p-5 rounded-2xl bg-elevated/50 border border-border/70 space-y-4">
          <h4 className="text-xs font-bold text-text uppercase tracking-wider font-mono">
            Change Master Password
          </h4>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-dim mb-1.5">
                New Password <span className="text-accent">*</span>
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-elevated/70 border border-border text-xs text-text focus:outline-none focus:border-accent shadow-inner transition-colors"
              />
              <span className="text-[10px] text-text-dim mt-1 block">
                Minimum 8 characters with at least one letter and one number.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-dim mb-1.5">
                Confirm New Password <span className="text-accent">*</span>
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-elevated/70 border border-border text-xs text-text focus:outline-none focus:border-accent shadow-inner transition-colors"
              />
              <span className="text-[10px] text-text-dim mt-1 block">
                Re-enter matching password to confirm.
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isUpdatingPassword || !newPassword}
              className="px-6 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-[0_0_15px_rgba(124,58,237,0.4)] disabled:opacity-50 cursor-pointer transition-all flex items-center gap-2"
            >
              {isUpdatingPassword ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. ACCOUNT AUTHENTICATION STATUS & AUDIT
      ───────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-text uppercase tracking-wider font-mono">
          Authentication Telemetry &amp; Session Controls
        </h4>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-elevated/40 border border-border/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-dim">Email Verification</span>
              {isEmailVerified ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">
                  ● Verified
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold">
                  Pending Verification
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted">
              {user?.email}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-elevated/40 border border-border/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-dim">Last Authenticated Session</span>
              <span className="text-text-dim font-mono text-[10px]">Active</span>
            </div>
            <p className="text-[11px] text-text-muted font-mono">
              {lastSignInFormatted}
            </p>
          </div>
        </div>

        {/* User UUID */}
        <div className="p-4 rounded-2xl bg-elevated/40 border border-border/70 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-text">Supabase Auth User ID</span>
            <p className="text-[11px] text-text-dim font-mono truncate max-w-md">
              {user?.id || 'No authenticated ID'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyUid}
            className="px-3 py-1.5 rounded-xl bg-elevated hover:bg-white/10 text-xs font-medium text-accent-light border border-border transition-colors shrink-0 cursor-pointer"
          >
            {copiedUid ? 'Copied! ✓' : 'Copy UID'}
          </button>
        </div>

        {/* Global Sign Out Button */}
        <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h5 className="text-xs font-bold text-red-400">Revoke All Active Sessions</h5>
            <p className="text-[11px] text-text-dim mt-0.5">
              Force signs out this account across all browser tabs, devices, and the Chrome Extension.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOutGlobal}
            disabled={isSigningOutAll}
            className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
          >
            {isSigningOutAll ? 'Signing Out...' : 'Sign Out Everywhere'}
          </button>
        </div>
      </div>
    </div>
  );
}
