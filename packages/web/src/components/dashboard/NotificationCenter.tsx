'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardTab } from './DashboardHeader';
import { useAuth } from '@/components/providers/AuthProvider';

export type NotificationType = 'welcome' | 'milestone' | 'team' | 'system' | 'kb' | 'billing';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  unread: boolean;
  actionTab?: DashboardTab;
  actionLabel?: string;
  badge?: string;
}

export interface MilestoneFlags {
  extensionInstalled?: boolean;
  firstMacroAdded?: boolean;
  firstDraftGenerated?: boolean;
  teamMemberInvited?: boolean;
}

export type NotificationFilter = 'all' | 'unread' | 'milestones' | 'system';

export const STORAGE_KEY_READ = 'draftpilot_read_notifications';
export const STORAGE_KEY_DISMISSED = 'draftpilot_dismissed_notifications';

export const EMPTY_STATE_TEXT = "No new notifications. You're all caught up! ✨";

export const WELCOME_NOTIFICATION: NotificationItem = {
  id: 'notif-welcome',
  type: 'welcome',
  title: 'Welcome to DraftPilot!',
  message: 'Your AI drafting workspace is ready. Install the extension, create your first macro, and start drafting responses in seconds.',
  timestamp: 'Just now',
  unread: true,
  actionTab: 'overview',
  actionLabel: 'Explore Workspace',
  badge: 'Getting Started 🚀',
};

export function getMilestoneNotifications(milestones: MilestoneFlags): NotificationItem[] {
  const items: NotificationItem[] = [];

  if (milestones.extensionInstalled) {
    items.push({
      id: 'notif-milestone-extension',
      type: 'milestone',
      title: 'Extension Pioneer Unlocked',
      message: 'DraftPilot Chrome Extension is paired and ready for inline Gmail drafting.',
      timestamp: 'Active',
      unread: true,
      actionTab: 'gmail',
      actionLabel: 'Check Gmail Sync',
      badge: 'Extension Pioneer 🧩',
    });
  }

  if (milestones.firstMacroAdded) {
    items.push({
      id: 'notif-milestone-macro',
      type: 'milestone',
      title: 'Macro Architect Unlocked',
      message: 'Your custom support macro was saved. You can now trigger canned templates in 1 click.',
      timestamp: 'Active',
      unread: true,
      actionTab: 'macros',
      actionLabel: 'View Macros',
      badge: 'Macro Architect 📐',
    });
  }

  if (milestones.firstDraftGenerated) {
    items.push({
      id: 'notif-milestone-draft',
      type: 'milestone',
      title: 'AI Copilot Ace Unlocked',
      message: 'First AI reply generated! Context-aware reply synthesized with PII privacy scrubbing.',
      timestamp: 'Active',
      unread: true,
      actionTab: 'overview',
      actionLabel: 'View Activity',
      badge: 'AI Copilot Ace ⚡',
    });
  }

  if (milestones.teamMemberInvited) {
    items.push({
      id: 'notif-milestone-team',
      type: 'team',
      title: 'Team Builder Unlocked',
      message: 'New teammate invited to collaborate in your shared AI drafting workspace.',
      timestamp: 'Active',
      unread: true,
      actionTab: 'team',
      actionLabel: 'Manage Team',
      badge: 'Team Builder 👥',
    });
  }

  return items;
}

export function buildNotificationList(
  milestones: MilestoneFlags,
  readIds: string[],
  dismissedIds: string[]
): NotificationItem[] {
  const candidates: NotificationItem[] = [
    WELCOME_NOTIFICATION,
    ...getMilestoneNotifications(milestones),
  ];

  return candidates
    .filter((notif) => !dismissedIds.includes(notif.id))
    .map((notif) => ({
      ...notif,
      unread: !readIds.includes(notif.id),
    }));
}

export function getStoredIds(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredIds(key: string, ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Ignore in storage-restricted environments
  }
}

