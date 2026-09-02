'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export default function AdminPasskeyVault() {
  const [currentPasskey, setCurrentPasskey] = useState<string>('');
  const [showCurrentPasskey, setShowCurrentPasskey] = useState<boolean>(false);
  const [newPasskeyInput, setNewPasskeyInput] = useState<string>('');
  const [showNewPasskey, setShowNewPasskey] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const sessionPasskey = typeof window !== 'undefined' ? sessionStorage.getItem('draftpilot_admin_passkey') : null;
    if (sessionPasskey) {
      headers['x-admin-passkey'] = sessionPasskey;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || (typeof window !== 'undefined' ? localStorage.getItem('draftpilot_token') : null);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // Ignore token fetch errors
    }

    return headers;
  }, []);

  const fetchActivePasskey = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/passkey', { headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch passkey (${res.status})`);
      }
      const data = await res.json();
      setCurrentPasskey(data.passkey || '');
    } catch (err: any) {
      // If server fetch failed, fallback to sessionStorage value if available
      const local = typeof window !== 'undefined' ? sessionStorage.getItem('draftpilot_admin_passkey') : null;
      if (local) {
        setCurrentPasskey(local);
      } else {
        setErrorMessage(err.message || 'Could not load active root passkey.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchActivePasskey();
  }, [fetchActivePasskey]);

  const handleCopyPasskey = async () => {
    if (!currentPasskey) return;
    try {
      await navigator.clipboard.writeText(currentPasskey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy
      const el = document.createElement('textarea');
      el.value = currentPasskey;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleUpdatePasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);

    const clean = newPasskeyInput.trim();
    if (clean.length < 6) {
      setErrorMessage('New passkey must contain at least 6 characters.');
      return;
    }

    setIsSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/passkey', {
        method: 'POST',
        headers,
        body: JSON.stringify({ newPasskey: clean }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update root passkey.');
      }

      // Sync active session storage so current tab continues without 401
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('draftpilot_admin_passkey', clean);
      }

      setCurrentPasskey(clean);
      setNewPasskeyInput('');
      setStatusMessage('Root passkey successfully updated in platform_settings and active session synchronized.');
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while updating the root passkey.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-3xl bg-elevated/70 border border-border/80 p-6 shadow-md hover:border-accent/40 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent-light text-lg shadow-sm">
            🔑
          </div>
          <div>
            <h3 className="text-sm font-bold text-text flex items-center gap-2">
              Root Passkey Vault
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Dynamic Store
              </span>
            </h3>
            <p className="text-[11px] text-text-dim">
              View and manage the master security passkey without restarting server processes.
            </p>
          </div>
        </div>

        <button
          onClick={fetchActivePasskey}
          disabled={isLoading || isSaving}
          className="px-2.5 py-1.5 rounded-xl bg-bg border border-border hover:border-accent text-text text-xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
          title="Reload passkey from server"
        >
          <span>{isLoading ? '⏳' : '🔄'}</span>
          <span className="hidden sm:inline text-[11px] font-medium">Sync</span>
        </button>
      </div>

      {/* Status Alerts */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-4 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span>✓</span>
              <span>{statusMessage}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-emerald-400/80 hover:text-emerald-300 text-xs ml-2 cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}

        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-4 p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400/80 hover:text-red-300 text-xs ml-2 cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-5 space-y-5">
        {/* Section 1: Active Passkey */}
        <div>
          <label className="block text-[11px] font-mono font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Current Active Passkey</span>
            <span className="text-[10px] text-accent lowercase">AES / SHA Verified</span>
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showCurrentPasskey ? 'text' : 'password'}
                readOnly
                value={isLoading ? 'Loading active passkey...' : (currentPasskey || 'No active passkey configured')}
                className="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-xs font-mono text-text outline-none select-all"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPasskey(!showCurrentPasskey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text text-xs cursor-pointer p-1"
                title={showCurrentPasskey ? 'Hide passkey' : 'Show passkey'}
              >
                {showCurrentPasskey ? '🙈 Hide' : '👁️ Show'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyPasskey}
              disabled={!currentPasskey || isLoading}
              className="px-3.5 py-2.5 rounded-xl bg-bg hover:bg-elevated border border-border hover:border-accent text-xs font-bold text-text transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-w-[85px] justify-center"
            >
              <span>{copied ? '✓ Copied!' : '📋 Copy'}</span>
            </button>
          </div>
        </div>

        {/* Section 2: Update Passkey Form */}
        <form onSubmit={handleUpdatePasskey} className="pt-4 border-t border-border/50 space-y-3">
          <div>
            <label className="block text-[11px] font-mono font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Set New Root Passkey</span>
              <span className="text-[10px] text-text-dim font-normal">Min 6 characters</span>
            </label>
            <div className="relative">
              <input
                type={showNewPasskey ? 'text' : 'password'}
                value={newPasskeyInput}
                onChange={(e) => setNewPasskeyInput(e.target.value)}
                placeholder="Enter new master passkey (e.g. DP-Root-2026-X9)..."
                className="w-full px-4 py-2.5 pr-20 rounded-xl bg-bg border border-border text-xs font-mono text-text placeholder:text-text-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowNewPasskey(!showNewPasskey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text text-xs cursor-pointer p-1"
              >
                {showNewPasskey ? '🙈 Hide' : '👁️ Show'}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <p className="text-[10px] text-text-dim leading-tight">
              ⚡ Updating propagates to <span className="font-mono text-accent-light">platform_settings</span> and updates your current active browser session automatically.
            </p>

            <button
              type="submit"
              disabled={isSaving || newPasskeyInput.trim().length < 6}
              className="px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-xs shadow-md shadow-accent/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving &amp; Syncing...</span>
                </>
              ) : (
                <>
                  <span>Save &amp; Propagate Passkey</span>
                  <span>→</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
