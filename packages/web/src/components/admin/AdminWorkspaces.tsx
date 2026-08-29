'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

interface WorkspaceData {
  id: string;
  name: string;
  domain: string;
  ownerEmail: string;
  plan: 'Free' | 'Team' | 'Enterprise';
  seats: number;
  monthlyQuota: number;
  usedDrafts: number;
  status: 'Active' | 'Frozen' | 'Trial';
  createdAt: string;
}

export default function AdminWorkspaces() {
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editingWorkspace, setEditingWorkspace] = useState<WorkspaceData | null>(null);
  const [overrideQuotaVal, setOverrideQuotaVal] = useState<number>(50);
  const [overridePlanVal, setOverridePlanVal] = useState<'Free' | 'Team' | 'Enterprise'>('Free');
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Fetch real workspaces from Supabase
  const fetchWorkspaces = async () => {
    setLoading(true);
    try {
      const { data: teams, error } = await supabase
        .from('teams')
        .select('*, users(*)')
        .order('created_at', { ascending: false });

      if (!error && teams) {
        const mapped: WorkspaceData[] = teams.map((t: any) => {
          const owner = t.users?.find((u: any) => u.role === 'owner') || t.users?.[0];
          const email = owner?.email || 'admin@workspace.com';
          const domain = email.includes('@') ? email.split('@')[1] : 'workspace.io';

          return {
            id: t.id,
            name: t.name || 'Support Workspace',
            domain,
            ownerEmail: email,
            plan: (t.plan === 'team' ? 'Team' : t.plan === 'enterprise' ? 'Enterprise' : 'Free') as any,
            seats: t.users?.length || 1,
            monthlyQuota: t.monthly_draft_limit || 50,
            usedDrafts: 0,
            status: 'Active',
            createdAt: t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : '2026-08-01',
          };
        });

        setWorkspaces(mapped);
      }
    } catch (err) {
      console.warn('Could not load workspaces from Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const filtered = workspaces.filter((ws) => {
    const matchesSearch =
      ws.name.toLowerCase().includes(search.toLowerCase()) ||
      ws.domain.toLowerCase().includes(search.toLowerCase()) ||
      ws.ownerEmail.toLowerCase().includes(search.toLowerCase());
    const matchesPlan = filterPlan === 'all' || ws.plan.toLowerCase() === filterPlan.toLowerCase();
    return matchesSearch && matchesPlan;
  });

  const handleOpenOverride = (ws: WorkspaceData) => {
    setEditingWorkspace(ws);
    setOverrideQuotaVal(ws.monthlyQuota);
    setOverridePlanVal(ws.plan);
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkspace) return;

    try {
      await supabase
        .from('teams')
        .update({
          monthly_draft_limit: overrideQuotaVal,
          plan: overridePlanVal.toLowerCase(),
        })
        .eq('id', editingWorkspace.id);

      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === editingWorkspace.id
            ? { ...w, monthlyQuota: overrideQuotaVal, plan: overridePlanVal }
            : w
        )
      );

      setBannerNotice(
        `✓ Updated "${editingWorkspace.name}" quota to ${overrideQuotaVal.toLocaleString()} drafts/mo (${overridePlanVal} plan)!`
      );
      setEditingWorkspace(null);
      setTimeout(() => setBannerNotice(null), 4000);
    } catch (err: any) {
      alert(`Could not update workspace in Supabase: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      {bannerNotice && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between shadow-lg"
        >
          <span>{bannerNotice}</span>
          <span className="text-[10px] text-emerald-300/70">Database Updated in Real-Time</span>
        </motion.div>
      )}

      {/* Control Strip & Filters */}
      <div className="p-6 rounded-3xl bg-elevated/70 border border-border/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-text">Customer Workspaces &amp; Quotas</h3>
          <p className="text-xs text-text-dim">
            Manage customer subscription limits, member seats, and draft allowances in real-time
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workspace or email..."
            className="px-3.5 py-2 rounded-xl bg-bg border border-border text-xs text-text placeholder-text-dim outline-none focus:border-accent"
          />

          <select
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-accent"
          >
            <option value="all">All Plans</option>
            <option value="free">Free</option>
            <option value="team">Team</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
      </div>

      {/* Workspaces Table */}
      <div className="rounded-3xl bg-elevated/70 border border-border/80 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg/60 border-b border-border/60 text-text-dim uppercase font-mono text-[10px]">
              <tr>
                <th className="py-3 px-5">Workspace / Domain</th>
                <th className="py-3 px-5">Owner</th>
                <th className="py-3 px-5">Plan Tier</th>
                <th className="py-3 px-5">Monthly Draft Quota</th>
                <th className="py-3 px-5">Seats</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {filtered.map((ws) => (
                <tr key={ws.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-4 px-5">
                    <div className="font-sans font-bold text-text text-sm">{ws.name}</div>
                    <div className="text-[11px] text-text-dim">{ws.domain}</div>
                  </td>
                  <td className="py-4 px-5 text-text-muted">{ws.ownerEmail}</td>
                  <td className="py-4 px-5">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        ws.plan === 'Enterprise'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : ws.plan === 'Team'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-white/10 text-text-dim border border-border'
                      }`}
                    >
                      {ws.plan}
                    </span>
                  </td>
                  <td className="py-4 px-5">
                    <div className="font-bold text-text">
                      {ws.monthlyQuota.toLocaleString()} drafts/mo
                    </div>
                  </td>
                  <td className="py-4 px-5 text-text-muted">{ws.seats} seat(s)</td>
                  <td className="py-4 px-5 text-right font-sans">
                    <button
                      onClick={() => handleOpenOverride(ws)}
                      className="px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent text-accent-light hover:text-white text-xs font-bold transition-all border border-accent/40 cursor-pointer"
                    >
                      ⚡ Override Quota
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Quota Modal */}
      <AnimatePresence>
        {editingWorkspace && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-elevated border border-border/80 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="text-base font-bold text-text">
                  Override Quota: {editingWorkspace.name}
                </h3>
                <button
                  onClick={() => setEditingWorkspace(null)}
                  className="text-text-dim hover:text-text text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveOverride} className="space-y-4">
                <div>
                  <label className="block text-xs text-text-dim mb-1 font-mono">Plan Tier</label>
                  <select
                    value={overridePlanVal}
                    onChange={(e) => setOverridePlanVal(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-border text-sm text-text outline-none focus:border-accent"
                  >
                    <option value="Free">Free (Default 50 drafts)</option>
                    <option value="Team">Team (Default 1,000 drafts)</option>
                    <option value="Enterprise">Enterprise (Custom quota)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-text-dim mb-1 font-mono">
                    Monthly Draft Quota Allowance
                  </label>
                  <input
                    type="number"
                    value={overrideQuotaVal}
                    onChange={(e) => setOverrideQuotaVal(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-border text-sm text-text outline-none focus:border-accent font-mono"
                    min="10"
                    step="50"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOverrideQuotaVal(500)}
                    className="flex-1 py-1.5 rounded-lg bg-bg border border-border text-xs text-text-dim hover:text-text"
                  >
                    +500
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideQuotaVal(2000)}
                    className="flex-1 py-1.5 rounded-lg bg-bg border border-border text-xs text-text-dim hover:text-text"
                  >
                    +2,000
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideQuotaVal(10000)}
                    className="flex-1 py-1.5 rounded-lg bg-bg border border-border text-xs text-text-dim hover:text-text"
                  >
                    +10,000
                  </button>
                </div>

                <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingWorkspace(null)}
                    className="px-4 py-2 rounded-xl bg-bg border border-border text-xs text-text-muted hover:text-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-md shadow-accent/25"
                  >
                    Save &amp; Apply in Supabase
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
