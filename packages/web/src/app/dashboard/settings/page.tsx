'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import PiiPlayground from '@/components/settings/PiiPlayground';
import ProfileSettings from '@/components/settings/ProfileSettings';
import SecuritySettings from '@/components/settings/SecuritySettings';
import WorkspaceSettings from '@/components/settings/WorkspaceSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';

type SettingsTab = 'pii' | 'profile' | 'workspace' | 'security' | 'notifications';

function SettingsContent() {
  const { session, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('pii');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['pii', 'profile', 'workspace', 'security', 'notifications'].includes(tabParam)) {
      setActiveSettingsTab(tabParam as SettingsTab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isLoading && !session) {
      window.location.href = '/login';
    }
  }, [isLoading, session]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center">
            <svg className="w-6 h-6 text-accent animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
          <p className="text-sm text-text-muted">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text pt-6 pb-20 px-4 sm:px-6 lg:px-8">
      {/* Background ambient lighting */}
      <div className="fixed top-10 left-1/4 w-[600px] h-[300px] bg-accent/10 blur-[140px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-10 right-1/4 w-[500px] h-[250px] bg-cyan/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between gap-4 py-2 border-b border-border/40">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-accent-light flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.5)]">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="font-bold text-base tracking-tight text-text">DraftPilot</span>
            </Link>

            <span className="text-text-dim text-xs">/</span>
            <span className="text-xs font-semibold text-text">Settings &amp; Workspace Hub</span>
          </div>

          <Link
            href="/dashboard"
            className="px-4 py-1.5 rounded-full bg-elevated hover:bg-white/5 border border-border text-xs font-semibold text-text transition-colors flex items-center gap-1.5"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </Link>
        </div>

        {/* Header Title & Tab Navigation */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text font-mono">
                Settings &amp; Preferences
              </h1>
              <p className="text-xs text-text-muted mt-1">
                Manage your user profile, security, workspace settings, notifications, and custom PII privacy rules.
              </p>
            </div>
          </div>

          {/* Settings Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2">
            <button
              onClick={() => setActiveSettingsTab('profile')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSettingsTab === 'profile'
                  ? 'bg-accent text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]'
                  : 'text-text-muted hover:text-text hover:bg-white/5'
              }`}
            >
              <span>👤</span>
              <span>Profile &amp; Identity</span>
            </button>
            <button
              onClick={() => setActiveSettingsTab('security')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSettingsTab === 'security'
                  ? 'bg-accent text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]'
                  : 'text-text-muted hover:text-text hover:bg-white/5'
              }`}
            >
              <span>🔒</span>
              <span>Security &amp; Auth</span>
            </button>
            <button
              onClick={() => setActiveSettingsTab('workspace')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSettingsTab === 'workspace'
                  ? 'bg-accent text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]'
                  : 'text-text-muted hover:text-text hover:bg-white/5'
              }`}
            >
              <span>🏢</span>
              <span>Workspace</span>
            </button>
            <button
              onClick={() => setActiveSettingsTab('notifications')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSettingsTab === 'notifications'
                  ? 'bg-accent text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]'
                  : 'text-text-muted hover:text-text hover:bg-white/5'
              }`}
            >
              <span>🔔</span>
              <span>Notifications</span>
            </button>
            <button
              onClick={() => setActiveSettingsTab('pii')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSettingsTab === 'pii'
                  ? 'bg-accent text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]'
                  : 'text-text-muted hover:text-text hover:bg-white/5'
              }`}
            >
              <span>🛡️</span>
              <span>PII &amp; Privacy Rules</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeSettingsTab === 'profile' && <ProfileSettings />}
        {activeSettingsTab === 'security' && <SecuritySettings />}
        {activeSettingsTab === 'workspace' && <WorkspaceSettings />}
        {activeSettingsTab === 'notifications' && <NotificationSettings />}
        {activeSettingsTab === 'pii' && <PiiPlayground />}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <SettingsContent />
    </Suspense>
  );
}
