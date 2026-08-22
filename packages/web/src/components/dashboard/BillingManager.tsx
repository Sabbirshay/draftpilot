'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

export default function BillingManager() {
  const { dbUser, user } = useAuth();
  const [draftsCount, setDraftsCount] = useState(0);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState(1);
  const [isAnnual, setIsAnnual] = useState(false);

  const teamPlan = dbUser?.teams?.plan || 'free';
  const isFreePlan = teamPlan === 'free';
  const pricePerSeat = isAnnual ? 15 : 19;
  const draftQuota = isFreePlan ? 50 : selectedSeats * 1000;
  const quotaPercent = Math.min(100, Math.round((draftsCount / draftQuota) * 100));

  useEffect(() => {
    async function fetchUsage() {
      const teamId = dbUser?.team_id || user?.id;
      if (!teamId) return;

      try {
        const { count } = await supabase
          .from('draft_history')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', teamId);

        if (count !== null) {
          setDraftsCount(count);
        }
      } catch (err) {
        console.warn('Could not fetch usage from Supabase:', err);
      }
    }

    fetchUsage();
  }, [dbUser, user]);

  const handleOpenPortal = () => {
    setIsLoadingPortal(true);
    setTimeout(() => {
      alert('Stripe Billing: In live production with Stripe connected, this redirects to your customer billing checkout / portal.');
      setIsLoadingPortal(false);
    }, 500);
  };

  return (
    <div className="space-y-6">
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
              className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_20px_rgba(124,58,237,0.4)] cursor-pointer"
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
    </div>
  );
}
