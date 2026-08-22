import React from 'react';
import SectionHeading from './SectionHeading';

export default function HowItWorks() {
  const steps = [
    {
      number: "01",
      tag: "60-Second Setup",
      title: "Add extension & connect",
      description: "One-click install from the Chrome Web Store. Paste your existing macros or canned responses.",
      uiSnippet: (
        <div className="bg-bg/90 rounded-2xl p-3 border border-border text-left font-mono text-[11px] text-text-muted space-y-1.5 shadow-inner">
          <div className="flex items-center gap-1.5 text-xs text-text">
            <span className="w-2 h-2 rounded-full bg-success" />
            <span>Chrome Extension Active</span>
          </div>
          <p className="text-[10px] text-text-dim">Host: mail.google.com</p>
          <div className="bg-elevated px-2 py-1 rounded text-[10px] text-accent-light">
            ✓ 14 team macros imported
          </div>
        </div>
      )
    },
    {
      number: "02",
      tag: "Zero Manual Prompting",
      title: "Open any Gmail reply",
      description: "Click reply on any email thread. DraftPilot automatically reads the customer context and scrubs PII.",
      uiSnippet: (
        <div className="bg-bg/90 rounded-2xl p-3 border border-border text-left font-mono text-[11px] text-text-muted space-y-1.5 shadow-inner">
          <div className="flex items-center justify-between text-xs text-text">
            <span className="text-cyan font-semibold">Thread Detected</span>
            <span className="text-[10px] bg-cyan/15 text-cyan px-1.5 py-0.5 rounded">Auto</span>
          </div>
          <p className="text-[10px] text-text-dim truncate">"Customer asking for refund status..."</p>
          <div className="bg-elevated px-2 py-1 rounded text-[10px] text-success">
            ✓ PII scrubbed client-side
          </div>
        </div>
      )
    },
    {
      number: "03",
      tag: "Instant Insertion",
      title: "Generate & insert reply",
      description: "Review the AI draft constructed from your team macros. Click insert and send. You always stay in control.",
      uiSnippet: (
        <div className="bg-bg/90 rounded-2xl p-3 border border-accent/40 text-left font-mono text-[11px] text-text-muted space-y-1.5 shadow-inner bg-accent/5">
          <div className="flex items-center justify-between text-xs text-text">
            <span className="text-accent-light font-semibold">Draft Ready</span>
            <span className="text-[10px] bg-accent/20 text-accent-light px-1.5 py-0.5 rounded font-bold">0.3s</span>
          </div>
          <div className="bg-accent/20 text-white px-2 py-1 rounded text-[10px] text-center font-bold">
            ✓ Injected into Gmail Compose
          </div>
        </div>
      )
    }
  ];

  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden bg-bg-subtle/50">
      <div className="container mx-auto px-4">
        <SectionHeading 
          tag="Simple Workflow"
          title="Three clicks to your first AI-drafted reply"
          subtitle="No complex training. No new inbox software to learn. It lives directly where you already work."
        />
        
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {steps.map((step, i) => (
            <div 
              key={i} 
              className="rounded-3xl border border-border bg-bg-card/90 p-6 md:p-8 flex flex-col justify-between hover:border-border-hover transition-all duration-300 shadow-xl group"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-accent to-accent-light">
                    {step.number}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim px-2.5 py-1 rounded-full bg-elevated border border-border">
                    {step.tag}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-text mb-2.5">{step.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed mb-6">{step.description}</p>
              </div>

              <div className="pt-2">
                {step.uiSnippet}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
