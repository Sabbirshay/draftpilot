'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useExtensionStatus } from '@/hooks/useExtensionStatus';

export default function GmailSyncManager() {
  const { dbUser, user } = useAuth();
  const { status: extStatus, version: extVersion, recheck } = useExtensionStatus();
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

  // Build dynamic status presentation
  let badgeEl = null;
  let descriptionEl = null;
  let actionEl = null;
  let iconBg = 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';

  if (extStatus === 'checking') {
    iconBg = 'bg-blue-500/15 border-blue-500/30 text-blue-400';
    badgeEl = (
      <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
        Checking Extension...
      </span>
    );
    descriptionEl = <span>Detecting DraftPilot extension handshake in browser...</span>;
    actionEl = (
      <button
        onClick={recheck}
        className="px-4 py-2 rounded-xl bg-bg border border-border hover:border-accent text-xs font-semibold text-text transition-colors cursor-pointer"
      >
        Recheck Status
      </button>
    );
  } else if (extStatus === 'installed') {
    iconBg = 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
    badgeEl = (
      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
        Installed &amp; Ready {extVersion ? `(v${extVersion})` : ''}
      </span>
    );
    descriptionEl = (
      <span>
        DraftPilot Side Panel active and paired with <code>mail.google.com</code>
      </span>
    );
    actionEl = (
      <button
        onClick={() =>
          alert(
            'Extension Ready! Open mail.google.com, click reply on any customer email, and activate DraftPilot in the side panel.'
          )
        }
        className="px-4 py-2 rounded-xl bg-bg border border-border hover:border-accent text-xs font-semibold text-text transition-colors cursor-pointer"
      >
        View Install Guide →
      </button>
    );
  } else if (extStatus === 'outdated') {
    iconBg = 'bg-amber-500/15 border-amber-500/30 text-amber-400';
    badgeEl = (
      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
        Outdated Version {extVersion ? `(v${extVersion})` : ''}
      </span>
    );
    descriptionEl = (
      <span>
        Extension v{extVersion} detected. Please update to v0.1.0 for latest features and security updates.
      </span>
    );
    actionEl = (
      <button
        onClick={() =>
          alert(
            'To update: Open chrome://extensions, enable Developer Mode, and click "Update" or reload the unpacked extension.'
          )
        }
        className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-xs font-semibold text-amber-300 transition-colors cursor-pointer"
      >
        Update Extension →
      </button>
    );
  } else {
    // not_installed
    iconBg = 'bg-rose-500/15 border-rose-500/30 text-rose-400';
    badgeEl = (
      <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
        Not Installed
      </span>
    );
    descriptionEl = (
      <span>
        DraftPilot extension is not detected in your browser. Install it to enable 1-click AI drafts in Gmail.
      </span>
    );
    actionEl = (
      <div className="flex items-center gap-2">
        <button
          onClick={recheck}
          title="Recheck extension presence"
          className="px-3 py-2 rounded-xl bg-bg border border-border hover:border-accent text-xs text-text-muted hover:text-text transition-colors cursor-pointer"
        >
          🔄 Recheck
        </button>
        <button
          onClick={() =>
            alert(
              '1-Click Install Instructions:\n1. Open Chrome > Extensions (chrome://extensions)\n2. Enable Developer mode (top right toggle)\n3. Click "Load unpacked" and select the packages/extension/dist directory.'
            )
          }
          className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)] cursor-pointer"
        >
          1-Click Install Guide →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className="p-6 rounded-3xl bg-elevated/70 border border-border/80 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-xl font-bold ${iconBg}`}>
            ✉️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-text">Gmail Chrome Extension Sync</h3>
              {badgeEl}
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {descriptionEl}
            </p>
          </div>
        </div>

        {actionEl}
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
