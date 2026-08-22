'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';

export default function GmailSyncManager() {
  const { dbUser, user } = useAuth();
  const teamId = dbUser?.team_id || user?.id || 'team';
  const apiKey = `dp_live_${teamId.replace(/-/g, '').slice(0, 20)}`;
  const [copied, setCopied] = useState(false);
  const [scrubCards, setScrubCards] = useState(true);
  const [scrubPhones, setScrubPhones] = useState(true);
  const [scrubEmails, setScrubEmails] = useState(true);
  const [scrubSecrets, setScrubSecrets] = useState(true);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className="p-6 rounded-3xl bg-elevated/70 border border-border/80 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl font-bold">
            ✉️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-text">Gmail Chrome Extension Sync</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                ONLINE &amp; SYNCED
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              DraftPilot Side Panel active in <code>mail.google.com</code>
            </p>
          </div>
        </div>

        <button 
          onClick={() => alert('Instructions: 1. Open Chrome > Extensions. 2. Enable Developer Mode. 3. Click Load Unpacked and select packages/extension/dist.')}
          className="px-4 py-2 rounded-xl bg-bg border border-border hover:border-accent text-xs font-semibold text-text transition-colors cursor-pointer"
        >
          View Install Guide →
        </button>
      </div>

      {/* Extension API Key Card */}
      <div className="p-6 rounded-3xl bg-elevated/70 border border-border/80 shadow-lg">
        <h3 className="text-sm font-bold text-text mb-1">Team Workspace Secret Key</h3>
        <p className="text-xs text-text-muted mb-4">
          Agents enter this key in their Chrome extension side panel during initial onboarding to sync team macros.
        </p>

        <div className="flex items-center gap-2 max-w-xl">
          <input
            type="password"
            readOnly
            value={apiKey}
            className="flex-1 px-4 py-2.5 rounded-xl bg-bg border border-border text-xs font-mono text-text outline-none"
          />
          <button
            onClick={handleCopy}
            className="px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)] cursor-pointer shrink-0"
          >
            {copied ? '✓ Copied!' : 'Copy Key'}
          </button>
        </div>
      </div>

      {/* Client-side PII Scrubbing Rules */}
      <div className="p-6 rounded-3xl bg-elevated/70 border border-border/80 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-text">Client-Side PII Scrubbing Rules</h3>
          <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent-light text-[10px] font-bold">
            Zero Data Retention
          </span>
        </div>
        <p className="text-xs text-text-muted mb-6">
          DraftPilot automatically scrubs sensitive customer data right inside the browser before any thread snippet is evaluated.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="p-4 rounded-2xl bg-bg/80 border border-border flex items-center justify-between cursor-pointer hover:border-accent/40 transition-colors">
            <div>
              <p className="text-xs font-semibold text-text">Credit Cards &amp; CVV</p>
              <p className="text-[11px] text-text-dim">Redacts 13-19 digit card numbers</p>
            </div>
            <input
              type="checkbox"
              checked={scrubCards}
              onChange={(e) => setScrubCards(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-elevated text-accent accent-accent"
            />
          </label>

          <label className="p-4 rounded-2xl bg-bg/80 border border-border flex items-center justify-between cursor-pointer hover:border-accent/40 transition-colors">
            <div>
              <p className="text-xs font-semibold text-text">Phone &amp; Contact Numbers</p>
              <p className="text-[11px] text-text-dim">Redacts international formats</p>
            </div>
            <input
              type="checkbox"
              checked={scrubPhones}
              onChange={(e) => setScrubPhones(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-elevated text-accent accent-accent"
            />
          </label>

          <label className="p-4 rounded-2xl bg-bg/80 border border-border flex items-center justify-between cursor-pointer hover:border-accent/40 transition-colors">
            <div>
              <p className="text-xs font-semibold text-text">Customer Email Addresses</p>
              <p className="text-[11px] text-text-dim">Redacts personal email handles</p>
            </div>
            <input
              type="checkbox"
              checked={scrubEmails}
              onChange={(e) => setScrubEmails(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-elevated text-accent accent-accent"
            />
          </label>

          <label className="p-4 rounded-2xl bg-bg/80 border border-border flex items-center justify-between cursor-pointer hover:border-accent/40 transition-colors">
            <div>
              <p className="text-xs font-semibold text-text">Passwords &amp; API Tokens</p>
              <p className="text-[11px] text-text-dim">Redacts bearer tokens and secrets</p>
            </div>
            <input
              type="checkbox"
              checked={scrubSecrets}
              onChange={(e) => setScrubSecrets(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-elevated text-accent accent-accent"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
