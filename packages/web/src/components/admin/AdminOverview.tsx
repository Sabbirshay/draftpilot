'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';

export interface AdminOverviewProps {
  onSelectWorkspaceTab?: () => void;
  onSelectAiConfigTab?: () => void;
}

export default function AdminOverview({
  onSelectWorkspaceTab,
  onSelectAiConfigTab,
}: AdminOverviewProps) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null);

  const handleQuickQuotaBoost = (teamName: string) => {
    setOverrideSuccess(`Granted +2,000 bonus draft quota to ${teamName}!`);
    setTimeout(() => setOverrideSuccess(null), 3500);
  };

  return (
    <div className="space-y-6">
      
      {/* ─────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE METRIC STRIP (4 Cards matching Reference UI)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Revenue This Month */}
        <div className="p-5 rounded-3xl bg-elevated/70 border border-border/80 shadow-md flex flex-col justify-between hover:border-accent/40 transition-all">
          <p className="text-xs text-text-dim font-medium">Revenue This Month</p>
          <div className="my-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text font-mono tracking-tight">
              $48,250
            </h2>
            <p className="text-[11px] text-emerald-400 font-mono font-medium flex items-center gap-1 mt-1">
              <span>▲ +12.5%</span>
              <span className="text-text-dim">vs last month</span>
            </p>
          </div>
        </div>

        {/* Card 2: Annual Recurring Revenue */}
        <div className="p-5 rounded-3xl bg-elevated/70 border border-border/80 shadow-md flex flex-col justify-between hover:border-accent/40 transition-all">
          <p className="text-xs text-text-dim font-medium">Annual Recurring Revenue</p>
          <div className="my-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text font-mono tracking-tight">
              $579,000
            </h2>
            <p className="text-[11px] text-emerald-400 font-mono font-medium flex items-center gap-1 mt-1">
              <span>▲ +8.2%</span>
              <span className="text-text-dim">YoY comparison</span>
            </p>
          </div>
        </div>

        {/* Card 3: AI Draft Generation Rate */}
        <div className="p-5 rounded-3xl bg-elevated/70 border border-border/80 shadow-md flex flex-col justify-between hover:border-accent/40 transition-all">
          <p className="text-xs text-text-dim font-medium">AI Generation Success Rate</p>
          <div className="my-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text font-mono tracking-tight">
              99.4%
            </h2>
            <p className="text-[11px] text-accent-light font-mono font-medium flex items-center gap-1 mt-1">
              <span>🎯 Target 99.0%</span>
              <span className="text-text-dim">(0.02s latency)</span>
            </p>
          </div>
        </div>

        {/* Card 4: Active Seats across Workspaces */}
        <div className="p-5 rounded-3xl bg-elevated/70 border border-border/80 shadow-md flex flex-col justify-between hover:border-accent/40 transition-all">
          <p className="text-xs text-text-dim font-medium">Active Paid Seats</p>
          <div className="my-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text font-mono tracking-tight">
              2,540
            </h2>
            <p className="text-[11px] text-emerald-400 font-mono font-medium flex items-center gap-1 mt-1">
              <span>▲ +4.1% growth</span>
              <span className="text-text-dim">(620 teams)</span>
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
          2. MIDDLE SECTION: Charts & Right Feeds (Bento Grid)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left-Middle: Topic Distribution Radial Segment Donut (4 cols) */}
        <div className="lg:col-span-4 rounded-3xl bg-elevated/70 border border-border/80 p-6 shadow-md flex flex-col justify-between hover:border-accent/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-text">AI Draft Distribution</h3>
            <button className="text-text-dim hover:text-text text-xs p-1">•••</button>
          </div>

          {/* Segmented Ring Graphic matching reference */}
          <div className="relative flex flex-col items-center justify-center my-4">
            <div className="relative w-44 h-44 flex items-center justify-center">
              {/* Segmented SVG Ring */}
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {/* 4 segmented arcs with gaps */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#34d399"
                  strokeWidth="8"
                  strokeDasharray="45 15"
                  strokeLinecap="round"
                  className="shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#a855f7"
                  strokeWidth="8"
                  strokeDasharray="35 25"
                  strokeDashoffset="-60"
                  strokeLinecap="round"
                  className="shadow-[0_0_10px_rgba(168,85,247,0.8)]"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#00d2ff"
                  strokeWidth="8"
                  strokeDasharray="25 35"
                  strokeDashoffset="-120"
                  strokeLinecap="round"
                  className="shadow-[0_0_10px_rgba(0,210,255,0.8)]"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#f472b6"
                  strokeWidth="8"
                  strokeDasharray="18 42"
                  strokeDashoffset="-180"
                  strokeLinecap="round"
                  className="shadow-[0_0_10px_rgba(244,114,182,0.8)]"
                />
              </svg>

              {/* Center Stat */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-extrabold text-text font-mono">148.6k</span>
                <span className="text-[10px] text-text-dim uppercase tracking-wider">Weekly Drafts</span>
              </div>
            </div>
          </div>

          {/* Breakdown legend matching reference */}
          <div className="space-y-2 text-xs pt-3 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-text">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                Billing &amp; Refunds
              </span>
              <span className="font-mono text-text-muted">$42,100</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-text">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                Onboarding &amp; Setup
              </span>
              <span className="font-mono text-text-muted">$35,200</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-text">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan" />
                Account Security &amp; Auth
              </span>
              <span className="font-mono text-text-muted">$21,090</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-text">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-400" />
                Shipping &amp; Logistics
              </span>
              <span className="font-mono text-text-muted">$11,560</span>
            </div>
          </div>
        </div>

        {/* Center-Middle: Net Token Economics & Growth Chart (4 cols) */}
        <div className="lg:col-span-4 rounded-3xl bg-elevated/70 border border-border/80 p-6 shadow-md flex flex-col justify-between hover:border-accent/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-text">Net Platform Profit</h3>
              <p className="text-[11px] text-text-dim">After LLM Token &amp; Infra Costs</p>
            </div>
            <button className="text-text-dim hover:text-text text-xs p-1">•••</button>
          </div>

          <div className="my-2">
            <h2 className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
              $47,620
            </h2>
            <p className="text-[11px] text-text-dim mt-0.5">
              LLM API Costs: <strong>$214.30</strong> (98.6% gross margin)
            </p>
          </div>

          {/* Smooth Rising Area Curve matching Reference */}
          <div className="relative h-36 my-2 flex items-end">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 200 80" preserveAspectRatio="none">
              <defs>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Filled area */}
              <path
                d="M 0,70 Q 50,60 90,45 T 160,25 T 200,10 L 200,80 L 0,80 Z"
                fill="url(#profitGrad)"
              />
              {/* Stroke line */}
              <path
                d="M 0,70 Q 50,60 90,45 T 160,25 T 200,10"
                fill="none"
                stroke="#34d399"
                strokeWidth="2.5"
                className="drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]"
              />
            </svg>
          </div>

          <div className="pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-text-dim">
            <span>Model: OpenAI GPT-4o-mini</span>
            <button
              onClick={onSelectAiConfigTab}
              className="text-accent-light font-semibold hover:underline cursor-pointer"
            >
              Tune Model Config →
            </button>
          </div>
        </div>

        {/* Right Stack: Notifications & Live Feed (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Notifications Box */}
          <div className="p-5 rounded-3xl bg-elevated/70 border border-border/80 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text">System Alerts</h4>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <ul className="space-y-2 text-xs text-text-muted">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span><strong>42 new team leads</strong> registered today</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span><strong>1,840 Gmail extension</strong> active heartbeats</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan shrink-0" />
                <span>Stripe payout completed (<strong>$12,400</strong>)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                <span><strong>3 pending</strong> seat quota upgrade requests</span>
              </li>
            </ul>
          </div>

          {/* Recent Platform Activity */}
          <div className="p-5 rounded-3xl bg-elevated/70 border border-border/80 shadow-md">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text mb-3">Live Platform Audit</h4>
            <ul className="space-y-2 text-[11px] text-text-dim">
              <li className="flex items-center gap-2">
                <span>•</span>
                <span>Prompt template updated for <code>refunds</code></span>
              </li>
              <li className="flex items-center gap-2">
                <span>•</span>
                <span>Added new macro category: <strong>#enterprise-mfa</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span>•</span>
                <span>Automated DB backup completed safely (0 errors)</span>
              </li>
            </ul>
          </div>

          {/* Escalation Lead / Customer Rep */}
          <div className="p-4 rounded-3xl bg-elevated/70 border border-border/80 shadow-md flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-xs font-bold text-purple-300">
                KP
              </div>
              <div>
                <p className="text-xs font-bold text-text">Kevin Putra (CX Lead)</p>
                <p className="text-[10px] text-emerald-400 font-mono">● Online &amp; Handling Inbound</p>
              </div>
            </div>
            <button 
              onClick={() => alert('Direct dispatch to Kevin Putra: Ticket assigned.')}
              className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 transition-colors text-xs"
              title="Ping Lead"
            >
              📞
            </button>
          </div>

        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. BOTTOM SECTION: Workspaces & Quota Control Table
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-elevated/70 border border-border/80 overflow-hidden shadow-lg">
        <div className="p-6 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-text">Customer Workspaces &amp; Quota Control</h3>
            <p className="text-xs text-text-dim">
              Directly override team quotas, inspect token consumption, and manage active seats
            </p>
          </div>
          <button
            onClick={onSelectWorkspaceTab}
            className="px-4 py-2 rounded-full bg-bg border border-border hover:border-accent text-xs font-semibold text-text transition-colors self-start sm:self-auto cursor-pointer"
          >
            View All 620 Workspaces →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg/50 text-text-dim uppercase text-[10px] tracking-wider border-b border-border/40">
              <tr>
                <th className="px-6 py-3 font-semibold">Workspace / Customer</th>
                <th className="px-6 py-3 font-semibold">Plan Tier</th>
                <th className="px-6 py-3 font-semibold">Seats</th>
                <th className="px-6 py-3 font-semibold">Monthly Draft Usage</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold text-right">Admin Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {[
                {
                  id: '1',
                  name: 'Rian Pratama Ops',
                  domain: 'rianpratama.co',
                  plan: 'Team Tier',
                  seats: 8,
                  usage: '7,420 / 8,000',
                  percent: '92%',
                  status: 'Active',
                },
                {
                  id: '2',
                  name: 'Foodi QuickSupport',
                  domain: 'getfoodi.io',
                  plan: 'Team Tier',
                  seats: 12,
                  usage: '9,840 / 12,000',
                  percent: '82%',
                  status: 'Active',
                },
                {
                  id: '3',
                  name: 'HelpFlow CX Inc',
                  domain: 'helpflow.com',
                  plan: 'Enterprise Tier',
                  seats: 25,
                  usage: '22,100 / 25,000',
                  percent: '88%',
                  status: 'Active',
                },
                {
                  id: '4',
                  name: 'ScaleByte SaaS',
                  domain: 'scalebyte.dev',
                  plan: 'Free Tier',
                  seats: 1,
                  usage: '48 / 50',
                  percent: '96%',
                  status: 'Active',
                },
              ].map((team) => (
                <tr key={team.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-purple-600 flex items-center justify-center font-bold text-white text-xs">
                        {team.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-text">{team.name}</p>
                        <p className="text-[11px] text-text-dim">{team.domain}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent-light text-[10px] font-bold font-mono">
                      {team.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-text-muted">
                    {team.seats} Seats (${team.seats * 19}/mo)
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-36">
                      <div className="flex justify-between text-[10px] text-text-dim mb-1 font-mono">
                        <span>{team.usage}</span>
                        <span>{team.percent}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-bg/80 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                          style={{ width: team.percent }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>{team.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleQuickQuotaBoost(team.name)}
                        className="px-3 py-1.5 rounded-xl bg-accent/20 hover:bg-accent/40 border border-accent/40 text-accent-light text-[11px] font-semibold transition-all cursor-pointer"
                      >
                        +2k Quota
                      </button>
                      <button
                        onClick={() => alert(`Opening full workspace inspector for ${team.name}`)}
                        className="px-3 py-1.5 rounded-xl bg-bg border border-border hover:border-accent text-text text-[11px] font-medium transition-all cursor-pointer"
                      >
                        Manage
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
