'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEMO_DRAFT_EXAMPLE, DEMO_MACROS, DEMO_STATS } from '@/data/demo-data';

interface OnboardingState {
  gmail_connected: boolean;
  first_macro_added: boolean;
  extension_installed: boolean;
  viewed_demo: boolean;
}

interface OnboardingDashboardProps {
  userName: string;
  onboardingState: OnboardingState;
  onUpdateOnboarding?: (updates: Partial<OnboardingState>) => void;
  onNavigateToDashboard?: () => void;
}

export default function OnboardingDashboard({
  userName,
  onboardingState,
  onUpdateOnboarding,
  onNavigateToDashboard,
}: OnboardingDashboardProps) {
  const [expandedDraft, setExpandedDraft] = useState(true);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const firstName = userName?.split(' ')[0] || userName?.split('@')[0] || 'there';

  const completedCount = [
    onboardingState.gmail_connected,
    onboardingState.first_macro_added,
    onboardingState.extension_installed,
  ].filter(Boolean).length;

  const progress = Math.round((completedCount / 3) * 100);

  const handleViewDemo = () => {
    if (!onboardingState.viewed_demo) {
      onUpdateOnboarding?.({ viewed_demo: true });
    }
  };

  const handleToggleStep = (step: keyof OnboardingState) => {
    onUpdateOnboarding?.({ [step]: !onboardingState[step] });
  };

  return (
    <div className="min-h-screen bg-bg text-text pt-6 pb-20 px-4 sm:px-6 lg:px-8">
      {/* Background ambient lighting */}
      <div className="fixed top-10 left-1/4 w-[600px] h-[300px] bg-accent/10 blur-[140px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-10 right-1/4 w-[500px] h-[250px] bg-cyan/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-5xl mx-auto space-y-8">

        {/* ===== Welcome Header ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-accent to-accent-light flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.5)]">
              <span className="text-lg">👋</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome, {firstName}
              </h1>
              <p className="text-sm text-text-muted">
                Here&apos;s what your dashboard will look like once connected
              </p>
            </div>
          </div>
        </motion.div>

        {/* ===== Progress Bar ===== */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="rounded-2xl border border-border bg-bg-card/80 backdrop-blur-xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">Getting Started</span>
            <span className="text-xs text-text-dim font-mono">{completedCount}/3 complete</span>
          </div>
          <div className="w-full h-2 bg-elevated rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-accent to-accent-light rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </motion.div>

        {/* ===== Primary CTA: Connect Gmail ===== */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="rounded-2xl border-2 border-accent/40 bg-gradient-to-br from-accent/10 to-bg-card/90 backdrop-blur-xl p-6 sm:p-8"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📧</span>
                <h2 className="text-lg font-bold">Connect your Gmail inbox</h2>
              </div>
              <p className="text-sm text-text-muted max-w-lg">
                Install the DraftPilot Chrome extension and connect your Gmail to start seeing real AI-drafted replies for your incoming support emails.
              </p>
            </div>
            <button
              onClick={() => setIsInstallModalOpen(true)}
              className="shrink-0 px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-sm shadow-[0_0_30px_rgba(124,58,237,0.5)] hover:shadow-[0_0_40px_rgba(124,58,237,0.7)] transition-all flex items-center gap-2 animate-pulse hover:animate-none cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <span>Install Chrome Extension</span>
            </button>
          </div>
        </motion.div>

        {/* ===== Two-Column: Demo Draft + Checklist ===== */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Demo Draft Example (2 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="lg:col-span-2 rounded-2xl border border-border bg-bg-card/80 backdrop-blur-xl overflow-hidden"
            onClick={handleViewDemo}
          >
            {/* Demo Badge Banner */}
            <div className="px-5 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                📋 Example
              </span>
              <span className="text-xs text-amber-400/80">
                Connect your inbox to see this with your real emails
              </span>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {/* Customer Email */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-xs font-bold text-rose-400">
                      S
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{DEMO_DRAFT_EXAMPLE.customerEmail.from}</p>
                      <p className="text-[11px] text-text-dim">{DEMO_DRAFT_EXAMPLE.customerEmail.subject}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-text-dim">{DEMO_DRAFT_EXAMPLE.customerEmail.timestamp}</span>
                </div>
                <div className="ml-10 p-3.5 rounded-xl bg-elevated/60 border border-border/50 text-xs text-text-muted leading-relaxed whitespace-pre-line">
                  {DEMO_DRAFT_EXAMPLE.customerEmail.body}
                </div>
              </div>

              {/* AI Draft Reply */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
                      <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-accent-light">DraftPilot AI Draft</p>
                      <p className="text-[11px] text-text-dim">
                        Macro used: <span className="text-text-muted">{DEMO_DRAFT_EXAMPLE.aiDraft.macroUsed}</span>
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-success/15 border border-success/30 text-success text-[10px] font-bold">
                    {DEMO_DRAFT_EXAMPLE.aiDraft.confidence}% match
                  </span>
                </div>

                <button
                  onClick={() => setExpandedDraft(!expandedDraft)}
                  className="ml-10 w-[calc(100%-2.5rem)] text-left cursor-pointer"
                >
                  <AnimatePresence mode="wait">
                    {expandedDraft ? (
                      <motion.div
                        key="expanded"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-3.5 rounded-xl bg-accent/5 border border-accent/20 text-xs text-text leading-relaxed whitespace-pre-line"
                      >
                        {DEMO_DRAFT_EXAMPLE.aiDraft.body}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="collapsed"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-3 rounded-xl bg-accent/5 border border-accent/20 text-xs text-text-muted"
                      >
                        Click to expand AI draft preview...
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Onboarding Checklist (1 col) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="rounded-2xl border border-border bg-bg-card/80 backdrop-blur-xl p-5 sm:p-6 flex flex-col justify-between"
          >
            <div>
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                <span>🚀</span>
                <span>Quick Setup</span>
              </h3>

              <div className="space-y-3">
                <ChecklistItem
                  completed={onboardingState.gmail_connected}
                  label="Connect Gmail"
                  description="Link your inbox to get real-time draft suggestions"
                  icon="📧"
                  onClick={() => setIsInstallModalOpen(true)}
                />

                <ChecklistItem
                  completed={onboardingState.first_macro_added}
                  label="Add your first real macro"
                  description="Create a custom reply template for your team"
                  icon="📝"
                  onClick={() => handleToggleStep('first_macro_added')}
                />

                <ChecklistItem
                  completed={onboardingState.extension_installed}
                  label="Install Chrome extension"
                  description="Get AI drafts directly in your Gmail compose window"
                  icon="🧩"
                  onClick={() => setIsInstallModalOpen(true)}
                />
              </div>
            </div>

            {/* Skip to dashboard link */}
            {onNavigateToDashboard && (
              <div className="mt-6 pt-4 border-t border-border/40">
                <button
                  onClick={onNavigateToDashboard}
                  className="text-xs text-text-dim hover:text-accent transition-colors cursor-pointer"
                >
                  Skip setup → Explore dashboard
                </button>
              </div>
            )}
          </motion.div>
        </div>

        {/* ===== Demo Macro Library ===== */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <span>📚</span>
              <span>Sample Macro Library</span>
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
              Example Data
            </span>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {DEMO_MACROS.map((macro) => (
              <div
                key={macro.id}
                className="rounded-xl border border-border bg-bg-card/70 backdrop-blur-sm p-4 space-y-3 hover:border-border-hover transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">{macro.name}</h3>
                    <span className="text-[10px] text-text-dim">{macro.category}</span>
                  </div>
                  <span className="text-[10px] text-text-dim font-mono">{macro.usage_count} uses</span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed line-clamp-3">
                  {macro.content}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {macro.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full bg-elevated border border-border text-[10px] text-text-dim"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ===== Demo Stats Preview ===== */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <span>📊</span>
              <span>What your metrics will look like</span>
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
              Example Data
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Drafts Generated" value={String(DEMO_STATS.draftsGenerated)} icon="✍️" />
            <StatCard label="Avg Response Time" value={DEMO_STATS.avgResponseTime} icon="⚡" />
            <StatCard label="CSAT Score" value={DEMO_STATS.customerSatisfaction} icon="😊" />
            <StatCard label="Active Macros" value={String(DEMO_STATS.macrosActive)} icon="📝" />
          </div>
        </motion.div>

      </div>

      {/* ===== Interactive Chrome Extension Install Modal ===== */}
      <AnimatePresence>
        {isInstallModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl bg-bg-card border border-border p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden"
            >
              <button
                onClick={() => setIsInstallModalOpen(false)}
                className="absolute right-5 top-5 text-text-dim hover:text-text text-sm p-1 rounded-full bg-elevated border border-border cursor-pointer"
              >
                ✕
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-accent to-cyan flex items-center justify-center shadow-lg">
                  <span className="text-2xl">🧩</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold">Install DraftPilot Extension</h3>
                  <p className="text-xs text-text-muted">Manifest V3 · Production Ready</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                {/* 1-Click Download Button */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-accent/15 to-cyan/15 border border-accent/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-text text-sm">Download Extension (.zip)</p>
                      <p className="text-text-muted text-[11px]">Free direct download · No Chrome Web Store fee needed</p>
                    </div>
                    <a
                      href="/draftpilot-extension.zip"
                      download="draftpilot-extension.zip"
                      className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)] flex items-center gap-1.5 shrink-0"
                    >
                      <span>⬇️</span>
                      <span>Download .ZIP</span>
                    </a>
                  </div>
                </div>

                {/* 30-Second Quick Setup Guide */}
                <div className="p-4 rounded-2xl bg-elevated/70 border border-border space-y-2.5">
                  <p className="font-semibold text-text flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>How to Install in 30 Seconds (100% Free):</span>
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-text-muted text-[11px] pl-1 leading-relaxed">
                    <li>
                      <strong>Download and extract</strong> the <code className="bg-bg px-1.5 py-0.5 rounded text-accent-light font-mono">draftpilot-extension.zip</code> file on your computer.
                    </li>
                    <li>
                      Open Google Chrome and go to <code className="bg-bg px-1.5 py-0.5 rounded text-accent-light font-mono">chrome://extensions</code>.
                    </li>
                    <li>
                      In the top-right corner, toggle ON <strong>Developer mode</strong>.
                    </li>
                    <li>
                      Click the <strong>Load unpacked</strong> button in the top-left and select the extracted folder.
                    </li>
                  </ol>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => {
                    handleToggleStep('extension_installed');
                    handleToggleStep('gmail_connected');
                    setIsInstallModalOpen(false);
                    onNavigateToDashboard?.();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)] cursor-pointer text-center"
                >
                  ✓ Done! I Installed the Extension → Enter Dashboard
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

/* =================== Sub-components =================== */

function ChecklistItem({
  completed,
  label,
  description,
  icon,
  onClick,
}: {
  completed: boolean;
  label: string;
  description: string;
  icon: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
        completed
          ? 'border-success/30 bg-success/5'
          : 'border-border bg-elevated/30 hover:border-accent/40'
      }`}
    >
      <div
        className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
          completed
            ? 'border-success bg-success text-white'
            : 'border-border'
        }`}
      >
        {completed && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold ${completed ? 'text-success line-through' : 'text-text'}`}>
          {icon} {label}
        </p>
        <p className="text-[11px] text-text-dim mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-card/70 backdrop-blur-sm p-4 text-center space-y-1.5">
      <span className="text-lg">{icon}</span>
      <p className="text-xl font-extrabold font-mono tracking-tight">{value}</p>
      <p className="text-[10px] text-text-dim">{label}</p>
    </div>
  );
}
