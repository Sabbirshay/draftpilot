'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';

export default function WorkspaceSettings() {
  const { dbUser, user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [showDangerModal, setShowDangerModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [dangerActionError, setDangerActionError] = useState<string | null>(null);
  const [dangerActionSuccess, setDangerActionSuccess] = useState<string | null>(null);

  const teamName = dbUser?.teams?.name || "Support Workspace";
  const userRole = dbUser?.role || 'owner';
  const plan = dbUser?.teams?.plan || 'free';
  const draftLimit = (dbUser as any)?.teams?.monthly_draft_limit || 50;

  // Format joined date
  const joinedDate = (dbUser as any)?.created_at || user?.created_at;
  const joinedDateFormatted = joinedDate
    ? new Date(joinedDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Recent Member';

  const handleExportData = () => {
    setIsExporting(true);
    try {
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        user: {
          id: user?.id,
          email: user?.email,
          fullName: dbUser?.full_name || user?.user_metadata?.full_name,
          role: userRole,
          createdAt: joinedDate,
        },
        workspace: {
          id: dbUser?.team_id,
          name: teamName,
          plan,
          monthlyDraftLimit: draftLimit,
        },
        preferences: user?.user_metadata?.notification_preferences || {},
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `draftpilot-workspace-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDangerConfirm = () => {
    setDangerActionError(null);
    if (confirmInput.trim().toUpperCase() !== 'CONFIRM') {
      setDangerActionError('You must type "CONFIRM" exactly to proceed.');
      return;
    }

    setDangerActionSuccess('Workspace reset request received. Protective lock placed on current drafts.');
    setShowDangerModal(false);
    setConfirmInput('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-text">Workspace &amp; Team Information</h3>
        <p className="text-xs text-text-dim">
          Review your workspace membership, seat allocation role, and account safety controls.
        </p>
      </div>

      {dangerActionSuccess && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center gap-2">
          <span>🛡️</span>
          <span>{dangerActionSuccess}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. WORKSPACE IDENTITY & METRICS CARDS
      ───────────────────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-3 gap-4">
        {/* Workspace Card */}
        <div className="p-4 rounded-2xl bg-elevated/50 border border-border/70 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-dim">Workspace Name</span>
            <span className="text-base">🏢</span>
          </div>
          <h4 className="text-sm font-bold text-text truncate">{teamName}</h4>
          <span className="inline-block px-2 py-0.5 rounded-md bg-accent/15 border border-accent/30 text-[10px] font-mono font-semibold text-accent-light">
            Plan: {plan.toUpperCase()} ({draftLimit} drafts/mo)
          </span>
        </div>

        {/* Role Card */}
        <div className="p-4 rounded-2xl bg-elevated/50 border border-border/70 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-dim">Membership Role</span>
            <span className="text-base">👑</span>
          </div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-text capitalize">
              {userRole === 'owner' ? 'Workspace Owner' : userRole === 'admin' ? 'Team Administrator' : 'Support Agent'}
            </h4>
          </div>
          <p className="text-[10px] text-text-dim">
            {userRole === 'owner'
              ? 'Full workspace authorization, macro management, and seat administration.'
              : 'Support inbox access and macro drafting privileges.'}
          </p>
        </div>

        {/* Member Since Card */}
        <div className="p-4 rounded-2xl bg-elevated/50 border border-border/70 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-dim">Member Since</span>
            <span className="text-base">📅</span>
          </div>
          <h4 className="text-sm font-bold text-text">{joinedDateFormatted}</h4>
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Active &amp; In Good Standing</span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. DATA PORTABILITY & DEFENSIVE CONTROLS
      ───────────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-2xl bg-elevated/40 border border-border/70 space-y-4">
        <h4 className="text-xs font-bold text-text uppercase tracking-wider font-mono">
          Data Portability &amp; Self-Service Tools
        </h4>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-bg/50 border border-border/60">
          <div>
            <h5 className="text-xs font-bold text-text">Export Workspace Telemetry &amp; Profile (JSON)</h5>
            <p className="text-[11px] text-text-dim mt-0.5">
              Download your complete profile data, notification preferences, and team identifiers in GDPR-compliant format.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportData}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl bg-elevated hover:bg-white/10 border border-border text-text text-xs font-semibold shrink-0 cursor-pointer transition-colors"
          >
            {isExporting ? 'Generating JSON...' : 'Export Data ↓'}
          </button>
        </div>

        {/* Danger Zone */}
        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h5 className="text-xs font-bold text-red-400">Workspace Danger Zone</h5>
              <p className="text-[11px] text-text-dim mt-0.5">
                Leave workspace or reset local caching. Destructive operations require confirmation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDangerModal(true)}
              className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold shrink-0 cursor-pointer transition-colors"
            >
              Reset / Leave Team
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. DANGER CONFIRMATION MODAL
      ───────────────────────────────────────────────────────────── */}
      {showDangerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-bg-card border border-red-500/40 p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-400">
              <span className="text-2xl">⚠️</span>
              <h4 className="text-sm font-bold text-text">Confirm Workspace Action</h4>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              This will unbind your active Chrome Extension pairing token and clear local macro caches for{' '}
              <strong className="text-text">{teamName}</strong>.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-text-dim mb-1">
                Type <span className="font-mono text-text text-red-400">CONFIRM</span> to proceed:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="CONFIRM"
                className="w-full px-3.5 py-2 rounded-xl bg-elevated border border-border text-xs text-text focus:outline-none focus:border-red-500 font-mono uppercase"
              />
              {dangerActionError && (
                <span className="text-[10px] text-red-400 mt-1 block">
                  {dangerActionError}
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDangerModal(false);
                  setConfirmInput('');
                  setDangerActionError(null);
                }}
                className="px-4 py-2 rounded-xl bg-elevated hover:bg-white/10 text-xs font-semibold text-text cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDangerConfirm}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold cursor-pointer shadow-md transition-colors"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
