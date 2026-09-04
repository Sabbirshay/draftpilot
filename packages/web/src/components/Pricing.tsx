'use client';

import React, { useState } from 'react';
import SectionHeading from './SectionHeading';
import Button from './Button';
import FeatureComparisonMatrix from './dashboard/FeatureComparisonMatrix';

export default function Pricing() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <section id="pricing" className="py-24 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-accent/15 blur-[130px] rounded-full pointer-events-none -z-10" />

      <div className="container mx-auto px-4">
        <SectionHeading 
          tag="Transparent Pricing"
          title="Simple pricing. AI included."
          subtitle="Start free, upgrade as your team grows. No per-resolution surprises or hidden fees."
        />

        {/* Monthly / Annual Cadence Toggle with 20% Savings Callout */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <span className={`text-xs font-semibold ${!isAnnual ? 'text-text' : 'text-text-dim'}`}>
            Monthly Billing
          </span>

          <button
            type="button"
            role="switch"
            aria-checked={isAnnual}
            onClick={() => setIsAnnual(!isAnnual)}
            className={`w-14 h-7 rounded-full p-1 transition-colors cursor-pointer relative ${
              isAnnual ? 'bg-accent' : 'bg-elevated border border-border'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                isAnnual ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${isAnnual ? 'text-text' : 'text-text-dim'}`}>
              Annual Billing
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold tracking-wide animate-pulse">
              Save 20% ✨
            </span>
          </div>
        </div>
        
        {/* 3 Tiers Grid: Free, Team, Enterprise */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-16 items-stretch">
          {/* 1. Free Starter Tier */}
          <div className="rounded-3xl border border-border bg-bg-card/80 p-7 flex flex-col justify-between hover:border-border-hover transition-all">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-text">Starter</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim px-2.5 py-1 rounded-full bg-elevated border border-border">
                  Free Forever
                </span>
              </div>
              <p className="text-xs text-text-muted mb-6">
                Ideal for solo founders &amp; testing AI draft suggestions in Gmail.
              </p>
              
              <div className="flex items-baseline gap-1 text-text mb-6 pb-6 border-b border-border/60">
                <span className="text-4xl sm:text-5xl font-black tracking-tight">$0</span>
                <span className="text-xs text-text-dim">/ month</span>
              </div>
              
              <ul className="space-y-3 mb-8">
                <FeatureItem>1 user seat</FeatureItem>
                <FeatureItem>50 AI drafts / month</FeatureItem>
                <FeatureItem>Gmail integration</FeatureItem>
                <FeatureItem>Up to 5 custom macros</FeatureItem>
                <FeatureItem>Client-side PII scrubbing (8 built-in)</FeatureItem>
                <FeatureItem>Community &amp; email support</FeatureItem>
              </ul>
            </div>
            
            <Button
              variant="secondary"
              href={`/join?cadence=${isAnnual ? 'yearly' : 'monthly'}&tier=free`}
              className="w-full rounded-full py-3 text-xs font-bold"
            >
              Get Started Free
            </Button>
          </div>

          {/* 2. Team Co-Pilot Tier (Most Popular) */}
          <div className="rounded-3xl border-2 border-accent bg-bg-card p-7 flex flex-col justify-between relative shadow-[0_0_40px_rgba(124,58,237,0.25)] scale-100 md:scale-105 transition-all z-10">
            <div className="absolute -top-3.5 right-8">
              <span className="bg-accent text-white text-[11px] font-bold tracking-wide uppercase px-3.5 py-1 rounded-full shadow-[0_0_15px_rgba(124,58,237,0.6)]">
                Most Popular
              </span>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-text">Team Co-Pilot</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent-light px-2.5 py-1 rounded-full bg-accent/15 border border-accent/30">
                  Full AI Suite
                </span>
              </div>
              <p className="text-xs text-text-muted mb-6">
                For fast-paced support teams looking to 5× reply velocity with team macros.
              </p>
              
              <div className="flex items-baseline gap-1 text-text mb-6 pb-6 border-b border-border/60">
                <span className="text-4xl sm:text-5xl font-black tracking-tight text-white">
                  ${isAnnual ? '15' : '19'}
                </span>
                <span className="text-xs text-text-dim">
                  / agent / month {isAnnual ? '(billed annually)' : ''}
                </span>
              </div>
              
              <ul className="space-y-3 mb-8">
                <FeatureItem bold>Flexible seats ($19/mo or $15/yr)</FeatureItem>
                <FeatureItem bold>1,000 AI drafts / agent / month</FeatureItem>
                <FeatureItem bold>Custom PII scrubbing rules</FeatureItem>
                <FeatureItem>All integrations (Gmail + Help Scout export)</FeatureItem>
                <FeatureItem>Unlimited shared team macros</FeatureItem>
                <FeatureItem>Priority email &amp; Discord support (&lt;12h SLA)</FeatureItem>
              </ul>
            </div>
            
            <Button
              variant="primary"
              href={`/join?cadence=${isAnnual ? 'yearly' : 'monthly'}&tier=team`}
              className="w-full rounded-full py-3 text-xs font-bold shadow-[0_0_20px_rgba(124,58,237,0.5)]"
            >
              Start 14-Day Free Trial
            </Button>
          </div>

          {/* 3. Enterprise Dedicated Tier */}
          <div className="rounded-3xl border border-border bg-bg-card/80 p-7 flex flex-col justify-between hover:border-border-hover transition-all">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-text">Enterprise</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan px-2.5 py-1 rounded-full bg-cyan/15 border border-cyan/30">
                  Dedicated
                </span>
              </div>
              <p className="text-xs text-text-muted mb-6">
                For scaling companies needing high-volume quotas, audit vaults, and custom SLA.
              </p>
              
              <div className="flex items-baseline gap-1 text-text mb-6 pb-6 border-b border-border/60">
                <span className="text-4xl sm:text-5xl font-black tracking-tight text-white">
                  ${isAnnual ? '79' : '99'}
                </span>
                <span className="text-xs text-text-dim">
                  / month {isAnnual ? '(billed annually)' : ''}
                </span>
              </div>
              
              <ul className="space-y-3 mb-8">
                <FeatureItem bold>5,000+ pooled AI drafts / month</FeatureItem>
                <FeatureItem bold>Unlimited seats with RBAC</FeatureItem>
                <FeatureItem bold>Custom PII rules + audit logs</FeatureItem>
                <FeatureItem>Unlimited knowledge docs with continuous sync</FeatureItem>
                <FeatureItem>Custom webhooks &amp; CRM synchronization</FeatureItem>
                <FeatureItem>24/7 dedicated Slack channel (&lt;1h SLA)</FeatureItem>
              </ul>
            </div>
            
            <Button
              variant="secondary"
              href={`/join?cadence=${isAnnual ? 'yearly' : 'monthly'}&tier=enterprise`}
              className="w-full rounded-full py-3 text-xs font-bold"
            >
              Contact Sales / Upgrade
            </Button>
          </div>
        </div>

        {/* Embedded Transparent Feature Comparison Matrix */}
        <div className="max-w-6xl mx-auto mb-10">
          <FeatureComparisonMatrix isAnnual={isAnnual} currentPlan="free" />
        </div>
        
        <p className="text-center text-xs text-text-dim">
          All plans include full AI model access. No setup fees, cancel anytime.
        </p>
      </div>
    </section>
  );
}

function FeatureItem({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <li className="flex items-start gap-2.5 text-xs text-text-muted">
      <div className="w-4 h-4 rounded-full bg-accent/20 text-accent flex items-center justify-center shrink-0 mt-0.5">
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <span className={bold ? 'text-text font-semibold' : ''}>{children}</span>
    </li>
  );
}
