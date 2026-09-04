'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import DateRangePicker, { DateRangeState } from './DateRangePicker';
import NotificationCenter from './NotificationCenter';
import HelpSupportCenter from './HelpSupportCenter';
import { useAuth } from '@/components/providers/AuthProvider';

export type DashboardTab = 'overview' | 'macros' | 'team' | 'billing' | 'gmail' | 'settings';

interface DashboardHeaderProps {
  activeTab?: DashboardTab;
  onTabChange?: (tab: DashboardTab) => void;
  onAddMacroClick?: () => void;
  dateRange?: DateRangeState;
  onDateRangeChange?: (range: DateRangeState) => void;
  onTryDemoClick?: () => void;
  showActionBar?: boolean;
}

export default function DashboardHeader({
  activeTab = 'overview',
  onTabChange,
  onAddMacroClick,
  dateRange,
  onDateRangeChange,
  onTryDemoClick,
  showActionBar = true,
}: DashboardHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { dbUser, user, signOut } = useAuth();
  const userEmail = dbUser?.email || user?.email || '';
  const fullName =
    dbUser?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (userEmail ? userEmail.split('@')[0] : 'Support Agent');
  const avatarUrl =
    dbUser?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    null;
  const teamName = dbUser?.teams?.name || `${fullName}'s Team`;
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut();
  };

  const handleNavTab = (tab: DashboardTab) => {
    if (pathname !== '/dashboard') {
      router.push(`/dashboard?tab=${tab}`);
    }
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navbar matching reference */}
      <div className="flex items-center justify-between gap-4 py-2 border-b border-border/40">
        {/* Brand & Nav Pill */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-accent-light flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.5)]">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-bold text-base tracking-tight text-text hidden sm:inline">DraftPilot</span>
          </Link>

          {/* Navigation Pill Menu */}
          <nav className="flex items-center gap-1 bg-elevated/70 p-1 rounded-full border border-border/80 text-xs overflow-x-auto">
            <button
              onClick={() => handleNavTab('overview')}
              className={`px-4 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-accent text-white shadow-[0_0_15px_rgba(124,58,237,0.5)]'
                  : 'text-text-muted hover:text-text hover:bg-white/5'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => handleNavTab('macros')}
              className={`px-4 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                activeTab === 'macros'
                  ? 'bg-accent text-white shadow-[0_0_15px_rgba(124,58,237,0.5)]'
                  : 'text-text-muted hover:text-text hover:bg-white/5'
              }`}
            >
              Macros &amp; KB
            </button>
            <button
              onClick={() => handleNavTab('team')}
              className={`px-4 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                activeTab === 'team'
                  ? 'bg-accent text-white shadow-[0_0_15px_rgba(124,58,237,0.5)]'
                  : 'text-text-muted hover:text-text hover:bg-white/5'
              }`}
            >
              Team Seats
            </button>
            <button
              onClick={() => handleNavTab('billing')}
              className={`px-4 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                activeTab === 'billing'
                  ? 'bg-accent text-white shadow-[0_0_15px_rgba(124,58,237,0.5)]'
                  : 'text-text-muted hover:text-text hover:bg-white/5'
              }`}
            >
              Billing &amp; Usage
            </button>
            <button
              onClick={() => handleNavTab('gmail')}
              className={`px-4 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                activeTab === 'gmail'
                  ? 'bg-accent text-white shadow-[0_0_15px_rgba(124,58,237,0.5)]'
                  : 'text-text-muted hover:text-text hover:bg-white/5'
              }`}
            >
              Gmail Sync
            </button>
          </nav>
        </div>

        {/* Right Header Actions: Try Demo, Search, Support, Notifications, Avatar */}
        <div className="flex items-center gap-2.5">
          {/* Try Demo Mode Trigger Button */}
          <button
            type="button"
            onClick={() => {
              if (onTryDemoClick) {
                onTryDemoClick();
              } else if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('draftpilot:open-demo'));
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-accent/20 to-cyan/20 hover:from-accent/30 hover:to-cyan/30 border border-accent/40 text-text text-xs font-semibold transition-all shadow-[0_0_12px_rgba(124,58,237,0.25)] cursor-pointer"
            title="Try interactive demo mode on sample tickets"
          >
            <span className="text-accent-light">✨</span>
            <span className="hidden md:inline">Try Demo</span>
          </button>

          {/* Quick Search */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-elevated/60 border border-border text-xs text-text-dim">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Search drafts, macros...</span>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-bg rounded border border-border">⌘K</kbd>
          </div>

          {/* Help & Support Center Flyout */}
          <HelpSupportCenter />

          {/* Notification Center Popover */}
          <NotificationCenter onNavigateTab={handleNavTab} />

          {/* User Profile Avatar with dropdown */}
          <div ref={profileMenuRef} className="relative">
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-2 p-1 rounded-full bg-elevated/80 border border-border hover:border-accent/50 transition-all cursor-pointer"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-7 h-7 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-accent to-cyan flex items-center justify-center text-xs font-bold text-white shadow-sm">
                  {(fullName || userEmail).charAt(0).toUpperCase()}
                </div>
              )}
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-bg-card border border-border shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-border/50 mb-1">
                  <p className="text-xs font-bold text-text truncate">{fullName}</p>
                  <p className="text-[11px] text-text-dim truncate">{teamName} · {userEmail}</p>
                </div>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-muted hover:text-text hover:bg-white/5 rounded-xl transition-colors font-medium text-accent-light"
                >
                  <span>⚙️</span>
                  <span>Profile &amp; Account Settings</span>
                </Link>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-muted hover:text-text hover:bg-white/5 rounded-xl transition-colors font-medium text-purple-300"
                >
                  <span>🛡️</span>
                  <span>Custom PII Scrubbing Rules</span>
                </Link>
                <button
                  onClick={() => { handleNavTab('team'); setIsProfileMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-text-muted hover:text-text hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                >
                  👥 Team Seats
                </button>
                <button
                  onClick={() => { handleNavTab('billing'); setIsProfileMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-text-muted hover:text-text hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                >
                  💳 Plan &amp; Billing
                </button>
                <Link
                  href="/"
                  className="block w-full text-left px-3 py-1.5 text-xs text-text-muted hover:text-text hover:bg-white/5 rounded-xl transition-colors"
                >
                  🌐 Public Website
                </Link>
                <div className="border-t border-border/50 mt-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-xl transition-colors font-medium cursor-pointer"
                  >
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Title & Action Bar matching Reference */}
      {showActionBar && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text font-mono">
              {activeTab === 'overview' && 'Overview'}
              {activeTab === 'macros' && 'Knowledge Base & Macros'}
              {activeTab === 'team' && 'Team & Agent Seats'}
              {activeTab === 'billing' && 'Billing & Quota'}
              {activeTab === 'gmail' && 'Gmail Extension Sync'}
              {activeTab === 'settings' && 'Account Settings'}
            </h1>
            <span className="p-1 rounded-md bg-elevated border border-border text-text-dim text-xs">
              🔗
            </span>
          </div>

          {/* Date Filters and Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Interactive Date Range Picker */}
            {dateRange && onDateRangeChange && (
              <DateRangePicker
                dateRange={dateRange}
                onChange={onDateRangeChange}
              />
            )}

            {/* Add Macro Button */}
            {onAddMacroClick && (
              <button
                onClick={onAddMacroClick}
                className="px-4 py-1.5 rounded-full bg-accent hover:bg-accent-hover text-white font-semibold transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)] flex items-center gap-1.5 cursor-pointer"
              >
                <span>+</span>
                <span>New Macro</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
