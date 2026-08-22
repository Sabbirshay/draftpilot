import React from 'react';
import Button from './Button';

export default function TrustCTA() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto rounded-4xl border border-border bg-gradient-to-b from-elevated/90 to-bg-card/90 p-8 md:p-14 text-center shadow-[0_20px_80px_rgba(0,0,0,0.5)] relative overflow-hidden">
          {/* Ambient glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-accent/20 blur-[100px] rounded-full pointer-events-none" />

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bg border border-border text-[11px] font-semibold text-text-dim uppercase tracking-wider mb-6">
            <span>The Vision</span>
          </div>

          <h2 className="text-3xl md:text-5xl font-extrabold text-text mb-6 tracking-tight leading-tight">
            Built for small support teams who deserve better tools.
          </h2>

          <p className="text-base md:text-lg text-text-muted mb-8 max-w-2xl mx-auto leading-relaxed">
            "I built DraftPilot from ~5 years in frontline CX operations because small teams are tired of enterprise help desks charging thousands for simple AI drafts. You deserve speed without platform lock-in."
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <Button variant="primary" className="text-sm px-8 py-4 rounded-full font-bold shadow-[0_0_30px_rgba(124,58,237,0.5)]">
              Add DraftPilot to Chrome — Free
            </Button>
            <Button variant="secondary" href="#pricing" className="text-sm px-6 py-4 rounded-full">
              View Team Plan ($19/mo)
            </Button>
          </div>

          <p className="text-xs text-text-dim">Takes 60 seconds • No credit card required • Works on Gmail</p>
        </div>
      </div>
    </section>
  );
}
