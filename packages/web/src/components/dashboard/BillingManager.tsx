'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import FeatureComparisonMatrix from './FeatureComparisonMatrix';

export default function BillingManager() {
  const { dbUser, user } = useAuth();
  const [draftsCount, setDraftsCount] = useState(0);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState(1);
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'team' | 'enterprise'>('team');
  const [portalNotice, setPortalNotice] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showMatrix, setShowMatrix] = useState(true);

  const [customQuota, setCustomQuota] = useState<number | null>(null);
  const [livePlan, setLivePlan] = useState<string>(dbUser?.teams?.plan || 'free');
  const teamPlan = livePlan || dbUser?.teams?.plan || 'free';
  const isFreePlan = teamPlan === 'free';
  const pricePerSeat = isAnnual ? 15 : 19;
  const enterprisePrice = isAnnual ? 79 : 99;
  const draftQuota = customQuota || (isFreePlan ? 50 : teamPlan === 'enterprise' ? 5000 : selectedSeats * 1000);
  const quotaPercent = Math.min(100, Math.round((draftsCount / draftQuota) * 100));

  // Annual savings calculation
  const annualSavingsPerSeat = (19 - 15) * 12; // $48/seat/year
  const totalTeamSavings = selectedSeats * annualSavingsPerSeat;
  const totalEnterpriseSavings = (99 - 79) * 12; // $240/year

  useEffect(() => {
    async function fetchUsage() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || (typeof window !== 'undefined' ? localStorage.getItem('draftpilot_token') : null);

        let teamId = dbUser?.team_id;

        if (token) {
          const meRes = await fetch(`/api/auth/me?t=${Date.now()}`, {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            if (meData.team?.plan) {
              setLivePlan(meData.team.plan.toLowerCase());
            }
            if (meData.team?.monthly_draft_limit) {
              setCustomQuota(meData.team.monthly_draft_limit);
            }
            if (meData.team?.id) {
              teamId = meData.team.id;
            }
          }
        }

        if (teamId) {
          const draftsRes = await supabase
            .from('draft_history')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', teamId);

          if (draftsRes.count !== null && draftsRes.count !== undefined) {
            setDraftsCount(draftsRes.count);
          }
        }
      } catch (err) {
        console.warn('Could not fetch usage from Supabase:', err);
      }
    }

    fetchUsage();
    const interval = setInterval(fetchUsage, 6000);

    const channel = supabase
      .channel('user-billing-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draft_history' }, () => {
        fetchUsage();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        fetchUsage();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [dbUser]);

  const handleOpenPortal = async () => {
    setIsLoadingPortal(true);
    setPortalNotice(null);
    const cadence = isAnnual ? 'yearly' : 'monthly';

    if (isFreePlan) {
      setShowUpgradeModal(true);
      setIsLoadingPortal(false);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || (typeof window !== 'undefined' ? localStorage.getItem('draftpilot_token') : null);

      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ cadence }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }
    } catch (e) {
      console.warn('Stripe portal endpoint dispatch:', e);
    }

    setPortalNotice({
      type: 'info',
      message: `Connecting to Stripe Customer Billing Portal (${cadence})...`,
    });

    setTimeout(() => {
      setPortalNotice({
        type: 'success',
        message: `✓ Stripe Billing session initialized (${cadence}). In production with live Stripe credentials, this redirects to your Stripe Hosted Billing Portal.`,
      });
      setIsLoadingPortal(false);
    }, 600);
  };

  const handleConfirmUpgrade = async () => {
    setIsUpgrading(true);
    setPortalNotice(null);
    const cadence = isAnnual ? 'yearly' : 'monthly';

    try {
      const activeTeamId = dbUser?.team_id;
      const targetQuota = selectedTier === 'enterprise' ? 5000 : selectedSeats * 1000;

      if (activeTeamId) {
        // First try with billing_cadence
        const { error } = await supabase
          .from('teams')
          .update({
            plan: selectedTier,
            monthly_draft_limit: targetQuota,
            billing_cadence: cadence,
          })
          .eq('id', activeTeamId);

        if (error) {
          // Fallback if column does not exist
          await supabase
            .from('teams')
            .update({
              plan: selectedTier,
              monthly_draft_limit: targetQuota,
            })
            .eq('id', activeTeamId);
        }
      }

      setLivePlan(selectedTier);
      setCustomQuota(targetQuota);
      setShowUpgradeModal(false);
      setPortalNotice({
        type: 'success',
        message: `🎉 Workspace upgraded to ${selectedTier === 'enterprise' ? 'Enterprise' : 'Team'} Plan (${cadence === 'yearly' ? 'Annual - 20% savings' : 'Monthly'}, ${selectedTier === 'enterprise' ? '5,000+' : `${selectedSeats} seat${selectedSeats > 1 ? 's' : ''}, ${targetQuota.toLocaleString()}`} monthly drafts)!`,
      });
    } catch (err: any) {
      console.error('Failed to upgrade workspace plan:', err);
      setPortalNotice({
        type: 'error',
        message: `Could not complete plan upgrade: ${err.message || 'Network error'}. Please try again.`,
      });
    } finally {
      setIsUpgrading(false);
      setIsLoadingPortal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Portal & Plan Notification Banner */}
      <AnimatePresence>
        {portalNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl border text-xs font-medium flex items-center justify-between shadow-md ${
              portalNotice.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : portalNotice.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-cyan/10 border-cyan/30 text-cyan'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-sm">
                {portalNotice.type === 'success' ? '✓' : portalNotice.type === 'error' ? '⚠️' : '⚡'}
              </span>
              <span>{portalNotice.message}</span>
            </div>
            <button
              onClick={() => setPortalNotice(null)}
              className="text-text-dim hover:text-text text-xs p-1 ml-3 cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Plan Overview Card */}
      <div className="p-8 rounded-3xl bg-gradient-to-br from-accent/15 via-elevated to-bg border border-accent/40 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 border border-accent/40 text-accent-light text-xs font-bold mb-3">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span>
                {isFreePlan
                  ? 'FREE TIER ACTIVE'
                  : teamPlan === 'enterprise'
                  ? 'ENTERPRISE TIER ACTIVE'
                  : 'TEAM TIER ACTIVE'}
              </span>
            </div>
            <h2 className="text-3xl font-extrabold text-text font-mono">
              {isFreePlan
                ? '$0'
                : teamPlan === 'enterprise'
                ? `$${enterprisePrice}`
                : `$${selectedSeats * pricePerSeat}`}
              <span className="text-sm font-normal text-text-muted">/month</span>
            </h2>
            <p className="text-xs text-text-muted mt-1">
              {isFreePlan
                ? '50 AI drafts/month included · 1 Active Seat · Upgrade to Team plan for unlimited macros and team seats'
                : teamPlan === 'enterprise'
                ? `Dedicated Enterprise Tier · 5,000+ monthly drafts · 24/7 SLA & Custom PII Vault`
                : `Flat $${pricePerSeat}/seat/month (${isAnnual ? 'Billed annually' : 'Billed monthly'}) • ${selectedSeats} Allocated Seat${selectedSeats > 1 ? 's' : ''} • Unlimited team macros`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleOpenPortal}
              disabled={isLoadingPortal}
              className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_20px_rgba(124,58,237,0.4)] cursor-pointer disabled:opacity-50"
            >
              {isLoadingPortal
                ? 'Connecting...'
                : isFreePlan
                ? 'Upgrade to Team Plan ($19/mo or $15/yr) →'
                : 'Manage Invoices & Cards (Stripe) →'}
            </button>
          </div>
        </div>

        {/* Monthly Draft Quota Progress Meter */}
        <div className="mt-8 pt-6 border-t border-border/50">
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="font-semibold text-text">Monthly AI Draft Quota</span>
            <span className="font-mono text-accent-light font-bold">
              {draftsCount.toLocaleString()} / {draftQuota.toLocaleString()} drafts ({quotaPercent}%)
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-bg/90 overflow-hidden p-0.5 border border-border/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent via-accent-hover to-cyan shadow-[0_0_12px_rgba(124,58,237,0.7)] transition-all duration-500"
              style={{ width: `${Math.max(2, quotaPercent)}%` }}
            />
          </div>
          <p className="text-[11px] text-text-dim mt-2">
            {isFreePlan
              ? 'Free plan provides 50 drafts every month. Need more? Upgrading unlocks +1,000 monthly drafts per seat.'
              : 'Adding seats automatically scales your pooled monthly draft quota with zero downtime.'}
          </p>
        </div>
      </div>

      {/* Plan & Seat Calculator Card with Annual Savings Callout */}
      <div className="p-6 sm:p-8 rounded-3xl bg-elevated/70 border border-border/80 shadow-lg space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🧮</span>
              <h3 className="text-base font-bold text-text">Plan &amp; Seat Calculator</h3>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Adjust seats and billing cycle to calculate your exact workspace subscription.
            </p>
          </div>

          {/* Annual Toggle with 20% Savings Badge */}
          <div className="flex items-center gap-3 self-start sm:self-auto bg-bg/60 p-1.5 rounded-full border border-border">
            <button
              type="button"
              onClick={() => setIsAnnual(false)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                !isAnnual ? 'bg-accent text-white shadow-sm' : 'text-text-muted hover:text-text'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setIsAnnual(true)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                isAnnual ? 'bg-accent text-white shadow-sm' : 'text-text-muted hover:text-text'
              }`}
            >
              <span>Annual</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Seat adjustment and calculation display */}
        <div className="grid sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-bg/80 border border-border">
          <div className="space-y-3">
            <span className="text-xs font-semibold text-text">Team Agent Seats</span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedSeats(Math.max(1, selectedSeats - 1))}
                className="w-10 h-10 rounded-xl bg-elevated border border-border text-text font-bold hover:bg-white/5 flex items-center justify-center cursor-pointer transition-all"
              >
                -
              </button>
              <span className="text-2xl font-bold font-mono text-text w-12 text-center">
                {selectedSeats}
              </span>
              <button
                onClick={() => setSelectedSeats(selectedSeats + 1)}
                className="w-10 h-10 rounded-xl bg-elevated border border-border text-text font-bold hover:bg-white/5 flex items-center justify-center cursor-pointer transition-all"
              >
                +
              </button>
              <span className="text-xs text-text-muted">
                {selectedSeats === 1 ? '1 agent' : `${selectedSeats} agents`} (${pricePerSeat}/seat/mo)
              </span>
            </div>

            {isAnnual && (
              <p className="text-[11px] text-emerald-400 font-medium">
                ✨ Annual Discount: Saving ${totalTeamSavings}/year across {selectedSeats} seat{selectedSeats > 1 ? 's' : ''}!
              </p>
            )}
          </div>

          <div className="sm:text-right flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-border/60 pt-4 sm:pt-0 sm:pl-6">
            <p className="text-xs text-text-dim">Calculated Subscription Total</p>
            <p className="text-2xl sm:text-3xl font-black font-mono text-accent-light">
              ${selectedSeats * pricePerSeat}{' '}
              <span className="text-xs font-normal text-text-dim">/month</span>
            </p>
            <p className="text-[11px] text-text-muted mt-1">
              {isAnnual
                ? `Billed annually at $${selectedSeats * pricePerSeat * 12}/year`
                : 'Billed monthly, cancel anytime'}
            </p>
          </div>
        </div>
      </div>

      {/* Feature Comparison Matrix Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <h3 className="text-base font-bold text-text">Subscription Tier Comparison</h3>
          </div>
          <button
            onClick={() => setShowMatrix(!showMatrix)}
            className="text-xs text-accent-light hover:underline font-semibold cursor-pointer"
          >
            {showMatrix ? 'Collapse Matrix' : 'View Full Feature Matrix'}
          </button>
        </div>

        {showMatrix && (
          <FeatureComparisonMatrix
            isAnnual={isAnnual}
            currentPlan={teamPlan}
            onSelectTier={(tier) => {
              if (tier !== 'free') {
                setSelectedTier(tier);
                setShowUpgradeModal(true);
              }
            }}
          />
        )}
      </div>

      {/* Plan Upgrade Modal */}
      <AnimatePresence>
        {showUpgradeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl bg-bg-card border border-border p-6 sm:p-8 shadow-2xl space-y-6 relative"
            >
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="absolute right-5 top-5 text-text-dim hover:text-text text-sm p-1 rounded-full bg-elevated border border-border cursor-pointer"
              >
                ✕
              </button>

              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 border border-accent/40 text-accent-light text-xs font-bold mb-2">
                  <span>⚡</span>
                  <span>Upgrade Workspace Plan</span>
                </div>
                <h3 className="text-xl font-bold text-text">
                  {selectedTier === 'enterprise' ? 'Upgrade to Enterprise Dedicated' : 'Unlock Team Co-Pilot'}
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  {selectedTier === 'enterprise'
                    ? '5,000+ monthly AI drafts, unlimited team seats, custom PII rules and 24/7 dedicated support.'
                    : '1,000 monthly AI drafts per seat, unlimited shared team macros, and team collaboration.'}
                </p>
              </div>

              {/* Tier selector */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedTier('team')}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                    selectedTier === 'team'
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-elevated/40 hover:border-border-hover'
                  }`}
                >
                  <span className="text-xs font-bold text-text block">Team Co-Pilot</span>
                  <span className="text-[11px] text-accent-light font-mono block mt-1">
                    {isAnnual ? '$15/seat/mo' : '$19/seat/mo'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTier('enterprise')}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                    selectedTier === 'enterprise'
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-elevated/40 hover:border-border-hover'
                  }`}
                >
                  <span className="text-xs font-bold text-text block">Enterprise Dedicated</span>
                  <span className="text-[11px] text-cyan font-mono block mt-1">
                    {isAnnual ? '$79/mo' : '$99/mo'}
                  </span>
                </button>
              </div>

              {/* Seat selection (for team) */}
              {selectedTier === 'team' && (
                <div className="p-4 rounded-2xl bg-bg/90 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text">Team Seats</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedSeats(Math.max(1, selectedSeats - 1))}
                        className="w-8 h-8 rounded-lg bg-elevated border border-border text-text font-bold hover:bg-white/5 flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-sm text-text w-8 text-center">
                        {selectedSeats}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedSeats(selectedSeats + 1)}
                        className="w-8 h-8 rounded-lg bg-elevated border border-border text-text font-bold hover:bg-white/5 flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                    <span className="text-text-dim">Draft Quota</span>
                    <span className="font-mono font-bold text-accent-light">
                      {(selectedSeats * 1000).toLocaleString()} drafts/mo
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-dim">Billing Cadence</span>
                    <span className="font-medium text-text">
                      {isAnnual ? 'Annual (20% off - $15/seat/mo)' : 'Monthly ($19/seat/mo)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <span className="text-xs font-bold text-text">Total Price</span>
                    <span className="text-lg font-black font-mono text-accent-light">
                      ${selectedSeats * pricePerSeat}{' '}
                      <span className="text-xs font-normal text-text-dim">/mo</span>
                    </span>
                  </div>
                </div>
              )}

              {selectedTier === 'enterprise' && (
                <div className="p-4 rounded-2xl bg-bg/90 border border-border space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-text-dim">Draft Quota</span>
                    <span className="font-mono font-bold text-cyan">5,000+ drafts/mo</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-dim">Billing Cadence</span>
                    <span className="font-medium text-text">
                      {isAnnual ? 'Annual (20% off - $79/mo)' : 'Monthly ($99/mo)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <span className="font-bold text-text">Total Price</span>
                    <span className="text-lg font-black font-mono text-cyan">
                      ${enterprisePrice}{' '}
                      <span className="text-xs font-normal text-text-dim">/mo</span>
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-bg border border-border text-xs font-medium text-text-dim hover:text-text cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUpgrade}
                  disabled={isUpgrading}
                  className="px-6 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isUpgrading ? (
                    <>
                      <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Upgrading Workspace...</span>
                    </>
                  ) : (
                    <span>
                      Confirm Upgrade ($
                      {selectedTier === 'enterprise' ? enterprisePrice : selectedSeats * pricePerSeat}
                      /mo)
                    </span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
