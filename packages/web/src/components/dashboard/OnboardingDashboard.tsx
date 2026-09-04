'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEMO_DRAFT_EXAMPLE, DEMO_MACROS, DEMO_STATS } from '@/data/demo-data';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';
import ConfettiCelebration from './ConfettiCelebration';

export interface OnboardingState {
  extension_installed: boolean;
  first_macro_added: boolean;
  first_draft_generated: boolean;
  team_member_invited: boolean;
  gmail_connected?: boolean;
  viewed_demo?: boolean;
}

export interface AchievementBadge {
  id: string;
  name: string;
  icon: string;
  description: string;
  stepRequired: string;
  isUnlocked: boolean;
}

interface OnboardingDashboardProps {
  userName: string;
  onboardingState: Partial<OnboardingState>;
  onUpdateOnboarding?: (updates: Partial<OnboardingState>) => void;
  onNavigateToDashboard?: () => void;
}

export default function OnboardingDashboard({
  userName,
  onboardingState = {},
  onUpdateOnboarding,
  onNavigateToDashboard,
}: OnboardingDashboardProps) {
  const { dbUser } = useAuth();
  const [expandedDraft, setExpandedDraft] = useState(true);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [celebrationConfig, setCelebrationConfig] = useState<{
    isActive: boolean;
    title: string;
    message: string;
    badgeName: string;
    badgeIcon: string;
  } | null>(null);

  // Local state copy for immediate reactivity
  const [localSteps, setLocalSteps] = useState<OnboardingState>({
    extension_installed: Boolean(onboardingState.extension_installed),
    first_macro_added: Boolean(onboardingState.first_macro_added),
    first_draft_generated: Boolean(onboardingState.first_draft_generated),
    team_member_invited: Boolean(onboardingState.team_member_invited),
    gmail_connected: Boolean(onboardingState.gmail_connected),
    viewed_demo: Boolean(onboardingState.viewed_demo),
  });

  const firstName = userName?.split(' ')[0] || userName?.split('@')[0] || 'there';

  // Sync with incoming prop changes
  useEffect(() => {
    setLocalSteps((prev) => ({
      ...prev,
      extension_installed: Boolean(onboardingState.extension_installed ?? prev.extension_installed),
      first_macro_added: Boolean(onboardingState.first_macro_added ?? prev.first_macro_added),
      first_draft_generated: Boolean(onboardingState.first_draft_generated ?? prev.first_draft_generated),
      team_member_invited: Boolean(onboardingState.team_member_invited ?? prev.team_member_invited),
    }));
  }, [onboardingState]);

  // Update step helper
  const updateStep = useCallback(
    (step: keyof OnboardingState, value: boolean) => {
      setLocalSteps((prev) => ({ ...prev, [step]: value }));
      onUpdateOnboarding?.({ [step]: value });
      try {
        localStorage.setItem(`draftpilot_${step}`, String(value));
      } catch (e) {
        // ignore
      }
    },
    [onUpdateOnboarding]
  );

  // Auto-detection logic on mount
  useEffect(() => {
    async function autoDetectMilestones() {
      // 1. Check Extension Handshake
      if (typeof document !== 'undefined') {
        const isExtInstalled =
          document.documentElement.getAttribute('data-draftpilot-extension-installed') === 'true' ||
          localStorage.getItem('draftpilot_extension_installed') === 'true';

        if (isExtInstalled && !localSteps.extension_installed) {
          updateStep('extension_installed', true);
        }
      }

      // Check localStorage cached achievements
      if (localStorage.getItem('draftpilot_first_draft_generated') === 'true' && !localSteps.first_draft_generated) {
        updateStep('first_draft_generated', true);
      }
      if (localStorage.getItem('draftpilot_first_macro_added') === 'true' && !localSteps.first_macro_added) {
        updateStep('first_macro_added', true);
      }
      if (localStorage.getItem('draftpilot_team_member_invited') === 'true' && !localSteps.team_member_invited) {
        updateStep('team_member_invited', true);
      }

      // 2. Query Supabase for real team data
      const teamId = dbUser?.team_id;
      if (teamId) {
        try {
          // Check macros
          const { count: macroCount } = await supabase
            .from('macros')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', teamId);
          if (macroCount && macroCount > 0 && !localSteps.first_macro_added) {
            updateStep('first_macro_added', true);
          }

          // Check draft history
          const { count: draftsCount } = await supabase
            .from('draft_history')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', teamId);
          if (draftsCount && draftsCount > 0 && !localSteps.first_draft_generated) {
            updateStep('first_draft_generated', true);
          }

          // Check team members
          const { count: memberCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', teamId);
          if (memberCount && memberCount > 1 && !localSteps.team_member_invited) {
            updateStep('team_member_invited', true);
          }
        } catch (err) {
          console.warn('Auto-detection query notice:', err);
        }
      }
    }

    autoDetectMilestones();
  }, [dbUser, localSteps, updateStep]);

  // The 4 Core Required Steps
  const steps = [
    {
      id: 'extension_installed' as keyof OnboardingState,
      title: '1. Install Extension',
      description: 'Add DraftPilot extension to Chrome for inline Gmail drafting',
      icon: '🧩',
      badgeName: 'Extension Pioneer',
      badgeIcon: '🧩',
      completed: localSteps.extension_installed,
      actionLabel: localSteps.extension_installed ? 'Installed' : 'Install Extension',
      onAction: () => setIsInstallModalOpen(true),
    },
    {
      id: 'first_macro_added' as keyof OnboardingState,
      title: '2. Create First Macro',
      description: 'Add your team’s first custom canned response template',
      icon: '📐',
      badgeName: 'Macro Architect',
      badgeIcon: '📐',
      completed: localSteps.first_macro_added,
      actionLabel: localSteps.first_macro_added ? 'Created' : 'Create Macro',
      onAction: () => {
        const next = !localSteps.first_macro_added;
        updateStep('first_macro_added', next);
        if (next) {
          setCelebrationConfig({
            isActive: true,
            title: '📐 Macro Architect Unlocked!',
            message: 'You created your first support macro. Repetitive answers are now automated!',
            badgeName: 'Macro Architect',
            badgeIcon: '📐',
          });
        }
      },
    },
    {
      id: 'first_draft_generated' as keyof OnboardingState,
      title: '3. Generate First AI Draft',
      description: 'Synthesize your first real-time AI reply on an email thread',
      icon: '⚡',
      badgeName: 'AI Copilot Ace',
      badgeIcon: '⚡',
      completed: localSteps.first_draft_generated,
      actionLabel: localSteps.first_draft_generated ? 'Generated' : 'Generate Draft',
      onAction: () => {
        const next = !localSteps.first_draft_generated;
        updateStep('first_draft_generated', next);
        if (next) {
          setCelebrationConfig({
            isActive: true,
            title: '🎉 AI Copilot Ace Unlocked!',
            message: 'First AI reply generated! DraftPilot synthesized an empathetic, context-aware reply in 240ms.',
            badgeName: 'AI Copilot Ace',
            badgeIcon: '⚡',
          });
        }
      },
    },
    {
      id: 'team_member_invited' as keyof OnboardingState,
      title: '4. Invite Team Member',
      description: 'Invite a co-pilot to collaborate in your shared workspace',
      icon: '👥',
      badgeName: 'Team Builder',
      badgeIcon: '👥',
      completed: localSteps.team_member_invited,
      actionLabel: localSteps.team_member_invited ? 'Invited' : 'Invite Member',
      onAction: () => setIsInviteModalOpen(true),
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / 4) * 100);
  const isAllCompleted = completedCount === 4;

  // 5 Milestone Achievement Badges
  const achievementBadges: AchievementBadge[] = [
    {
      id: 'badge-extension',
      name: 'Extension Pioneer',
      icon: '🧩',
      description: 'Installed the Chrome extension and established handshake',
      stepRequired: 'Install Extension',
      isUnlocked: localSteps.extension_installed,
    },
    {
      id: 'badge-macro',
      name: 'Macro Architect',
      icon: '📐',
      description: 'Created first custom support macro template',
      stepRequired: 'Create First Macro',
      isUnlocked: localSteps.first_macro_added,
    },
    {
      id: 'badge-draft',
      name: 'AI Copilot Ace',
      icon: '⚡',
      description: 'Synthesized first AI draft reply with privacy scrubbing',
      stepRequired: 'Generate First AI Draft',
      isUnlocked: localSteps.first_draft_generated,
    },
    {
      id: 'badge-team',
      name: 'Team Builder',
      icon: '👥',
      description: 'Invited team member to collaborate in workspace',
      stepRequired: 'Invite Team Member',
      isUnlocked: localSteps.team_member_invited,
    },
    {
      id: 'badge-champion',
      name: 'DraftPilot Champion',
      icon: '👑',
      description: 'Completed all 4 onboarding milestones and mastered the workflow',
      stepRequired: 'Complete All Steps',
      isUnlocked: isAllCompleted,
    },
  ];

  // Trigger champion celebration when all 4 steps become completed
  useEffect(() => {
    if (isAllCompleted && !celebrationConfig?.isActive) {
      setCelebrationConfig({
        isActive: true,
        title: '👑 DraftPilot Champion Unlocked!',
        message: 'Mastery achieved! You completed all 4 onboarding milestones. Your support workflow is fully empowered.',
        badgeName: 'DraftPilot Champion',
        badgeIcon: '👑',
      });
    }
  }, [isAllCompleted, celebrationConfig]);

  const handleTriggerDemoDraft = () => {
    updateStep('first_draft_generated', true);
    setCelebrationConfig({
      isActive: true,
      title: '🎉 First AI Draft Generated!',
      message: 'Congratulations! You generated your first AI draft reply with privacy redaction and tone synthesis.',
      badgeName: 'AI Copilot Ace',
      badgeIcon: '⚡',
    });
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    updateStep('team_member_invited', true);
    setIsInviteModalOpen(false);
    setInviteEmail('');
    setCelebrationConfig({
      isActive: true,
      title: '👥 Team Builder Unlocked!',
      message: `Invitation sent to ${inviteEmail}. You're on your way to scaling team support!`,
      badgeName: 'Team Builder',
      badgeIcon: '👥',
    });
  };

  return (
    <div className="min-h-screen bg-bg text-text pt-6 pb-20 px-4 sm:px-6 lg:px-8">
      {/* Background ambient lighting */}
      <div className="fixed top-10 left-1/4 w-[600px] h-[300px] bg-accent/10 blur-[140px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-10 right-1/4 w-[500px] h-[250px] bg-cyan/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      {/* Confetti Celebration Particle Layer & Banner */}
      {celebrationConfig && (
        <ConfettiCelebration
          isActive={celebrationConfig.isActive}
          title={celebrationConfig.title}
          message={celebrationConfig.message}
          badgeName={celebrationConfig.badgeName}
          badgeIcon={celebrationConfig.badgeIcon}
          onClose={() => setCelebrationConfig(null)}
        />
      )}

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
              <span className="text-lg">🚀</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome to DraftPilot, {firstName}
              </h1>
              <p className="text-sm text-text-muted">
                Complete the 4 setup steps below to unlock milestone badges and start 5× reply velocity
              </p>
            </div>
          </div>
        </motion.div>

        {/* ===== Progress Checklist Card ===== */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="rounded-3xl border border-border bg-bg-card/90 backdrop-blur-xl p-6 sm:p-8 shadow-xl space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <h2 className="text-base font-bold text-text">Onboarding Progress Checklist</h2>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                {completedCount} of 4 steps completed ({progressPercent}%)
              </p>
            </div>
            {isAllCompleted ? (
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto shadow-sm">
                <span>🏆</span>
                <span>All Milestones Achieved!</span>
              </span>
            ) : (
              <span className="text-xs font-mono text-accent-light font-bold">
                {4 - completedCount} step{4 - completedCount > 1 ? 's' : ''} remaining
              </span>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-elevated rounded-full overflow-hidden p-0.5 border border-border/60">
            <motion.div
              className="h-full bg-gradient-to-r from-accent via-purple-500 to-cyan rounded-full shadow-[0_0_12px_rgba(124,58,237,0.7)]"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(2, progressPercent)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>

          {/* 4 Interactive Checklist Steps */}
          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            {steps.map((step) => (
              <div
                key={step.id}
                onClick={step.onAction}
                className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 cursor-pointer ${
                  step.completed
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-border bg-elevated/40 hover:border-accent/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                      step.completed
                        ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                        : 'border-border bg-bg text-text-dim'
                    }`}
                  >
                    {step.completed ? '✓' : step.icon}
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${step.completed ? 'text-emerald-400 line-through' : 'text-text'}`}>
                      {step.title}
                    </p>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                    step.completed
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-accent/15 text-accent-light'
                  }`}
                >
                  {step.actionLabel}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ===== Milestone Achievement Badges Showcase ===== */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="rounded-3xl border border-border bg-bg-card/90 backdrop-blur-xl p-6 sm:p-8 shadow-xl space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏅</span>
              <h2 className="text-base font-bold text-text">Milestone Achievement Badges (5)</h2>
            </div>
            <span className="text-xs text-text-dim">
              Unlocked badges sync across team profiles
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {achievementBadges.map((badge) => (
              <div
                key={badge.id}
                className={`p-4 rounded-2xl border text-center flex flex-col items-center justify-between space-y-2.5 transition-all relative overflow-hidden ${
                  badge.isUnlocked
                    ? 'border-accent/60 bg-gradient-to-b from-accent/15 to-elevated shadow-[0_0_20px_rgba(124,58,237,0.25)]'
                    : 'border-border/60 bg-bg/40 opacity-50 grayscale'
                }`}
              >
                {/* Badge Icon with aura if unlocked */}
                <div className="relative">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                      badge.isUnlocked
                        ? 'bg-gradient-to-tr from-accent to-cyan text-white shadow-md'
                        : 'bg-elevated text-text-dim'
                    }`}
                  >
                    {badge.icon}
                  </div>
                  {badge.isUnlocked && (
                    <div className="absolute -inset-1 rounded-xl bg-accent opacity-30 blur-sm -z-10 animate-pulse" />
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-bold text-text truncate w-full">{badge.name}</h3>
                  <p className="text-[10px] text-text-dim mt-0.5 line-clamp-2">
                    {badge.description}
                  </p>
                </div>

                <span
                  className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    badge.isUnlocked
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-elevated text-text-dim border border-border'
                  }`}
                >
                  {badge.isUnlocked ? 'Unlocked ✨' : 'Locked 🔒'}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ===== Interactive Demo Draft Section ===== */}
        <div className="grid lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="lg:col-span-2 rounded-3xl border border-border bg-bg-card/90 backdrop-blur-xl overflow-hidden shadow-xl"
          >
            <div className="px-6 py-4 bg-gradient-to-r from-amber-500/10 to-accent/10 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-accent/20 border border-accent/40 text-accent-light text-[10px] font-bold uppercase tracking-wider">
                  ⚡ Live Interactive Draft
                </span>
                <span className="text-xs text-text-muted">
                  Test reply synthesis &amp; PII redaction
                </span>
              </div>
              <button
                type="button"
                onClick={handleTriggerDemoDraft}
                className="px-3.5 py-1 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)] cursor-pointer"
              >
                Synthesize AI Reply →
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Customer Email Thread */}
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
                <div className="ml-10 p-4 rounded-2xl bg-elevated/60 border border-border/50 text-xs text-text-muted leading-relaxed whitespace-pre-line">
                  {DEMO_DRAFT_EXAMPLE.customerEmail.body}
                </div>
              </div>

              {/* AI Draft Reply Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
                      <span className="text-xs">⚡</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-accent-light">DraftPilot AI Draft</p>
                      <p className="text-[11px] text-text-dim">
                        Macro used: <span className="text-text-muted">{DEMO_DRAFT_EXAMPLE.aiDraft.macroUsed}</span>
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                    {DEMO_DRAFT_EXAMPLE.aiDraft.confidence}% match
                  </span>
                </div>

                <div
                  onClick={() => setExpandedDraft(!expandedDraft)}
                  className="ml-10 cursor-pointer"
                >
                  <AnimatePresence mode="wait">
                    {expandedDraft ? (
                      <motion.div
                        key="expanded"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 rounded-2xl bg-accent/10 border border-accent/30 text-xs text-text leading-relaxed whitespace-pre-line shadow-inner"
                      >
                        {DEMO_DRAFT_EXAMPLE.aiDraft.body}
                      </motion.div>
                    ) : (
                      <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 text-xs text-text-muted">
                        Click to expand AI draft preview...
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Actions & Navigation (1 col) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="rounded-3xl border border-border bg-bg-card/90 backdrop-blur-xl p-6 flex flex-col justify-between space-y-6 shadow-xl"
          >
            <div className="space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>⚡</span>
                <span>Quick Actions</span>
              </h3>

              <button
                type="button"
                onClick={() => setIsInstallModalOpen(true)}
                className="w-full p-3 rounded-xl bg-accent/10 hover:bg-accent/20 border border-accent/30 text-left text-xs font-semibold text-accent-light transition-all cursor-pointer flex items-center gap-2.5"
              >
                <span>🧩</span>
                <span>Install Chrome Extension</span>
              </button>

              <button
                type="button"
                onClick={() => setIsInviteModalOpen(true)}
                className="w-full p-3 rounded-xl bg-elevated hover:bg-white/5 border border-border text-left text-xs font-semibold text-text transition-all cursor-pointer flex items-center gap-2.5"
              >
                <span>👥</span>
                <span>Invite Team Co-Pilot</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerDemoDraft}
                className="w-full p-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-left text-xs font-semibold text-purple-300 transition-all cursor-pointer flex items-center gap-2.5"
              >
                <span>🎉</span>
                <span>Test First AI Draft Trigger</span>
              </button>
            </div>

            {onNavigateToDashboard && (
              <div className="pt-4 border-t border-border/40">
                <button
                  type="button"
                  onClick={onNavigateToDashboard}
                  className="w-full py-2.5 px-4 rounded-xl bg-elevated hover:bg-white/5 border border-border text-xs text-text font-bold transition-all cursor-pointer text-center"
                >
                  Enter Main Dashboard →
                </button>
              </div>
            )}
          </motion.div>
        </div>

        {/* ===== Demo Macro Library ===== */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
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
                className="rounded-2xl border border-border bg-bg-card/70 backdrop-blur-sm p-4 space-y-3 hover:border-border-hover transition-colors"
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
          transition={{ delay: 0.45, duration: 0.4 }}
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

      {/* ===== Chrome Extension Install Modal ===== */}
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
                type="button"
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
                <div className="p-4 rounded-2xl bg-gradient-to-r from-accent/15 to-cyan/15 border border-accent/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-text text-sm">Download Extension (.zip)</p>
                      <p className="text-text-muted text-[11px]">Free direct download · Developer unpacked ready</p>
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

                <div className="p-4 rounded-2xl bg-elevated/70 border border-border space-y-2 text-[11px] text-text-muted">
                  <p className="font-semibold text-text">Quick Setup:</p>
                  <p>1. Download and unzip <code>draftpilot-extension.zip</code>.</p>
                  <p>2. In Chrome, open <code>chrome://extensions</code> and turn ON Developer mode.</p>
                  <p>3. Click &quot;Load unpacked&quot; and select the extracted folder.</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    updateStep('extension_installed', true);
                    setIsInstallModalOpen(false);
                    setCelebrationConfig({
                      isActive: true,
                      title: '🧩 Extension Pioneer Unlocked!',
                      message: 'Chrome extension connected! DraftPilot will now display inline assistance in Gmail.',
                      badgeName: 'Extension Pioneer',
                      badgeIcon: '🧩',
                    });
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)] cursor-pointer text-center"
                >
                  ✓ Done! I Installed the Extension
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===== Invite Team Member Modal ===== */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-3xl bg-bg-card border border-border p-6 sm:p-8 shadow-2xl space-y-5 relative"
            >
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="absolute right-5 top-5 text-text-dim hover:text-text text-sm p-1 rounded-full bg-elevated border border-border cursor-pointer"
              >
                ✕
              </button>

              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 border border-accent/40 text-accent-light text-xs font-bold mb-2">
                  <span>👥</span>
                  <span>Team Collaboration</span>
                </div>
                <h3 className="text-xl font-bold text-text">Invite Team Member</h3>
                <p className="text-xs text-text-muted mt-1">
                  Add a colleague to your workspace to share macros and draft limits.
                </p>
              </div>

              <form onSubmit={handleSendInvite} className="space-y-4 text-xs">
                <div>
                  <label className="block text-text font-semibold mb-1">Teammate Email</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="agent@company.com"
                    className="w-full rounded-xl bg-bg border border-border px-3.5 py-2.5 text-text focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-bg border border-border text-text-dim hover:text-text cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold shadow-[0_0_15px_rgba(124,58,237,0.4)] transition-all cursor-pointer"
                  >
                    Send Invitation
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-border bg-bg-card/70 backdrop-blur-sm p-4 text-center space-y-1.5">
      <span className="text-lg">{icon}</span>
      <p className="text-xl font-extrabold font-mono tracking-tight">{value}</p>
      <p className="text-[10px] text-text-dim">{label}</p>
    </div>
  );
}
