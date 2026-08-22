import React from 'react';
import SectionHeading from './SectionHeading';

export default function Comparison() {
  return (
    <section id="comparison" className="py-24 relative overflow-hidden bg-bg-subtle/60">
      <div className="container mx-auto px-4">
        <SectionHeading 
          tag="Fair Pricing &amp; Simplicity"
          title="How DraftPilot compares"
          subtitle="No per-resolution penalties. No complex helpdesk overhauls. Just effortless AI assistance where you already work."
        />
        
        <div className="max-w-5xl mx-auto rounded-3xl border border-border bg-bg-card/90 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-border bg-elevated/70">
                  <th className="p-4 md:p-6 font-semibold text-text">Criteria</th>
                  <th className="p-4 md:p-6 font-bold text-white bg-accent/20 border-x border-accent/40 relative">
                    <div className="flex items-center gap-1.5 text-accent-light">
                      <span>★ DraftPilot</span>
                    </div>
                  </th>
                  <th className="p-4 md:p-6 font-medium text-text-muted">Zendesk + AI</th>
                  <th className="p-4 md:p-6 font-medium text-text-muted">Intercom + Fin</th>
                  <th className="p-4 md:p-6 font-medium text-text-muted">Freshdesk + Freddy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <Row 
                  feature="Monthly Cost Model" 
                  draftpilot={<span className="text-success font-bold">$19/mo (AI included)</span>} 
                  zendesk={<span className="text-red-400">$50+/agent add-on</span>} 
                  intercom={<span className="text-red-400">$0.99 / resolution</span>} 
                  freshdesk={<span className="text-amber-400">$29+/agent add-on</span>} 
                />
                <Row 
                  feature="Setup &amp; Onboarding" 
                  draftpilot={<span className="text-success font-semibold">60 seconds (Chrome Ext)</span>} 
                  zendesk="2–4 weeks project" 
                  intercom="3–7 days config" 
                  freshdesk="3–5 days setup" 
                />
                <Row 
                  feature="Keeps Existing Gmail" 
                  draftpilot={<span className="text-success font-bold">✓ 100% Native</span>} 
                  zendesk="✗ Full migration required" 
                  intercom="✗ Full migration required" 
                  freshdesk="✗ Full migration required" 
                />
                <Row 
                  feature="Local PII Scrubbing" 
                  draftpilot={<span className="text-success font-bold">✓ Built-in Client-Side</span>} 
                  zendesk="✗ Not default" 
                  intercom="✗ Server-side only" 
                  freshdesk="✗ Not default" 
                />
                <Row 
                  feature="Bill When AI Succeeds" 
                  draftpilot={<span className="text-success font-semibold">Fixed &amp; Predictable</span>} 
                  zendesk="High tier minimums" 
                  intercom="Surprise volume fees" 
                  freshdesk="Per-session add-ons" 
                />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ feature, draftpilot, zendesk, intercom, freshdesk }: { 
  feature: string; 
  draftpilot: React.ReactNode; 
  zendesk: React.ReactNode; 
  intercom: React.ReactNode; 
  freshdesk: React.ReactNode;
}) {
  return (
    <tr className="hover:bg-elevated/40 transition-colors">
      <td className="p-4 md:p-5 text-text font-semibold">{feature}</td>
      <td className="p-4 md:p-5 bg-accent/5 border-x border-accent/20 font-medium">{draftpilot}</td>
      <td className="p-4 md:p-5 text-text-muted">{zendesk}</td>
      <td className="p-4 md:p-5 text-text-muted">{intercom}</td>
      <td className="p-4 md:p-5 text-text-muted">{freshdesk}</td>
    </tr>
  );
}
