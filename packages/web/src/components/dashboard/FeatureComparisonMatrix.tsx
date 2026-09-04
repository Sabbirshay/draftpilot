'use client';

import React from 'react';
import { COMPARISON_FEATURES, PlanFeatureRow } from '@/data/feature-comparison';

export { COMPARISON_FEATURES };
export type { PlanFeatureRow };

interface FeatureComparisonMatrixProps {
  currentPlan?: string;
  isAnnual?: boolean;
  onSelectTier?: (tier: 'free' | 'team' | 'enterprise') => void;
  className?: string;
}

export default function FeatureComparisonMatrix({
  currentPlan = 'free',
  isAnnual = false,
  onSelectTier,
  className = '',
}: FeatureComparisonMatrixProps) {
  const normCurrentPlan = currentPlan.toLowerCase();

  return (
    <div className={`rounded-3xl border border-border bg-bg-card/90 overflow-hidden shadow-xl ${className}`}>
      {/* Header Banner */}
      <div className="p-6 sm:p-8 border-b border-border bg-gradient-to-r from-accent/10 via-elevated to-cyan/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 border border-accent/40 text-accent-light text-xs font-bold mb-2">
            <span>✨</span>
            <span>Feature Comparison</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-text tracking-tight">
            Transparent Plan Comparison
          </h3>
          <p className="text-xs text-text-muted mt-1">
            Compare all features across Free, Team, and Enterprise tiers. No hidden limits.
          </p>
        </div>
        {isAnnual && (
          <div className="shrink-0 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto">
            <span>🎉</span>
            <span>Annual Pricing Active (Save 20%)</span>
          </div>
        )}
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-elevated/50 text-text">
              <th className="py-4 px-6 font-semibold w-1/3 text-text-muted">Feature Dimension</th>
              <th className="py-4 px-4 font-bold w-2/9 text-center">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-sm">Starter Free</span>
                  <span className="text-[11px] font-mono text-text-dim">$0 forever</span>
                  {normCurrentPlan === 'free' && (
                    <span className="mt-1 px-2 py-0.5 rounded-full bg-elevated border border-border text-[10px] text-text-muted">
                      Current Plan
                    </span>
                  )}
                </div>
              </th>
              <th className="py-4 px-4 font-bold w-2/9 text-center bg-accent/5 border-x border-accent/20">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-sm text-accent-light flex items-center gap-1">
                    <span>⚡</span> Team Co-Pilot
                  </span>
                  <span className="text-[11px] font-mono text-accent-light">
                    {isAnnual ? '$15 / seat / mo' : '$19 / seat / mo'}
                  </span>
                  {normCurrentPlan === 'team' && (
                    <span className="mt-1 px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-[10px] text-accent-light">
                      Current Plan
                    </span>
                  )}
                </div>
              </th>
              <th className="py-4 px-4 font-bold w-2/9 text-center">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-sm text-text">Enterprise Dedicated</span>
                  <span className="text-[11px] font-mono text-text-dim">
                    {isAnnual ? '$79 / mo' : '$99 / mo'}
                  </span>
                  {normCurrentPlan === 'enterprise' && (
                    <span className="mt-1 px-2 py-0.5 rounded-full bg-elevated border border-border text-[10px] text-text-muted">
                      Current Plan
                    </span>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {COMPARISON_FEATURES.map((feat, idx) => (
              <tr
                key={feat.dimension}
                className={idx % 2 === 0 ? 'bg-transparent' : 'bg-elevated/20'}
              >
                <td className="py-3.5 px-6 font-medium text-text">
                  <div className="flex flex-col">
                    <span className="font-semibold text-text">{feat.dimension}</span>
                    {feat.tooltip && (
                      <span className="text-[11px] text-text-dim mt-0.5 font-normal">
                        {feat.tooltip}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3.5 px-4 text-center text-text-muted">
                  {renderCellContent(feat.free)}
                </td>
                <td className="py-3.5 px-4 text-center bg-accent/5 border-x border-accent/20 text-accent-light font-medium">
                  {renderCellContent(feat.team)}
                </td>
                <td className="py-3.5 px-4 text-center text-text font-medium">
                  {renderCellContent(feat.enterprise)}
                </td>
              </tr>
            ))}
          </tbody>
          {onSelectTier && (
            <tfoot>
              <tr className="border-t border-border bg-elevated/30">
                <td className="py-4 px-6 text-text-dim font-medium">Choose Plan</td>
                <td className="py-4 px-4 text-center">
                  <button
                    onClick={() => onSelectTier('free')}
                    className="px-4 py-2 rounded-xl bg-elevated hover:bg-white/5 border border-border text-text text-xs font-semibold cursor-pointer transition-all"
                  >
                    {normCurrentPlan === 'free' ? 'Current Plan' : 'Select Starter'}
                  </button>
                </td>
                <td className="py-4 px-4 text-center bg-accent/5 border-x border-accent/20">
                  <button
                    onClick={() => onSelectTier('team')}
                    className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-[0_0_15px_rgba(124,58,237,0.4)] cursor-pointer transition-all"
                  >
                    {normCurrentPlan === 'team' ? 'Current Plan' : 'Upgrade to Team'}
                  </button>
                </td>
                <td className="py-4 px-4 text-center">
                  <button
                    onClick={() => onSelectTier('enterprise')}
                    className="px-4 py-2 rounded-xl bg-elevated hover:bg-white/5 border border-border text-text text-xs font-semibold cursor-pointer transition-all"
                  >
                    {normCurrentPlan === 'enterprise' ? 'Current Plan' : 'Upgrade to Enterprise'}
                  </button>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function renderCellContent(value: string | boolean) {
  if (typeof value === 'boolean') {
    return value ? (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">
        ✓
      </span>
    ) : (
      <span className="text-text-dim">—</span>
    );
  }
  return value;
}
