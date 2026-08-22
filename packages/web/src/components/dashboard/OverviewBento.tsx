'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DateRangeState } from './DateRangePicker';

interface OverviewBentoProps {
  dateRange?: DateRangeState;
}

export default function OverviewBento({ dateRange }: OverviewBentoProps) {
  const [aiQuery, setAiQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(
    'Insight: 64% of Tuesday’s refund inquiries were resolved instantly with Macro #12 (Return Policy Window). Agent satisfaction score is 99.1%.'
  );
  const [isQuerying, setIsQuerying] = useState(false);

  // Compute dynamic stats based on selected date range
  const isToday = dateRange?.label.includes('Today') || dateRange?.label.includes('Aug 22');
  const is7Days = dateRange?.label.includes('7 Days') || dateRange?.label.includes('Aug 16');
  const isYTD = dateRange?.label.includes('YTD') || dateRange?.label.includes('Jan 01');

  const stats = isToday
    ? {
        hoursSaved: '4.8 hrs',
        avgResponse: '21s',
        prevResponse: '3m 45s',
        drafts: '94',
        draftsDelta: '+12 (14%)',
        kbMatchRate: '96.4%',
        volumeBars: [
          { day: '9 AM', h: '35%', label: '14 drafts' },
          { day: '11 AM', h: '88%', label: '38 drafts' },
          { day: '1 PM', h: '62%', label: '24 drafts' },
          { day: '3 PM', h: '45%', label: '18 drafts' },
        ],
      }
    : is7Days
    ? {
        hoursSaved: '34.2 hrs',
        avgResponse: '23s',
        prevResponse: '4m 02s',
        drafts: '684',
        draftsDelta: '+84 (14%)',
        kbMatchRate: '95.1%',
        volumeBars: [
          { day: 'Mon', h: '75%', label: '120 drafts' },
          { day: 'Tue', h: '68%', label: '105 drafts' },
          { day: 'Wed', h: '95%', label: '145 drafts' },
          { day: 'Thu', h: '82%', label: '130 drafts' },
          { day: 'Fri', h: '60%', label: '95 drafts' },
        ],
      }
    : isYTD
    ? {
        hoursSaved: '924.5 hrs',
        avgResponse: '25s',
        prevResponse: '4m 30s',
        drafts: '18,420',
        draftsDelta: '+4,210 (29%)',
        kbMatchRate: '94.8%',
        volumeBars: [
          { day: 'Q1', h: '65%', label: '5.2k drafts' },
          { day: 'Q2', h: '82%', label: '6.8k drafts' },
          { day: 'Q3', h: '94%', label: '6.4k drafts' },
        ],
      }
    : {
        hoursSaved: '142.5 hrs',
        avgResponse: '24s',
        prevResponse: '4m 12s',
        drafts: '2,840',
        draftsDelta: '+412 (18%)',
        kbMatchRate: '94.2%',
        volumeBars: [
          { day: 'Mon', h: '82%', label: '740 drafts' },
          { day: 'Tue', h: '65%', label: '580 drafts' },
          { day: 'Wed', h: '94%', label: '840 drafts' },
          { day: 'Thu', h: '45%', label: '410 drafts' },
          { day: 'Fri', h: '38%', label: '340 drafts' },
        ],
      };

  const handleAiQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;

    setIsQuerying(true);
    setTimeout(() => {
      setAiAnswer(
        `AI Analysis for "${aiQuery}" in window [${dateRange?.label || 'Selected Period'}]: Knowledge base matched ${stats.kbMatchRate} of customer questions. Highest time-saver was the "Password Reset & MFA" macro (saved ~28 hours across active support seats).`
      );
      setIsQuerying(false);
    }, 600);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
      
      {/* ─────────────────────────────────────────────────────────────
          CARD 1: Reply Velocity & Hours Saved (Top Left, 3 cols)
      ───────────────────────────────────────────────────────────── */}
      <div className="md:col-span-3 rounded-3xl bg-elevated/70 border border-border/80 p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group hover:border-accent/40 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-text">Reply Velocity</h3>
            <p className="text-[11px] text-text-dim">
              Avg response {stats.avgResponse} (was {stats.prevResponse})
            </p>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent-light font-mono">
            {dateRange?.granularity || 'Daily'}
          </span>
        </div>

        {/* Vertical Equalizer / Bar Chart in Neon Pink/Violet */}
        <div className="my-auto py-4">
          <div className="flex items-end justify-between h-32 gap-1.5 px-1">
            {[42, 58, 85, 96, 92, 74, 88, 62, 79, 95, 70, 84, 55, 68].map((height, i) => (
              <div key={i} className="flex-1 h-full flex items-end justify-center group/bar">
                <motion.div
                  initial={{ height: '10%' }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.7, delay: i * 0.02 }}
                  className="w-full rounded-t-full bg-gradient-to-t from-pink-500 via-pink-400 to-accent-light shadow-[0_0_10px_rgba(236,72,153,0.6)] group-hover/bar:brightness-125 transition-all"
                  style={{ minHeight: '6px' }}
                />
              </div>
            ))}
          </div>
          {/* Timeline labels */}
          <div className="flex justify-between text-[10px] text-text-dim pt-3 border-t border-border/40 mt-3 px-1 font-mono">
            <span>Start</span>
            <span>Mid</span>
            <span>{dateRange?.label.split('–')[1] || 'End'}</span>
          </div>
        </div>

        <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs">
          <span className="text-text-muted">Total Hours Saved</span>
          <motion.span
            key={stats.hoursSaved}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="font-bold text-accent-light font-mono text-sm"
          >
            {stats.hoursSaved}
          </motion.span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CARD 2 & 3: Drafts Generated & Active Agents (Middle, 4 cols)
      ───────────────────────────────────────────────────────────── */}
      <div className="md:col-span-4 flex flex-col gap-5">
        
        {/* Top Middle: Drafts Generated (Repaired Layout) */}
        <div className="flex-1 rounded-3xl bg-elevated/70 border border-border/80 p-5 shadow-lg relative overflow-hidden group hover:border-accent/40 transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text">Drafts Generated</h3>
              <span className="text-[10px] text-text-dim font-mono">{dateRange?.label}</span>
            </div>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-accent-light font-mono font-bold shrink-0">
              Peak: Wed
            </span>
          </div>

          <div className="flex items-end justify-between mt-3">
            <div>
              <motion.div
                key={stats.drafts}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-extrabold text-text font-mono tracking-tight"
              >
                {stats.drafts}
              </motion.div>
              <div className="text-[11px] text-success flex items-center gap-1 mt-1 font-medium">
                <span>vs {dateRange?.compareLabel || 'last period'}</span>
                <span className="font-mono font-bold">{stats.draftsDelta}</span>
              </div>
            </div>

            {/* Dot Matrix Equalizer cleanly aligned on bottom right */}
            <div className="flex items-end gap-1 pb-1">
              {[2, 3, 5, 8, 7, 5, 4, 6, 8, 6, 3, 2].map((dots, colIdx) => (
                <div key={colIdx} className="flex flex-col gap-1">
                  {Array.from({ length: 6 }).map((_, dotIdx) => (
                    <div
                      key={dotIdx}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        dotIdx >= 6 - dots
                          ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]'
                          : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Middle: Active Agents */}
        <div className="flex-1 rounded-3xl bg-elevated/70 border border-border/80 p-5 shadow-lg relative overflow-hidden group hover:border-accent/40 transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Active Support Agents</h3>
            <span className="text-[10px] text-text-dim font-mono">Seats Utilized</span>
          </div>

          <div className="flex items-center justify-between my-2">
            <div>
              <div className="text-3xl font-extrabold text-text font-mono tracking-tight">
                4 <span className="text-lg text-text-dim font-normal">/ 5 seats</span>
              </div>
              <div className="text-[11px] text-text-muted mt-0.5 font-medium">
                80% concurrency in Gmail
              </div>
            </div>

            {/* Dot Matrix Seat Visualizer */}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((seat) => (
                <div
                  key={seat}
                  className={`w-3.5 h-7 rounded-md flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                    seat <= 4
                      ? 'bg-gradient-to-t from-cyan to-blue-500 text-white shadow-[0_0_8px_rgba(0,210,255,0.6)]'
                      : 'bg-bg border border-border text-text-dim'
                  }`}
                >
                  {seat}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          CARD 4: Knowledge Base Match Rate (Top Right, 5 cols)
      ───────────────────────────────────────────────────────────── */}
      <div className="md:col-span-5 rounded-3xl bg-elevated/70 border border-border/80 p-6 shadow-lg relative overflow-hidden group hover:border-accent/40 transition-colors flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-text">Knowledge Base Match Rate</h3>
            <p className="text-[11px] text-text-dim">AI macro auto-matching accuracy</p>
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-success/20 text-success font-mono font-bold">
            99.4% Uptime
          </span>
        </div>

        <div>
          <div className="flex items-baseline gap-3 mb-4">
            <motion.span
              key={stats.kbMatchRate}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-4xl font-black text-text font-mono"
            >
              {stats.kbMatchRate}
            </motion.span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-success/20 text-success text-xs font-bold font-mono">
              ▲ 15%
            </span>
          </div>

          {/* Breakdown progress bars with diagonal stripes */}
          <div className="space-y-3.5">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text font-medium">Refunds &amp; Billing</span>
                <span className="font-mono text-text-muted">88% matched</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-bg/80 overflow-hidden p-0.5 border border-border/40">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '88%' }}
                  transition={{ duration: 1 }}
                  className="h-full rounded-full bg-gradient-to-r from-lime-400 to-emerald-400 shadow-[0_0_10px_rgba(163,230,53,0.6)]"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text font-medium">Account Access &amp; Auth</span>
                <span className="font-mono text-text-muted">96% matched</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-bg/80 overflow-hidden p-0.5 border border-border/40">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '96%' }}
                  transition={{ duration: 1, delay: 0.1 }}
                  className="h-full rounded-full bg-gradient-to-r from-cyan to-blue-400 shadow-[0_0_10px_rgba(0,210,255,0.6)]"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text font-medium">Shipping &amp; Order Changes</span>
                <span className="font-mono text-text-muted">92% matched</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-bg/80 overflow-hidden p-0.5 border border-border/40">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '92%' }}
                  transition={{ duration: 1, delay: 0.2 }}
                  className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-400 shadow-[0_0_10px_rgba(244,114,182,0.6)]"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-border/40 text-[11px] text-text-dim flex items-center justify-between mt-2">
          <span>Synced with 50 team macros</span>
          <span className="text-accent font-semibold hover:underline cursor-pointer">Manage KB →</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CARD 5: 3D Support Volume & AI Prompt Bar (Bottom Left, 8 cols)
      ───────────────────────────────────────────────────────────── */}
      <div className="md:col-span-8 rounded-3xl bg-elevated/70 border border-border/80 p-6 shadow-lg relative overflow-hidden group hover:border-accent/40 transition-colors flex flex-col justify-between min-h-[380px]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-text">Support Volume Activity</h3>
            <p className="text-[11px] text-text-dim">
              AI-assisted drafts in window: <strong>{dateRange?.label}</strong>
            </p>
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-bg border border-border font-mono text-text-dim">
            {dateRange?.granularity || 'Daily'} Interval
          </span>
        </div>

        {/* 3D Isometric Bar Chart Showcase */}
        <div className="relative h-44 flex items-end justify-around px-4 my-2">
          {/* Y Axis scale lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 border-b border-border">
            <div className="border-b border-dashed border-text-dim w-full text-[9px] text-text-dim">Max</div>
            <div className="border-b border-dashed border-text-dim w-full text-[9px] text-text-dim">75%</div>
            <div className="border-b border-dashed border-text-dim w-full text-[9px] text-text-dim">50%</div>
            <div className="border-b border-dashed border-text-dim w-full text-[9px] text-text-dim">25%</div>
          </div>

          {/* Isometric 3D Bars */}
          {stats.volumeBars.map((bar, i) => (
            <div key={i} className="relative z-10 flex flex-col items-center gap-2 group/bar w-16">
              <span className="opacity-0 group-hover/bar:opacity-100 transition-opacity text-[10px] font-mono text-accent-light bg-bg/90 px-1.5 py-0.5 rounded border border-border shadow">
                {bar.label}
              </span>

              {/* 3D Bar Prism */}
              <motion.div
                key={`${bar.day}-${bar.h}`}
                initial={{ height: 0 }}
                animate={{ height: bar.h }}
                transition={{ duration: 0.8, delay: i * 0.08 }}
                className="w-12 rounded-t-lg bg-gradient-to-t from-emerald-600/40 via-lime-400 to-lime-300 relative shadow-[0_0_20px_rgba(163,230,53,0.4)] border-t border-x border-lime-200/50"
              >
                {/* 3D Cap */}
                <div className="absolute -top-1 inset-x-0 h-2 bg-lime-200/80 rounded-full blur-[0.5px]" />
              </motion.div>

              <span className="text-xs font-mono text-text-muted mt-1">{bar.day}</span>
            </div>
          ))}
        </div>

        {/* Interactive AI Question Bar */}
        <div className="mt-4 pt-3 border-t border-border/50">
          <form onSubmit={handleAiQuerySubmit} className="relative">
            <div className="text-[11px] font-semibold text-text-muted mb-1.5 flex items-center gap-1.5">
              <span>✨</span>
              <span>Ask DraftPilot Support AI (Grounded in {dateRange?.label}):</span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="e.g. What caused the volume increase during this date range?"
                className="w-full px-4 py-2.5 rounded-xl bg-bg/90 border border-border focus:border-accent focus:ring-2 focus:ring-accent/30 text-xs text-text placeholder-text-dim pr-24 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={isQuerying}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                {isQuerying ? 'Analyzing...' : 'Ask AI'}
              </button>
            </div>
          </form>

          {aiAnswer && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2.5 p-3 rounded-xl bg-accent/10 border border-accent/20 text-xs text-accent-light leading-relaxed flex items-start gap-2"
            >
              <span className="text-sm">💡</span>
              <p className="text-[11px]">{aiAnswer}</p>
            </motion.div>
          )}
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          CARD 6: Quality & Tone Insights (Bottom Right, 4 cols)
      ───────────────────────────────────────────────────────────── */}
      <div className="md:col-span-4 rounded-3xl bg-gradient-to-br from-emerald-950/40 via-elevated to-bg border border-border/80 p-6 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-colors flex flex-col justify-between">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/15 blur-[60px] rounded-full pointer-events-none" />

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-4">
            <span>💡</span>
            <span>Tone Insights</span>
          </div>

          <div className="text-5xl font-black text-text font-mono mb-2">
            98%
          </div>

          <h4 className="text-sm font-bold text-text mb-2 leading-snug">
            Draft accuracy rate remained consistently high.
          </h4>

          <p className="text-xs text-text-muted leading-relaxed font-normal">
            Agent manual edits were under 12% across {stats.drafts} drafts, saving ~18 minutes per agent per day.
          </p>
        </div>

        {/* Mini progress tracker */}
        <div className="pt-6 border-t border-border/40 mt-4">
          <div className="flex justify-between text-[11px] text-text-dim mb-1.5">
            <span>Target Goal ({stats.drafts} drafts)</span>
            <span className="font-mono font-bold text-emerald-400">96%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-bg/80 overflow-hidden p-0.5 border border-border/40">
            <div className="h-full rounded-full bg-emerald-400 w-[96%] shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          </div>
        </div>
      </div>

    </div>
  );
}
