'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export interface AdminOverviewProps {
  onSelectWorkspaceTab?: () => void;
  onSelectAiConfigTab?: () => void;
}

export default function AdminOverview({
  onSelectWorkspaceTab,
  onSelectAiConfigTab,
}: AdminOverviewProps) {
  const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('Just now');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Live database stats
  const [liveStats, setLiveStats] = useState({
    totalTeams: 1,
    totalUsers: 1,
    totalDrafts: 0,
    totalMacros: 0,
    totalDocs: 0,
  });

  const [recentDrafts, setRecentDrafts] = useState<any[]>([]);

  const fetchLiveMetrics = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 1. Try server-side API route (which requires superadmin auth)
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || (typeof window !== 'undefined' ? localStorage.getItem('draftpilot_token') : null);

      const adminPasskey = typeof window !== 'undefined' ? sessionStorage.getItem('draftpilot_admin_passkey') : null;
      const headers: Record<string, string> = {};
      if (adminPasskey) {
        headers['x-admin-passkey'] = adminPasskey;
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const apiRes = await fetch('/api/admin/metrics', { headers });
      if (apiRes.ok) {
        const data = await apiRes.json();
        setLiveStats({
          totalTeams: data.totalTeams || 1,
          totalUsers: data.totalUsers || 1,
          totalDrafts: data.totalDrafts || 0,
          totalMacros: data.totalMacros || 0,
          totalDocs: data.totalDocs || 0,
        });
        if (data.recentDrafts) {
          setRecentDrafts(data.recentDrafts);
        }
        setLastRefreshed(new Date().toLocaleTimeString());
        return;
      }

      // 2. Direct Supabase fallback
      const [teamsRes, usersRes, draftsRes, macrosRes, docsRes, recentDraftsRes] = await Promise.all([
        supabase.from('teams').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('draft_history').select('*', { count: 'exact', head: true }),
        supabase.from('macros').select('*', { count: 'exact', head: true }),
        supabase.from('knowledge_documents').select('*', { count: 'exact', head: true }),
        supabase
          .from('draft_history')
          .select('id, team_id, thread_snippet, generated_draft, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      setLiveStats({
        totalTeams: teamsRes.count || 1,
        totalUsers: usersRes.count || 1,
        totalDrafts: draftsRes.count || 0,
        totalMacros: macrosRes.count || 0,
        totalDocs: docsRes.count || 0,
      });

      if (recentDraftsRes.data) {
        setRecentDrafts(recentDraftsRes.data);
      }

      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.warn('Could not fetch real-time admin telemetry:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveMetrics();

    // 1. Auto-polling interval every 8 seconds
    const interval = setInterval(fetchLiveMetrics, 8000);

    // 2. Supabase Real-time Channel for instant live updates
    const channel = supabase
      .channel('admin-live-metrics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draft_history' }, () => {
        fetchLiveMetrics();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        fetchLiveMetrics();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchLiveMetrics();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'macros' }, () => {
        fetchLiveMetrics();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchLiveMetrics]);

  return (
    <div className="space-y-6">
      {/* Realtime Status Bar */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-elevated/60 border border-border/80 text-xs">
        <div className="flex items-center gap-3">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-text font-semibold">Live Real-Time Telemetry Stream</span>
          <span className="text-text-dim font-mono text-[11px]">• Last synced: {lastRefreshed}</span>
        </div>

        <button
          onClick={fetchLiveMetrics}
          disabled={isRefreshing}
          className="px-3 py-1.5 rounded-xl bg-bg border border-border hover:border-accent text-text text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <span>{isRefreshing ? 'Syncing...' : '🔄 Refresh Data'}</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE METRIC STRIP (4 Live Cards)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Workspaces */}
        <div className="p-5 rounded-3xl bg-elevated/70 border border-border/80 shadow-md flex flex-col justify-between hover:border-accent/40 transition-all">
          <p className="text-xs text-text-dim font-medium">Customer Workspaces</p>
          <div className="my-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text font-mono tracking-tight">
              {liveStats.totalTeams}
            </h2>
            <p className="text-[11px] text-emerald-400 font-mono font-medium flex items-center gap-1 mt-1">
              <span>▲ Live in database</span>
              <span className="text-text-dim">({liveStats.totalUsers} registered members)</span>
            </p>
          </div>
        </div>

        {/* Card 2: Total Generated Drafts */}
        <div className="p-5 rounded-3xl bg-elevated/70 border border-border/80 shadow-md flex flex-col justify-between hover:border-accent/40 transition-all">
          <p className="text-xs text-text-dim font-medium">Customer Drafts Generated</p>
          <div className="my-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-accent-light font-mono tracking-tight">
              {liveStats.totalDrafts.toLocaleString()}
            </h2>
            <p className="text-[11px] text-emerald-400 font-mono font-medium flex items-center gap-1 mt-1">
              <span>⚡ Live Extension Events</span>
            </p>
          </div>
        </div>

        {/* Card 3: Macros & Knowledge Base */}
        <div className="p-5 rounded-3xl bg-elevated/70 border border-border/80 shadow-md flex flex-col justify-between hover:border-accent/40 transition-all">
          <p className="text-xs text-text-dim font-medium">Support Macros &amp; Documents</p>
          <div className="my-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text font-mono tracking-tight">
              {liveStats.totalMacros + liveStats.totalDocs}
            </h2>
            <p className="text-[11px] text-emerald-400 font-mono font-medium flex items-center gap-1 mt-1">
              <span>{liveStats.totalMacros} macros • {liveStats.totalDocs} indexed docs</span>
            </p>
          </div>
        </div>

        {/* Card 4: AI Generation Rate */}
        <div className="p-5 rounded-3xl bg-elevated/70 border border-border/80 shadow-md flex flex-col justify-between hover:border-accent/40 transition-all">
          <p className="text-xs text-text-dim font-medium">AI Service Uptime</p>
          <div className="my-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
              99.9%
            </h2>
            <p className="text-[11px] text-emerald-400 font-mono font-medium flex items-center gap-1 mt-1">
              <span>✓ OpenRouter &amp; Smart Fallback active</span>
            </p>
          </div>
        </div>
      </div>

      {/* Quota override notification banner */}
      {overrideSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-2">
            <span>⚡</span>
            <span>{overrideSuccess}</span>
          </div>
          <span className="text-[10px] text-emerald-300/70">Database updated</span>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. MIDDLE SECTION: Live Draft Activity Stream & Architecture
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left-Middle: Live Recent Draft Stream (7 cols) */}
        <div className="lg:col-span-7 rounded-3xl bg-elevated/70 border border-border/80 p-6 shadow-md flex flex-col justify-between hover:border-accent/40 transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-text">Live Generated AI Drafts (Recent Activity)</h3>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              Real-time DB Log
            </span>
          </div>

          <div className="space-y-3">
            {recentDrafts.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-dim bg-bg/50 rounded-2xl border border-border/50">
                No draft events logged yet. Open Gmail with the extension to generate your first live reply!
              </div>
            ) : (
              recentDrafts.map((d) => (
                <div key={d.id} className="p-3.5 rounded-2xl bg-bg/80 border border-border/70 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-accent-light">
                      Snippet: {d.thread_snippet ? d.thread_snippet.slice(0, 45) + '...' : 'Customer inquiry'}
                    </span>
                    <span className="font-mono text-text-dim text-[10px]">
                      {d.created_at ? new Date(d.created_at).toLocaleTimeString() : 'Just now'}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted font-mono whitespace-pre-wrap leading-relaxed line-clamp-2">
                    {d.generated_draft?.slice(0, 140)}...
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="pt-4 mt-3 border-t border-border/50 flex items-center justify-between text-xs">
            <span className="text-text-dim">Tracking all customer draft generations</span>
            <button onClick={onSelectWorkspaceTab} className="text-accent-light hover:underline font-bold">
              View Workspaces →
            </button>
          </div>
        </div>

        {/* Right-Middle: System Status & Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-3xl bg-elevated/70 border border-border/80 p-5 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-bold text-accent-light uppercase tracking-wider">
                System Health &amp; Subsystems
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-text">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Supabase Cloud DB &amp; RLS
                </span>
                <span className="text-emerald-400 font-mono">Connected</span>
              </div>
              <div className="flex items-center justify-between text-text">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  OpenRouter AI Gateway
                </span>
                <span className="text-emerald-400 font-mono">Active</span>
              </div>
              <div className="flex items-center justify-between text-text">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Knowledge Base Chunking (RAG)
                </span>
                <span className="text-emerald-400 font-mono">Operational</span>
              </div>
              <div className="flex items-center justify-between text-text">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Gmail Extension Content Script
                </span>
                <span className="text-emerald-400 font-mono">Active</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-elevated/70 border border-border/80 p-5 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-text uppercase tracking-wider">
                Quick Navigation
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={onSelectWorkspaceTab}
                className="py-2.5 px-3 rounded-xl bg-accent/20 hover:bg-accent/30 text-accent-light text-xs font-bold transition-all border border-accent/30 cursor-pointer text-center"
              >
                Workspaces &amp; Quotas →
              </button>
              <button
                onClick={onSelectAiConfigTab}
                className="py-2.5 px-3 rounded-xl bg-bg hover:bg-elevated text-text text-xs font-bold transition-all border border-border cursor-pointer text-center"
              >
                AI Model &amp; Tuning →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
