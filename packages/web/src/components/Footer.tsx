import React from 'react';

export default function Footer() {
  return (
    <footer className="border-t border-border bg-bg-subtle/80 py-16 text-xs text-text-muted">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-12 border-b border-border/60">
          {/* Brand Col */}
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold">
                DP
              </div>
              <span className="text-base font-bold text-text tracking-tight">DraftPilot</span>
            </div>
            <p className="text-text-dim text-xs leading-relaxed max-w-xs">
              The AI drafting assistant designed specifically for small support teams and solo founders.
            </p>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-elevated border border-border text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-text-dim">Systems Operational</span>
            </div>
          </div>

          {/* Links */}
          <div className="space-y-2.5">
            <p className="font-bold text-text uppercase tracking-wider text-[10px]">Product</p>
            <ul className="space-y-2">
              <li><a href="#how-it-works" className="hover:text-text transition-colors">How it works</a></li>
              <li><a href="#features" className="hover:text-text transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-text transition-colors">Pricing</a></li>
              <li><a href="#comparison" className="hover:text-text transition-colors">Compare</a></li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <p className="font-bold text-text uppercase tracking-wider text-[10px]">Integrations</p>
            <ul className="space-y-2 text-text-dim">
              <li className="text-text">Gmail (Live)</li>
              <li>Help Scout (v1.5)</li>
              <li>Zendesk (v1.5)</li>
              <li>Freshdesk (v1.5)</li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <p className="font-bold text-text uppercase tracking-wider text-[10px]">Legal &amp; Privacy</p>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-text transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-text transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-text transition-colors">PII Architecture</a></li>
              <li><a href="#" className="hover:text-text transition-colors">Security Overview</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-text-dim">
          <p>© 2026 DraftPilot. Made for support teams who deserve better tools.</p>
          <p className="font-mono">v0.1.0 • Stage 1 MVP</p>
        </div>
      </div>
    </footer>
  );
}
