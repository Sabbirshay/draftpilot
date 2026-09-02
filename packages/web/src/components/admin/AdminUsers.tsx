'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

interface AdminUserData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  team_id?: string;
  team_name: string;
  team_plan: string;
  drafts_count: number;
  created_at: string;
}

interface BannedEmailData {
  id: string;
  email: string;
  reason: string;
  banned_by: string;
  created_at: string;
  updated_at?: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUserData[]>([]);
  const [bannedEmails, setBannedEmails] = useState<BannedEmailData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'banned'>('users');
  const [search, setSearch] = useState('');
  const [bannerNotice, setBannerNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Deletion modal state
  const [userToDeactivate, setUserToDeactivate] = useState<AdminUserData | null>(null);
  const [banReason, setBanReason] = useState('Violation of Terms / Deactivated by Super Admin');
  const [deleteAccountRecord, setDeleteAccountRecord] = useState(true);
  const [isProcessingBan, setIsProcessingBan] = useState(false);

  // Manual ban input
  const [manualBanEmail, setManualBanEmail] = useState('');
  const [manualBanReason, setManualBanReason] = useState('');
  const [showManualBan, setShowManualBan] = useState(false);

  // Restoring state
  const [restoringEmail, setRestoringEmail] = useState<string | null>(null);

  const getHeaders = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token =
      sessionData.session?.access_token ||
      (typeof window !== 'undefined' ? localStorage.getItem('draftpilot_token') : null);
    const adminPasskey =
      typeof window !== 'undefined' ? sessionStorage.getItem('draftpilot_admin_passkey') : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (adminPasskey) {
      headers['x-admin-passkey'] = adminPasskey;
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  const fetchUsersAndBans = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/users', { headers });

      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setBannedEmails(data.bannedEmails || []);
      } else {
        const err = await res.json().catch(() => ({}));
        setBannerNotice({
          type: 'error',
          message: err.error || `Failed to fetch users (HTTP ${res.status})`,
        });
      }
    } catch (err: any) {
      setBannerNotice({ type: 'error', message: err.message || 'Error connecting to admin API' });
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchUsersAndBans();
  }, [fetchUsersAndBans]);

  const handleDeactivateAndBan = async () => {
    if (!userToDeactivate) return;
    setIsProcessingBan(true);
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'ban',
          email: userToDeactivate.email,
          userId: userToDeactivate.id,
          reason: banReason || 'Deactivated by Super Admin',
          deleteUser: deleteAccountRecord,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBannerNotice({
          type: 'success',
          message: `User ${userToDeactivate.email} was deactivated and permanently added to the ban registry.`,
        });
        setUserToDeactivate(null);
        await fetchUsersAndBans();
      } else {
        setBannerNotice({
          type: 'error',
          message: data.error || 'Failed to ban user',
        });
      }
    } catch (err: any) {
      setBannerNotice({ type: 'error', message: err.message || 'Error banning user' });
    } finally {
      setIsProcessingBan(false);
    }
  };

  const handleManualBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBanEmail.trim()) return;

    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'ban',
          email: manualBanEmail.trim(),
          reason: manualBanReason.trim() || 'Preemptive ban by Super Admin',
          deleteUser: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBannerNotice({
          type: 'success',
          message: `Email ${manualBanEmail.trim()} successfully registered in ban registry.`,
        });
        setManualBanEmail('');
        setManualBanReason('');
        setShowManualBan(false);
        await fetchUsersAndBans();
      } else {
        setBannerNotice({
          type: 'error',
          message: data.error || 'Failed to add banned email',
        });
      }
    } catch (err: any) {
      setBannerNotice({ type: 'error', message: err.message || 'Error processing ban' });
    }
  };

  const handleRestorePermission = async (email: string) => {
    setRestoringEmail(email);
    try {
      const headers = await getHeaders();
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBannerNotice({
          type: 'success',
          message: `Access restored for ${email}. The user may now register and sign in again.`,
        });
        await fetchUsersAndBans();
      } else {
        setBannerNotice({
          type: 'error',
          message: data.error || 'Failed to restore user permission',
        });
      }
    } catch (err: any) {
      setBannerNotice({ type: 'error', message: err.message || 'Error restoring permission' });
    } finally {
      setRestoringEmail(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.full_name.toLowerCase().includes(q) ||
      u.team_name.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const filteredBanned = bannedEmails.filter((b) => {
    const q = search.toLowerCase();
    return b.email.toLowerCase().includes(q) || b.reason.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      <AnimatePresence>
        {bannerNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl flex items-center justify-between text-xs font-medium border ${
              bannerNotice.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{bannerNotice.type === 'success' ? '✓' : '⚠️'}</span>
              <span>{bannerNotice.message}</span>
            </div>
            <button
              onClick={() => setBannerNotice(null)}
              className="text-xs opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-elevated/70 border border-border/80 flex items-center justify-between">
          <div>
            <p className="text-xs text-text-dim font-medium">Active Accounts</p>
            <p className="text-2xl font-black text-text mt-1">{users.length}</p>
            <p className="text-[10px] text-text-muted mt-1">Verified platform profiles</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-light text-xl">
            👥
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-elevated/70 border border-border/80 flex items-center justify-between">
          <div>
            <p className="text-xs text-text-dim font-medium">Restricted / Banned Emails</p>
            <p className="text-2xl font-black text-red-400 mt-1">{bannedEmails.length}</p>
            <p className="text-[10px] text-text-muted mt-1">Blocked from Auth &amp; AI</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 text-xl">
            🚫
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-elevated/70 border border-border/80 flex items-center justify-between">
          <div>
            <p className="text-xs text-text-dim font-medium">Total AI Generations</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">
              {users.reduce((acc, u) => acc + (u.drafts_count || 0), 0)}
            </p>
            <p className="text-[10px] text-text-muted mt-1">Across all workspace users</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl">
            ⚡
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-3xl bg-elevated/60 border border-border/80 overflow-hidden shadow-xl">
        {/* Navigation & Action Bar */}
        <div className="p-5 border-b border-border/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-bg/80 p-1 rounded-2xl border border-border/80">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'users'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Active Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('banned')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'banned'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <span>Access Registry (`banned_emails`)</span>
              {bannedEmails.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-500/30 text-red-300 font-mono">
                  {bannedEmails.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder={activeTab === 'users' ? 'Search user or email...' : 'Search banned registry...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3.5 py-2 pl-9 rounded-xl bg-bg border border-border text-xs text-text placeholder-text-dim outline-none focus:border-accent"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim text-xs">🔍</span>
            </div>

            <button
              onClick={() => setShowManualBan(!showManualBan)}
              className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold transition-colors whitespace-nowrap"
            >
              + Ban Custom Email
            </button>

            <button
              onClick={fetchUsersAndBans}
              className="p-2 rounded-xl bg-bg border border-border text-text-dim hover:text-text transition-colors"
              title="Refresh"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Manual Ban Drawer / Form */}
        <AnimatePresence>
          {showManualBan && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleManualBan}
              className="p-5 bg-red-500/5 border-b border-red-500/20 space-y-3 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">
                  Direct Email Ban &amp; Permission Lock
                </h4>
                <button
                  type="button"
                  onClick={() => setShowManualBan(false)}
                  className="text-xs text-text-dim hover:text-text"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={manualBanEmail}
                  onChange={(e) => setManualBanEmail(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-red-400"
                />
                <input
                  type="text"
                  placeholder="Reason (e.g. Terms violation, spam, malicious activity)"
                  value={manualBanReason}
                  onChange={(e) => setManualBanReason(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-red-400"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md"
                >
                  Enforce Ban &amp; Revoke Access
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Tab 1: Active Users List */}
        {activeTab === 'users' && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-20 text-center text-text-dim text-xs">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-20 text-center text-text-dim text-xs">
                No users found matching your search.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-bg/40 text-[11px] font-semibold text-text-dim uppercase tracking-wider">
                    <th className="py-3.5 px-5">User</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Workspace</th>
                    <th className="py-3.5 px-4 text-center">AI Drafts</th>
                    <th className="py-3.5 px-4">Created</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredUsers.map((u) => {
                    const initials = u.full_name.slice(0, 2).toUpperCase();
                    return (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-purple-600 flex items-center justify-center font-bold text-white text-[11px] shadow">
                              {initials}
                            </div>
                            <div>
                              <p className="font-bold text-text group-hover:text-accent-light transition-colors">
                                {u.full_name}
                              </p>
                              <p className="text-[11px] font-mono text-text-dim">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full font-mono text-[10px] font-semibold uppercase tracking-wider ${
                              u.role === 'owner' || u.role === 'superadmin'
                                ? 'bg-purple-500/15 border border-purple-500/30 text-purple-300'
                                : 'bg-white/5 border border-white/10 text-text-dim'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-text">{u.team_name}</p>
                            <span className="text-[10px] font-mono text-emerald-400 uppercase">
                              {u.team_plan} plan
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center font-mono font-bold text-text">
                          <span className="px-2 py-0.5 rounded-lg bg-bg border border-border">
                            {u.drafts_count}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-text-dim font-mono text-[11px]">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-4 px-5 text-right">
                          <button
                            onClick={() => setUserToDeactivate(u)}
                            className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-bold transition-all"
                          >
                            Deactivate &amp; Ban
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Banned Emails Registry */}
        {activeTab === 'banned' && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-20 text-center text-text-dim text-xs">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading registry...
              </div>
            ) : filteredBanned.length === 0 ? (
              <div className="py-20 text-center text-text-dim text-xs">
                {bannedEmails.length === 0
                  ? 'No restricted or banned emails in registry.'
                  : 'No banned emails matching your search.'}
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-bg/40 text-[11px] font-semibold text-text-dim uppercase tracking-wider">
                    <th className="py-3.5 px-5">Restricted Email</th>
                    <th className="py-3.5 px-4">Deactivation Reason</th>
                    <th className="py-3.5 px-4">Banned By</th>
                    <th className="py-3.5 px-4">Date Restricted</th>
                    <th className="py-3.5 px-5 text-right">1-Click Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredBanned.map((b) => (
                    <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="font-mono font-bold text-red-300">{b.email}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-text-muted">
                        <p className="truncate max-w-xs">{b.reason}</p>
                      </td>
                      <td className="py-4 px-4 font-mono text-text-dim text-[11px]">
                        {b.banned_by}
                      </td>
                      <td className="py-4 px-4 font-mono text-text-dim text-[11px]">
                        {b.created_at ? new Date(b.created_at).toLocaleString() : 'N/A'}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => handleRestorePermission(b.email)}
                          disabled={restoringEmail === b.email}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-xs font-bold transition-all disabled:opacity-50"
                        >
                          {restoringEmail === b.email ? 'Restoring...' : '✓ Restore Permission'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Deletion & Ban Confirmation Modal */}
      <AnimatePresence>
        {userToDeactivate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-elevated border border-red-500/40 rounded-3xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3 text-red-400">
                <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-xl">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-text">Deactivate &amp; Ban User</h3>
                  <p className="text-xs text-text-dim">Super Admin Permission Enforcement</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-bg/80 border border-border/80 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-dim">Target User:</span>
                  <span className="font-bold text-text">{userToDeactivate.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-dim">Email:</span>
                  <span className="font-mono text-red-300">{userToDeactivate.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-dim">Workspace:</span>
                  <span className="text-text">{userToDeactivate.team_name}</span>
                </div>
              </div>

              <p className="text-xs text-text-muted leading-relaxed">
                Adding this user to the access restriction registry will strictly prevent them from
                logging in, registering a new account, and generating AI drafts until explicitly
                restored.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-text-dim uppercase tracking-wider block mb-1">
                    Ban Reason (Audit Log)
                  </label>
                  <input
                    type="text"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Enter reason for deactivation..."
                    className="w-full px-3.5 py-2 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-red-400"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-text-muted">
                  <input
                    type="checkbox"
                    checked={deleteAccountRecord}
                    onChange={(e) => setDeleteAccountRecord(e.target.checked)}
                    className="rounded border-border text-red-500 focus:ring-red-400"
                  />
                  <span>Delete user auth records &amp; purge active sessions</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isProcessingBan}
                  onClick={() => setUserToDeactivate(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-text-dim hover:text-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessingBan}
                  onClick={handleDeactivateAndBan}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessingBan ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Deactivating...</span>
                    </>
                  ) : (
                    <span>Confirm Ban &amp; Revoke Access</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
