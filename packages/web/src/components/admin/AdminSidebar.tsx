'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';

export type AdminTab =
  | 'overview'
  | 'users'
  | 'workspaces'
  | 'ai-config'
  | 'global-macros'
  | 'billing'
  | 'security'
  | 'features';

interface AdminSidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export default function AdminSidebar({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
}: AdminSidebarProps) {
  const { user, dbUser, signOut } = useAuth();

  const adminEmail = user?.email || dbUser?.email || 'admin@draftpilot.app';
  const adminName = dbUser?.full_name || adminEmail.split('@')[0];
  const initials = adminName.slice(0, 2).toUpperCase();

  const handleLockConsole = () => {
    sessionStorage.removeItem('draftpilot_admin_unlocked');
    window.location.reload();
  };

  return (
    <aside className="w-full lg:w-64 flex flex-col justify-between p-5 bg-elevated/80 border-r border-border/70 rounded-3xl lg:rounded-none lg:min-h-screen">
      <div>
        {/* Brand Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/admin" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-cyan flex items-center justify-center text-white shadow-[0_0_15px_rgba(124,58,237,0.6)]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-text block leading-none">
                DraftPilot
              </span>
              <span className="text-[10px] font-mono text-accent-light font-semibold uppercase tracking-wider">
                SuperAdmin
              </span>
            </div>
          </Link>
        </div>

        {/* Admin Profile Pill */}
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-bg/80 border border-border/80 mb-5 shadow-sm">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-accent via-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white shadow">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-text truncate">{adminName}</p>
            <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Root Authority
            </p>
          </div>
        </div>

        {/* Search Reports & Entities */}
        <div className="relative mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search control center..."
            className="w-full px-3.5 py-2 pl-9 rounded-xl bg-bg border border-border text-xs text-text placeholder-text-dim outline-none focus:border-accent transition-all"
          />
          <svg
            className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1 text-xs font-medium">
          <button
            onClick={() => onTabChange('overview')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-accent/20 border border-accent/40 text-accent-light font-bold shadow-sm'
                : 'text-text-muted hover:text-text hover:bg-white/5'
            }`}
          >
            <span className="text-sm">🎛️</span>
            <span>Command Overview</span>
          </button>

          <button
            onClick={() => onTabChange('users')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
              activeTab === 'users'
                ? 'bg-accent/20 border border-accent/40 text-accent-light font-bold shadow-sm'
                : 'text-text-muted hover:text-text hover:bg-white/5'
            }`}
          >
            <span className="text-sm">👥</span>
            <span>User Management</span>
          </button>

          <button
            onClick={() => onTabChange('workspaces')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
              activeTab === 'workspaces'
                ? 'bg-accent/20 border border-accent/40 text-accent-light font-bold shadow-sm'
                : 'text-text-muted hover:text-text hover:bg-white/5'
            }`}
          >
            <span className="text-sm">🏢</span>
            <span>Workspaces &amp; Quotas</span>
          </button>

          <button
            onClick={() => onTabChange('ai-config')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
              activeTab === 'ai-config'
                ? 'bg-accent/20 border border-accent/40 text-accent-light font-bold shadow-sm'
                : 'text-text-muted hover:text-text hover:bg-white/5'
            }`}
          >
            <span className="text-sm">⚡</span>
            <span>AI Models &amp; Tuning</span>
          </button>

          <button
            onClick={() => onTabChange('global-macros')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
              activeTab === 'global-macros'
                ? 'bg-accent/20 border border-accent/40 text-accent-light font-bold shadow-sm'
                : 'text-text-muted hover:text-text hover:bg-white/5'
            }`}
          >
            <span className="text-sm">📚</span>
            <span>Global Knowledge Base</span>
          </button>

          <button
            onClick={() => onTabChange('billing')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
              activeTab === 'billing'
                ? 'bg-accent/20 border border-accent/40 text-accent-light font-bold shadow-sm'
                : 'text-text-muted hover:text-text hover:bg-white/5'
            }`}
          >
            <span className="text-sm">💳</span>
            <span>Stripe &amp; MRR Analytics</span>
          </button>

          <button
            onClick={() => onTabChange('security')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
              activeTab === 'security'
                ? 'bg-accent/20 border border-accent/40 text-accent-light font-bold shadow-sm'
                : 'text-text-muted hover:text-text hover:bg-white/5'
            }`}
          >
            <span className="text-sm">🛡️</span>
            <span>Security &amp; PII Logs</span>
          </button>

          <button
            onClick={() => onTabChange('features')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
              activeTab === 'features'
                ? 'bg-accent/20 border border-accent/40 text-accent-light font-bold shadow-sm'
                : 'text-text-muted hover:text-text hover:bg-white/5'
            }`}
          >
            <span className="text-sm">⚙️</span>
            <span>System Feature Flags</span>
          </button>
        </nav>
      </div>

      {/* Footer links & Lock Console */}
      <div className="pt-6 border-t border-border/50 mt-6 space-y-2">
        <button
          onClick={handleLockConsole}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left"
        >
          <span>🔒</span>
          <span>Lock Admin Console</span>
        </button>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-text-muted hover:text-text hover:bg-white/5 transition-colors"
        >
          <span>👤</span>
          <span>Customer Dashboard</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-text-muted hover:text-text hover:bg-white/5 transition-colors"
        >
          <span>🌐</span>
          <span>Public Landing Page</span>
        </Link>
      </div>
    </aside>
  );
}
