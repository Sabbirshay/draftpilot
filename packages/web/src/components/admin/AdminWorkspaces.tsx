'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

const INITIAL_WORKSPACES: WorkspaceData[] = [
  {
    id: '1',
    name: 'Rian Pratama Ops',
    domain: 'rianpratama.co',
    ownerEmail: 'rian@pratama.co',
    plan: 'Team',
    seats: 8,
    monthlyQuota: 8000,
    usedDrafts: 7420,
    status: 'Active',
    createdAt: '2026-06-12',
  },
  {
    id: '2',
    name: 'Foodi QuickSupport',
    domain: 'getfoodi.io',
    ownerEmail: 'support-lead@getfoodi.io',
    plan: 'Team',
    seats: 12,
    monthlyQuota: 12000,
    usedDrafts: 9840,
    status: 'Active',
    createdAt: '2026-05-04',
  },
  {
    id: '3',
    name: 'HelpFlow CX Inc',
    domain: 'helpflow.com',
    ownerEmail: 'billing@helpflow.com',
    plan: 'Enterprise',
    seats: 25,
    monthlyQuota: 30000,
    usedDrafts: 22100,
    status: 'Active',
    createdAt: '2026-04-18',
  },
  {
    id: '4',
    name: 'ScaleByte SaaS',
    domain: 'scalebyte.dev',
    ownerEmail: 'alex@scalebyte.dev',
    plan: 'Free',
    seats: 1,
    monthlyQuota: 50,
    usedDrafts: 48,
    status: 'Active',
    createdAt: '2026-07-22',
  },
  {
    id: '5',
    name: 'ResolveAI Cloud',
    domain: 'resolveai.io',
    ownerEmail: 'admin@resolveai.io',
    plan: 'Team',
    seats: 5,
    monthlyQuota: 5000,
    usedDrafts: 1820,
    status: 'Active',
    createdAt: '2026-07-15',
  },
  {
    id: '6',
    name: 'Ticketless Desk',
    domain: 'ticketless.co',
    ownerEmail: 'ops@ticketless.co',
    plan: 'Team',
    seats: 6,
    monthlyQuota: 6000,
    usedDrafts: 4200,
    status: 'Active',
    createdAt: '2026-06-29',
  },
];

