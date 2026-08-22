import React from 'react';
import SectionHeading from './SectionHeading';
import Button from './Button';

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-accent/15 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="container mx-auto px-4">
        <SectionHeading 
          tag="Transparent Pricing"
          title="Simple pricing. AI included."
          subtitle="Start free, upgrade as your team grows. No per-resolution surprises or hidden fees."
        />
        
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-10 items-stretch">
          {/* Free Tier */}
          <div className="rounded-3xl border border-border bg-bg-card/80 p-8 flex flex-col justify-between hover:border-border-hover transition-all">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-text">Starter</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim px-2.5 py-1 rounded-full bg-elevated border border-border">
                  Free Forever
                </span>
              </div>
              <p className="text-xs text-text-muted mb-6">Ideal for solo founders &amp; testing the workflow in Gmail.</p>
              
              <div className="flex items-baseline gap-1 text-text mb-8 pb-6 border-b border-border/60">
                <span className="text-5xl font-black tracking-tight">$0</span>
                <span className="text-xs text-text-dim">/ month</span>
              </div>
              
              <ul className="space-y-3.5 mb-8">
                <FeatureItem>1 user seat</FeatureItem>
                <FeatureItem>50 AI-drafted replies / month</FeatureItem>
                <FeatureItem>Gmail integration</FeatureItem>
                <FeatureItem>Macro &amp; canned response storage</FeatureItem>
                <FeatureItem>Client-side PII scrubbing</FeatureItem>
              </ul>
            </div>
            
            <Button variant="secondary" className="w-full rounded-full py-3 text-xs font-bold">
              Get Started Free
            </Button>
          </div>

          {/* Team Tier (Recommended Jitter Style) */}
          <div className="rounded-3xl border-2 border-accent bg-bg-card p-8 flex flex-col justify-between relative shadow-[0_0_40px_rgba(124,58,237,0.25)] scale-100 md:scale-105 transition-all">
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
              <p className="text-xs text-text-muted mb-6">For support teams (1–10) looking to 5× reply velocity.</p>
              
              <div className="flex items-baseline gap-1 text-text mb-8 pb-6 border-b border-border/60">
                <span className="text-5xl font-black tracking-tight text-white">$19</span>
                <span className="text-xs text-text-dim">/ agent / month</span>
              </div>
              
              <ul className="space-y-3.5 mb-8">
                <FeatureItem bold>Unlimited user seats</FeatureItem>
                <FeatureItem bold>2,000 AI drafts / agent / month</FeatureItem>
                <FeatureItem>All integrations (Gmail + Zendesk &amp; Help Scout coming)</FeatureItem>
                <FeatureItem>Full team macro management &amp; syncing</FeatureItem>
                <FeatureItem>Continuous learning loop &amp; tone matching</FeatureItem>
                <FeatureItem>Priority email &amp; Discord support</FeatureItem>
              </ul>
            </div>
            
            <Button variant="primary" className="w-full rounded-full py-3 text-xs font-bold shadow-[0_0_20px_rgba(124,58,237,0.5)]">
              Start 14-Day Free Trial
            </Button>
          </div>
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
