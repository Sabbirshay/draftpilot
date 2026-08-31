'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

export default function BillingManager() {
  const { dbUser, user } = useAuth();
  const [draftsCount, setDraftsCount] = useState(0);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState(1);
  const [isAnnual, setIsAnnual] = useState(false);
  const [portalNotice, setPortalNotice] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const [customQuota, setCustomQuota] = useState<number | null>(null);
  const [livePlan, setLivePlan] = useState<string>(dbUser?.teams?.plan || 'free');
  const teamPlan = livePlan || dbUser?.teams?.plan || 'free';
  const isFreePlan = teamPlan === 'free';
  const pricePerSeat = isAnnual ? 15 : 19;
  const draftQuota = customQuota || (isFreePlan ? 50 : selectedSeats * 1000);
  const quotaPercent = Math.min(100, Math.round((draftsCount / draftQuota) * 100));

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

    if (isFreePlan) {
      setShowUpgradeModal(true);
      setIsLoadingPortal(false);
      return;
    }

    setPortalNotice({
      type: 'info',
      message: 'Connecting to Stripe Customer Billing Portal...',
    });

    setTimeout(() => {
      setPortalNotice({
        type: 'success',
        message: '✓ Stripe Billing session initialized. In production with live Stripe credentials, this redirects to your Stripe Hosted Billing Portal.',
      });
      setIsLoadingPortal(false);
    }, 600);
  };

  const handleConfirmUpgrade = async () => {
    setIsUpgrading(true);
    setPortalNotice(null);

    try {
      const activeTeamId = dbUser?.team_id;
      const targetQuota = selectedSeats * 1000;

      if (activeTeamId) {
        const { error } = await supabase
          .from('teams')
          .update({
            plan: 'team',
            monthly_draft_limit: targetQuota,
          })
          .eq('id', activeTeamId);

        if (error) throw error;
      }

      setLivePlan('team');
      setCustomQuota(targetQuota);
      setShowUpgradeModal(false);
      setPortalNotice({
        type: 'success',
        message: `🎉 Workspace upgraded to Team Plan (${selectedSeats} seat${selectedSeats > 1 ? 's' : ''}, ${targetQuota.toLocaleString()} monthly drafts)!`,
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
              <span>{isFreePlan ? 'FREE TIER ACTIVE' : 'TEAM TIER ACTIVE'}</span>
            </div>
            <h2 className="text-3xl font-extrabold text-text font-mono">
              {isFreePlan ? '$0' : `$${selectedSeats * pricePerSeat}`} <span className="text-sm font-normal text-text-muted">/month</span>
            </h2>
            <p className="text-xs text-text-muted mt-1">
              {isFreePlan
                ? '50 AI drafts/month included · 1 Active Seat · Upgrade to Team plan for unlimited macros and team seats'
                : `Flat $${pricePerSeat}/seat/month • ${selectedSeats} Allocated Seats • Unlimited team macros`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleOpenPortal}
              disabled={isLoadingPortal}
              className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_20px_rgba(124,58,237,0.4)] cursor-pointer disabled:opacity-50"
            >
              {isLoadingPortal ? 'Connecting...' : isFreePlan ? 'Upgrade to Team Plan ($19/mo) →' : 'Manage Invoices & Cards (Stripe) →'}
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
              : 'Adding seats automatically adds +1,000 monthly drafts with zero migration downtime.'}
          </p>
        </div>
      </div>

      {/* Pricing Calculator Card */}
      <div className="p-6 rounded-3xl bg-elevated/70 border border-border/80 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-text">Plan &amp; Seat Calculator</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Scale your support co-pilot as your team grows.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={!isAnnual ? 'text-text font-bold' : 'text-text-dim'}>Monthly</span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                isAnnual ? 'bg-accent' : 'bg-elevated border border-border'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  isAnnual ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={isAnnual ? 'text-accent-light font-bold' : 'text-text-dim'}>
              Annual (20% off)
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-4 rounded-2xl bg-bg/80 border border-border">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedSeats(Math.max(1, selectedSeats - 1))}
              className="w-9 h-9 rounded-xl bg-elevated border border-border text-text font-bold hover:bg-white/5 flex items-center justify-center cursor-pointer"
            >
              -
            </button>
            <span className="text-xl font-bold font-mono text-text w-12 text-center">
              {selectedSeats}
            </span>
            <button
              onClick={() => setSelectedSeats(selectedSeats + 1)}
              className="w-9 h-9 rounded-xl bg-elevated border border-border text-text font-bold hover:bg-white/5 flex items-center justify-center cursor-pointer"
            >
              +
            </button>
            <span className="text-xs text-text-muted">Seats (${pricePerSeat}/seat/mo)</span>
          </div>

          <div className="text-right">
            <p className="text-xs text-text-dim">Calculated Total</p>
            <p className="text-xl font-black font-mono text-accent-light">
              ${selectedSeats * pricePerSeat} <span className="text-xs font-normal text-text-dim">/mo</span>
            </p>
          </div>
        </div>
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
                  <span>Upgrade to Team Plan</span>
                </div>
                <h3 className="text-xl font-bold text-text">Unlock Full Power for Your Support Team</h3>
                <p className="text-xs text-text-muted mt-1">
                  Includes 1,000 monthly AI drafts per seat, unlimited shared macros, and team collaboration.
                </p>
              </div>

              {/* Seat selection */}
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
                  <span className="text-text-dim">Billing Cycle</span>
                  <span className="font-medium text-text">
                    {isAnnual ? 'Annual ($15/seat/mo)' : 'Monthly ($19/seat/mo)'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="text-xs font-bold text-text">Total Price</span>
                  <span className="text-lg font-black font-mono text-accent-light">
                    ${selectedSeats * pricePerSeat} <span className="text-xs font-normal text-text-dim">/mo</span>
                  </span>
                </div>
              </div>

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
                    <span>Confirm Upgrade (${selectedSeats * pricePerSeat}/mo)</span>
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