export default function AdminWorkspaces() {
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>(INITIAL_WORKSPACES);
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editingWorkspace, setEditingWorkspace] = useState<WorkspaceData | null>(null);
  const [overrideQuotaVal, setOverrideQuotaVal] = useState<number>(0);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

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
  };

  const handleSaveOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkspace) return;

    setWorkspaces(
      workspaces.map((ws) =>
        ws.id === editingWorkspace.id
          ? { ...ws, monthlyQuota: Number(overrideQuotaVal) }
          : ws
      )
    );

    setBannerNotice(`Updated monthly draft quota for "${editingWorkspace.name}" to ${overrideQuotaVal.toLocaleString()} drafts!`);
    setEditingWorkspace(null);
    setTimeout(() => setBannerNotice(null), 4000);
  };

  const handleToggleFreeze = (ws: WorkspaceData) => {
    const nextStatus = ws.status === 'Active' ? 'Frozen' : 'Active';
    setWorkspaces(
      workspaces.map((item) => (item.id === ws.id ? { ...item, status: nextStatus } : item))
    );
    setBannerNotice(`Workspace "${ws.name}" status changed to ${nextStatus}.`);
    setTimeout(() => setBannerNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="p-5 rounded-3xl bg-elevated/70 border border-border/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name, domain, email..."
            className="px-4 py-2 rounded-full bg-bg border border-border text-xs text-text placeholder-text-dim w-64 outline-none focus:border-accent"
          />

          <div className="flex items-center gap-1.5">
            {['all', 'Team', 'Enterprise', 'Free'].map((plan) => (
              <button
                key={plan}
                onClick={() => setFilterPlan(plan)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  filterPlan === plan
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-bg border border-border text-text-muted hover:text-text'
                }`}
              >
                {plan === 'all' ? 'All Plans' : `${plan} Tier`}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-text-dim font-mono">
          Showing {filtered.length} of {workspaces.length} Workspaces
        </div>
      </div>

      {bannerNotice && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between shadow-lg"
        >
          <span>⚡ {bannerNotice}</span>
          <span className="text-[10px] text-emerald-300/70">Synced to DB</span>
        </motion.div>
      )}

      {/* Quota Override Modal */}
      <AnimatePresence>
        {editingWorkspace && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md rounded-3xl bg-bg-card border border-accent/40 shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <h3 className="text-sm font-bold text-text">
                  Override Quota: {editingWorkspace.name}
                </h3>
                <button
                  onClick={() => setEditingWorkspace(null)}
                  className="text-text-dim hover:text-text text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveOverride} className="space-y-4 text-xs">
                <div>
                  <p className="text-text-muted mb-1">
                    Current Usage: <strong>{editingWorkspace.usedDrafts.toLocaleString()}</strong> drafts
                  </p>
                  <label className="block font-semibold text-text mb-1">
                    New Monthly Draft Quota Limit
                  </label>
                  <input
                    type="number"
                    required
                    value={overrideQuotaVal}
                    onChange={(e) => setOverrideQuotaVal(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-elevated border border-border text-sm font-mono text-text outline-none focus:border-accent"
                  />
                  <p className="text-[11px] text-text-dim mt-1">
                    Allows team to exceed their standard plan quota without billing failure.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingWorkspace(null)}
                    className="px-4 py-2 rounded-xl bg-elevated border border-border text-text-muted hover:text-text cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold shadow-[0_0_15px_rgba(124,58,237,0.4)] cursor-pointer"
                  >
                    Apply Quota Override
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Workspaces Full Table */}
      <div className="rounded-3xl bg-elevated/70 border border-border/80 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg/50 text-text-dim uppercase text-[10px] tracking-wider border-b border-border/40">
              <tr>
                <th className="px-6 py-3.5 font-semibold">Workspace Name</th>
                <th className="px-6 py-3.5 font-semibold">Plan</th>
                <th className="px-6 py-3.5 font-semibold">Seats / MRR</th>
                <th className="px-6 py-3.5 font-semibold">Monthly Draft Usage</th>
                <th className="px-6 py-3.5 font-semibold">Status</th>
                <th className="px-6 py-3.5 font-semibold text-right">SuperAdmin Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((ws) => {
                const percent = Math.min(100, Math.round((ws.usedDrafts / ws.monthlyQuota) * 100));
                return (
                  <tr key={ws.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-cyan flex items-center justify-center font-bold text-white text-xs">
                          {ws.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-text">{ws.name}</p>
                          <p className="text-[11px] text-text-dim">{ws.ownerEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent-light text-[10px] font-bold font-mono">
                        {ws.plan} Tier
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-text-muted">
                      {ws.seats} Seats (${ws.seats * (ws.plan === 'Free' ? 0 : 19)}/mo)
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-40">
                        <div className="flex justify-between text-[10px] text-text-dim mb-1 font-mono">
                          <span>{ws.usedDrafts.toLocaleString()} / {ws.monthlyQuota.toLocaleString()}</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-bg/80 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              percent > 90
                                ? 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]'
                                : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                          ws.status === 'Active'
                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                            : 'bg-red-500/10 border border-red-500/30 text-red-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            ws.status === 'Active' ? 'bg-emerald-400' : 'bg-red-400'
                          }`}
                        />
                        <span>{ws.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenOverride(ws)}
                          className="px-3 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-[11px] font-semibold transition-all shadow-sm cursor-pointer"
                        >
                          Edit Quota
                        </button>
                        <button
                          onClick={() => handleToggleFreeze(ws)}
                          className={`px-3 py-1.5 rounded-xl border text-[11px] font-medium transition-all cursor-pointer ${
                            ws.status === 'Active'
                              ? 'bg-bg border-red-500/40 text-red-400 hover:bg-red-500/10'
                              : 'bg-bg border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                        >
                          {ws.status === 'Active' ? 'Freeze' : 'Unfreeze'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