export function readCurrentMilestones(onboardingState?: any): MilestoneFlags {
  let extensionInstalled = Boolean(onboardingState?.extension_installed);
  let firstMacroAdded = Boolean(onboardingState?.first_macro_added);
  let firstDraftGenerated = Boolean(onboardingState?.first_draft_generated);
  let teamMemberInvited = Boolean(onboardingState?.team_member_invited);

  if (typeof window !== 'undefined') {
    try {
      if (
        document.documentElement.getAttribute('data-draftpilot-extension-installed') === 'true' ||
        localStorage.getItem('draftpilot_extension_installed') === 'true'
      ) {
        extensionInstalled = true;
      }
      if (localStorage.getItem('draftpilot_first_macro_added') === 'true') {
        firstMacroAdded = true;
      }
      if (localStorage.getItem('draftpilot_first_draft_generated') === 'true') {
        firstDraftGenerated = true;
      }
      if (localStorage.getItem('draftpilot_team_member_invited') === 'true') {
        teamMemberInvited = true;
      }
    } catch {
      // Ignore localStorage read errors
    }
  }

  return {
    extensionInstalled,
    firstMacroAdded,
    firstDraftGenerated,
    teamMemberInvited,
  };
}

function useSafeAuth() {
  try {
    return useAuth();
  } catch {
    return null;
  }
}

interface NotificationCenterProps {
  onNavigateTab: (tab: DashboardTab) => void;
}

