'use client';

import React, { useState } from 'react';
import AdminSidebar, { AdminTab } from '@/components/admin/AdminSidebar';
import AdminOverview from '@/components/admin/AdminOverview';
import AdminWorkspaces from '@/components/admin/AdminWorkspaces';
import AdminAIConfig from '@/components/admin/AdminAIConfig';
import AdminGlobalMacros from '@/components/admin/AdminGlobalMacros';
import AdminFeatureFlags from '@/components/admin/AdminFeatureFlags';
import BillingManager from '@/components/dashboard/BillingManager';
import GmailSyncManager from '@/components/dashboard/GmailSyncManager';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col lg:flex-row">
      {/* Background ambient lighting */}
      <div className="fixed top-10 left-1/3 w-[650px] h-[350px] bg-accent/10 blur-[150px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-10 right-1/4 w-[500px] h-[250px] bg-emerald-500/10 blur-[140px] rounded-full pointer-events-none -z-10" />

      {/* Left Sidebar */}
      <AdminSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-5 sm:p-8 lg:p-10 max-w-7xl overflow-y-auto space-y-6">
        {/* Top Breadcrumb & Status Bar matching reference */}
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-text-dim">Dashboard</span>
            <span className="text-text-dim">/</span>
            <span className="text-accent-light font-bold capitalize">
              {activeTab === 'overview' && 'Overview'}
              {activeTab === 'workspaces' && 'Workspaces & Quotas'}
              {activeTab === 'ai-config' && 'AI Models & LLM Tuning'}
              {activeTab === 'global-macros' && 'Global Knowledge Base'}
              {activeTab === 'billing' && 'Stripe & MRR Revenue'}
              {activeTab === 'security' && 'Security & PII Audits'}
              {activeTab === 'features' && 'System Feature Flags'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>All Systems Operational (0 Incidents)</span>
            </span>
          </div>
        </div>

        {/* Dynamic Tab Views */}
        <div>
          {activeTab === 'overview' && (
            <AdminOverview
              onSelectWorkspaceTab={() => setActiveTab('workspaces')}
              onSelectAiConfigTab={() => setActiveTab('ai-config')}
            />
          )}
          {activeTab === 'workspaces' && <AdminWorkspaces />}
          {activeTab === 'ai-config' && <AdminAIConfig />}
          {activeTab === 'global-macros' && <AdminGlobalMacros />}
          {activeTab === 'billing' && <BillingManager />}
          {activeTab === 'security' && <GmailSyncManager />}
          {activeTab === 'features' && <AdminFeatureFlags />}
        </div>
      </main>
    </div>
  );
}
