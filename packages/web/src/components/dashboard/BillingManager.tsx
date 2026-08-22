'use client';

import React, { useState } from 'react';

export default function BillingManager() {
  const [seats, setSeats] = useState(5);
  const [isAnnual, setIsAnnual] = useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  const pricePerSeat = isAnnual ? 15 : 19;
  const monthlyTotal = seats * pricePerSeat;
  const draftQuota = seats * 1000;
  const usedDrafts = 2840;
  const quotaPercent = Math.round((usedDrafts / draftQuota) * 100);

  const handleOpenPortal = () => {
    setIsLoadingPortal(true);
    setTimeout(() => {
      alert('Stripe Customer Billing Portal: In live production, this redirects to your hosted Stripe billing management page.');
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
              <span>TEAM TIER ACTIVE</span>
            </div>
            <h2 className="text-3xl font-extrabold text-text font-mono">
              ${monthlyTotal} <span className="text-sm font-normal text-text-muted">/month</span>
            </h2>
            <p className="text-xs text-text-muted mt-1">
              Flat ${pricePerSeat}/agent/month • {seats} Allocated Agent Seats • Next billing date: Sept 1, 2026
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleOpenPortal}
              disabled={isLoadingPortal}
              className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_20px_rgba(124,58,237,0.4)] cursor-pointer"
            >
              {isLoadingPortal ? 'Loading Stripe...' : 'Manage Invoices & Cards (Stripe) →'}
            </button>
          </div>
        </div>

        {/* Monthly Draft Quota Progress Meter */}
        <div className="mt-8 pt-6 border-t border-border/50">
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="font-semibold text-text">Monthly AI Draft Quota</span>
            <span className="font-mono text-accent-light font-bold">
              {usedDrafts.toLocaleString()} / {draftQuota.toLocaleString()} drafts ({quotaPercent}%)
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-bg/90 overflow-hidden p-0.5 border border-border/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent via-accent-hover to-cyan shadow-[0_0_12px_rgba(124,58,237,0.7)] transition-all duration-500"
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-text-dim mt-2">
            Need more drafts? Adding seats automatically adds +1,000 monthly drafts with zero migration downtime.
          </p>
        </div>
      </div>

      {/* Adjust Seat Allocation Card */}
      <div className="p-6 rounded-3xl bg-elevated/70 border border-border/80 shadow-lg">
        <h3 className="text-sm font-bold text-text mb-2">Adjust Workspace Seats</h3>
        <p className="text-xs text-text-muted mb-6">
          Instantly scale agent seats up or down. Changes take effect immediately and are prorated on your invoice.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-4 rounded-2xl bg-bg/80 border border-border">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSeats(Math.max(1, seats - 1))}
              className="w-9 h-9 rounded-xl bg-elevated border border-border text-text font-bold hover:bg-white/5 flex items-center justify-center cursor-pointer"
            >
              -
            </button>
            <span className="text-xl font-bold font-mono text-text w-12 text-center">
              {seats}
            </span>
            <button
              onClick={() => setSeats(seats + 1)}
              className="w-9 h-9 rounded-xl bg-elevated border border-border text-text font-bold hover:bg-white/5 flex items-center justify-center cursor-pointer"
            >
              +
            </button>
            <span className="text-xs text-text-muted">Seats (${pricePerSeat} each)</span>
          </div>

          <div className="text-right">
            <p className="text-xs text-text-dim">New Monthly Total</p>
            <p className="text-lg font-bold font-mono text-text">${seats * pricePerSeat} / mo</p>
          </div>
        </div>
      </div>

      {/* Invoice History */}
      <div className="p-6 rounded-3xl bg-elevated/70 border border-border/80 shadow-lg">
        <h3 className="text-sm font-bold text-text mb-4">Past Invoices &amp; Receipts</h3>
        <div className="divide-y divide-border/40 text-xs">
          {[
            { date: 'Aug 01, 2026', amount: '$95.00', status: 'Paid', invoiceId: 'INV-2026-0801' },
            { date: 'Jul 01, 2026', amount: '$76.00', status: 'Paid', invoiceId: 'INV-2026-0701' },
            { date: 'Jun 01, 2026', amount: '$76.00', status: 'Paid', invoiceId: 'INV-2026-0601' },
          ].map((inv) => (
            <div key={inv.invoiceId} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-text">{inv.date}</p>
                <p className="text-[11px] text-text-dim font-mono">{inv.invoiceId}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono font-bold text-text">{inv.amount}</span>
                <span className="px-2 py-0.5 rounded-full bg-success/20 text-success text-[10px] font-bold">
                  {inv.status}
                </span>
                <button 
                  onClick={() => alert(`Downloading PDF for ${inv.invoiceId}`)}
                  className="text-accent hover:underline text-xs cursor-pointer"
                >
                  Download PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
