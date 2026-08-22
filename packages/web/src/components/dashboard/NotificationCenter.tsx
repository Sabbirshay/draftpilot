'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardTab } from './DashboardHeader';

export interface NotificationItem {
  id: string;
  type: 'team' | 'kb' | 'billing' | 'founder' | 'system';
  title: string;
  message: string;
  timestamp: string;
  unread: boolean;
  actionTab?: DashboardTab;
  actionLabel?: string;
  badge?: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    type: 'founder',
    title: 'Personal Welcome from DraftPilot Founder',
    message: 'Welcome to DraftPilot! I added 500 bonus AI draft tokens to your workspace. Feel free to ping me directly if you need custom system prompt tuning.',
    timestamp: '15m ago',
    unread: true,
    actionTab: 'overview',
    actionLabel: 'View Workspace Overview',
    badge: 'Founder Message 👑',
  },
  {
    id: 'notif-2',
    type: 'kb',
    title: 'Knowledge Base Vector Indexing Complete',
    message: 'File "Customer_Support_Policy_&_Refunds_2026.pdf" was fully parsed. 84 vector chunks are now active in your Gmail AI drafting assistant.',
    timestamp: '42m ago',
    unread: true,
    actionTab: 'macros',
    actionLabel: 'View 50 Auto Macros',
    badge: 'KB Ingestion 🧠',
  },
  {
    id: 'notif-3',
    type: 'team',
    title: 'New Team Member Onboarded',
    message: 'Sarah Jenkins (sarah@company.com) joined your support team and paired her Chrome Extension with your workspace secret key.',
    timestamp: '2h ago',
    unread: true,
    actionTab: 'team',
    actionLabel: 'Manage Team Seats',
    badge: 'Team Seat 👥',
  },
  {
    id: 'notif-4',
    type: 'billing',
    title: 'Upcoming Subscription Renewal Notice',
    message: 'Your monthly Team Plan ($76.00 / 4 active seats) is scheduled for renewal on September 01, 2026. Auto-pay is active.',
    timestamp: '5h ago',
    unread: false,
    actionTab: 'billing',
    actionLabel: 'View Billing Portal',
    badge: 'Billing Alert 💳',
  },
  {
    id: 'notif-5',
    type: 'system',
    title: 'Feature Release: Gmail Inline Autocomplete',
    message: 'Ghost text tab-to-complete suggestions are now enabled for all 4 agents in your workspace compose window.',
    timestamp: 'Yesterday',
    unread: false,
    actionTab: 'gmail',
    actionLabel: 'Check Gmail Sync',
    badge: 'System Update ⚡',
  },
];

interface NotificationCenterProps {
  onNavigateTab: (tab: DashboardTab) => void;
}

export default function NotificationCenter({ onNavigateTab }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [filter, setFilter] = useState<'all' | 'unread' | 'founder' | 'billing'>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => n.unread).length;

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, unread: false })));
  };

  const handleToggleRead = (id: string) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, unread: !n.unread } : n))
    );
  };

  const handleDeleteNotif = (id: string) => {
    setNotifications(notifications.filter((n) => n.id !== id));
  };

  const handleActionClick = (notif: NotificationItem) => {
    if (notif.actionTab) {
      onNavigateTab(notif.actionTab);
      // Mark as read
      setNotifications(notifications.map((n) => (n.id === notif.id ? { ...n, unread: false } : n)));
      setIsOpen(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return n.unread;
    if (filter === 'founder') return n.type === 'founder';
    if (filter === 'billing') return n.type === 'billing';
    return true;
  });

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
              {[
                { id: 'all', label: 'All' },
                { id: 'unread', label: `Unread (${unreadCount})` },
                { id: 'founder', label: '👑 Founder' },
                { id: 'billing', label: '💳 Billing' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id as any)}
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
                  <div className="text-3xl">📭</div>
                  <p className="text-xs font-semibold">No notifications in this filter</p>
                  <p className="text-[11px]">You are all caught up!</p>
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
