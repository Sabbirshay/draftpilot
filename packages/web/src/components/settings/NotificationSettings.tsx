'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

export interface NotificationPreferences {
  emailWeeklyDigest: boolean;
  emailQuotaWarning: boolean;
  emailQuotaExceeded: boolean;
  teamMemberActivity: boolean;
  browserPushAlerts: boolean;
  aiModelReleaseNotes: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailWeeklyDigest: true,
  emailQuotaWarning: true,
  emailQuotaExceeded: true,
  teamMemberActivity: true,
  browserPushAlerts: false,
  aiModelReleaseNotes: true,
};

export default function NotificationSettings() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hydrate preferences on mount from localStorage and Supabase user metadata
  useEffect(() => {
    if (!user) return;

    const storageKey = `draftpilot_notif_prefs_${user.id}`;
    let loadedPrefs = DEFAULT_PREFERENCES;

    // 1. Try local storage cache
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        loadedPrefs = { ...loadedPrefs, ...JSON.parse(cached) };
      }
    } catch {
      // Ignore parse errors
    }

    // 2. Override with user_metadata if available
    const metaPrefs = user.user_metadata?.notification_preferences;
    if (metaPrefs && typeof metaPrefs === 'object') {
      loadedPrefs = { ...loadedPrefs, ...metaPrefs };
    }

    setPreferences(loadedPrefs);
  }, [user]);

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    const storageKey = `draftpilot_notif_prefs_${user.id}`;

    try {
      // 1. Persist to localStorage immediately
      localStorage.setItem(storageKey, JSON.stringify(preferences));

      // 2. Persist to Supabase user_metadata
      const { error } = await supabase.auth.updateUser({
        data: {
          notification_preferences: preferences,
        },
      });

      if (error) {
        console.warn('Could not sync notification preferences to user_metadata:', error);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving notification preferences:', err);
      setErrorMessage(err?.message || 'Failed to sync preferences to Supabase.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-text">Notification Preferences</h3>
          <p className="text-xs text-text-dim">
            Control which automated email digests, quota alerts, and activity notices DraftPilot sends.
          </p>
        </div>

        {saveSuccess && (
          <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
            <span>●</span> Saved &amp; Synced
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="space-y-3">
        {[
          {
            key: 'emailWeeklyDigest' as const,
            title: 'Weekly Performance & Time Saved Digest',
            description: 'Receive a concise Monday morning email summarizing hours saved, top macros used, and team reply velocity.',
            icon: '📊',
          },
          {
            key: 'emailQuotaWarning' as const,
            title: '80% Monthly Quota Warning',
            description: 'Alert you when your workspace reaches 80% of its monthly AI generation limit so you avoid drafting downtime.',
            icon: '⚠️',
          },
          {
            key: 'emailQuotaExceeded' as const,
            title: '100% Quota Exceeded Notification',
            description: 'Immediate alert when your workspace hits its monthly limit and drafting pauses until upgrade or next cycle.',
            icon: '🛑',
          },
          {
            key: 'teamMemberActivity' as const,
            title: 'Team Member Extension Pairing Notices',
            description: 'Notifications when an invited agent joins your team workspace and successfully pairs their Chrome extension.',
            icon: '👥',
          },
          {
            key: 'browserPushAlerts' as const,
            title: 'Desktop Push Alerts for High-Priority Inquiries',
            description: 'Display native browser notifications when incoming customer threads match urgent or refund escalation macros.',
            icon: '🔔',
          },
          {
            key: 'aiModelReleaseNotes' as const,
            title: 'Product Updates & Prompt Tuning Releases',
            description: 'Monthly changelog with new model support, autocomplete latency enhancements, and prompt customization features.',
            icon: '🚀',
          },
        ].map((item) => {
          const isEnabled = preferences[item.key];
          return (
            <div
              key={item.key}
              onClick={() => handleToggle(item.key)}
              className="p-4 rounded-2xl bg-elevated/50 border border-border/70 hover:border-accent/40 transition-all flex items-center justify-between gap-4 cursor-pointer group"
            >
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0 mt-0.5">{item.icon}</span>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-text group-hover:text-accent-light transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-text-dim leading-relaxed max-w-xl">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <div className="shrink-0">
                <div
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    isEnabled ? 'bg-accent shadow-[0_0_10px_rgba(124,58,237,0.5)]' : 'bg-bg border border-border'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      isEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-[0_0_15px_rgba(124,58,237,0.4)] disabled:opacity-50 cursor-pointer transition-all flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Saving Preferences...</span>
            </>
          ) : (
            <span>Save Preferences</span>
          )}
        </button>
      </div>
    </div>
  );
}