export default function NotificationCenter({ onNavigateTab }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [readIds, setReadIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<MilestoneFlags>({
    extensionInstalled: false,
    firstMacroAdded: false,
    firstDraftGenerated: false,
    teamMemberInvited: false,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const auth = useSafeAuth();
  const onboardingState = auth?.onboardingState;

  // Hydrate stored IDs and milestones on mount and when onboardingState updates
  const refreshState = useCallback(() => {
    setReadIds(getStoredIds(STORAGE_KEY_READ));
    setDismissedIds(getStoredIds(STORAGE_KEY_DISMISSED));
    setMilestones(readCurrentMilestones(onboardingState));
  }, [onboardingState]);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  // Listen for window focus, storage events, and extension detection events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUpdate = () => {
      refreshState();
    };

    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    window.addEventListener('draftpilot-extension-detected', handleUpdate);

    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
      window.removeEventListener('draftpilot-extension-detected', handleUpdate);
    };
  }, [refreshState]);

  // Re-check milestones when tray opens
  useEffect(() => {
    if (isOpen) {
      refreshState();
    }
  }, [isOpen, refreshState]);

  // Close tray when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notifications = useMemo(() => {
    return buildNotificationList(milestones, readIds, dismissedIds);
  }, [milestones, readIds, dismissedIds]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const handleMarkAllRead = () => {
    const unreadIds = notifications.filter((n) => n.unread).map((n) => n.id);
    const updated = Array.from(new Set([...readIds, ...unreadIds]));
    setReadIds(updated);
    saveStoredIds(STORAGE_KEY_READ, updated);
  };

  const handleToggleRead = (id: string) => {
    let updated: string[];
    if (readIds.includes(id)) {
      updated = readIds.filter((item) => item !== id);
    } else {
      updated = [...readIds, id];
    }
    setReadIds(updated);
    saveStoredIds(STORAGE_KEY_READ, updated);
  };

  const handleDeleteNotif = (id: string) => {
    const updated = Array.from(new Set([...dismissedIds, id]));
    setDismissedIds(updated);
    saveStoredIds(STORAGE_KEY_DISMISSED, updated);
  };

  const handleActionClick = (notif: NotificationItem) => {
    if (notif.actionTab) {
      onNavigateTab(notif.actionTab);
      // Mark as read
      if (!readIds.includes(notif.id)) {
        const updated = [...readIds, notif.id];
        setReadIds(updated);
        saveStoredIds(STORAGE_KEY_READ, updated);
      }
      setIsOpen(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return n.unread;
    if (filter === 'milestones') return n.type === 'milestone' || n.type === 'team' || n.id.startsWith('notif-milestone');
    if (filter === 'system') return n.type === 'system' || n.type === 'welcome' || n.id === 'notif-welcome';
    return true;
  });

  const FILTER_TABS: { id: NotificationFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: `Unread (${unreadCount})` },
    { id: 'milestones', label: '🏆 Milestones' },
    { id: 'system', label: '⚡ System' },
  ];

  return (
    <div ref={containerRef} className="relative">
      
      {/* ─────────────────────────────────────────────────────────────
          1. NOTIFICATIONS BELL TRIGGER BUTTON
      ───────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-full bg-elevated/80 border border-border hover:border-accent text-text-muted hover:text-text transition-all cursor-pointer shadow-sm group"
        title="Notification Center"
      >
        <svg className="w-4 h-4 text-text group-hover:text-accent-light transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white font-mono text-[10px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(124,58,237,0.8)] border border-bg animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* ─────────────────────────────────────────────────────────────
          2. NOTIFICATION TRAY MODAL / POPOVER
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute right-0 top-full mt-3 w-[92vw] sm:w-[420px] rounded-3xl bg-bg-card/98 backdrop-blur-2xl border border-accent/40 shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden z-50 flex flex-col max-h-[580px]"
          >
            {/* Header */}
            <div className="p-4 sm:px-5 border-b border-border/50 flex items-center justify-between bg-elevated/60">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-text">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-accent-light text-[10px] font-mono font-bold">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-accent-light hover:underline font-semibold cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-6 h-6 rounded-full bg-bg hover:bg-white/10 text-text-dim hover:text-text flex items-center justify-center text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 p-2 px-4 border-b border-border/40 bg-bg/50 overflow-x-auto text-[11px]">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1 rounded-full font-medium transition-all whitespace-nowrap cursor-pointer ${
                    filter === tab.id
                      ? 'bg-accent text-white font-bold shadow-sm'
                      : 'text-text-muted hover:text-text hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Notifications List */}
            <div className="divide-y divide-border/40 overflow-y-auto flex-1">
              {filteredNotifications.length === 0 ? (
                <div className="p-10 text-center text-text-dim space-y-2">
                  <div className="text-3xl">✨</div>
                  <p className="text-xs font-semibold text-text">{"No new notifications. You're all caught up! ✨"}</p>
                  <p className="text-[11px] text-text-muted">
                    Workspace activity and milestone achievements will appear here.
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 transition-colors relative group flex flex-col justify-between ${
                      notif.unread
                        ? 'bg-accent/10 hover:bg-accent/15'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {notif.badge && (
                            <span className="px-2 py-0.5 rounded-md bg-bg border border-border text-[10px] font-mono text-text-muted">
                              {notif.badge}
                            </span>
                          )}
                          <span className="text-[10px] text-text-dim font-mono">{notif.timestamp}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {notif.unread && (
                            <span className="w-2 h-2 rounded-full bg-accent-light shadow-[0_0_6px_rgba(167,139,250,0.9)]" />
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteNotif(notif.id)}
                            className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-red-400 text-xs p-0.5 transition-opacity cursor-pointer"
                            title="Dismiss"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <h5 className="font-bold text-xs text-text leading-snug">
                        {notif.title}
                      </h5>

                      <p className="text-[11px] text-text-muted leading-relaxed">
                        {notif.message}
                      </p>
                    </div>

                    {/* Action Button */}
                    {notif.actionTab && (
                      <div className="pt-2 mt-2 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleActionClick(notif)}
                          className="text-[11px] font-semibold text-accent-light hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>{notif.actionLabel || 'View Details'}</span>
                          <span>→</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleRead(notif.id)}
                          className="text-[10px] text-text-dim hover:text-text transition-colors cursor-pointer"
                        >
                          {notif.unread ? 'Mark read' : 'Mark unread'}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-border/40 bg-bg/80 text-[11px] text-text-dim flex items-center justify-between">
              <span>Real-time Workspace Feed</span>
              <span className="text-emerald-400 font-mono">● Connected</span>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

