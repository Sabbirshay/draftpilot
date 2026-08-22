import React from 'react';
import SectionHeading from './SectionHeading';

export default function Features() {
  const features = [
    {
      tag: "Security First",
      title: "Client-side PII scrubbing",
      description: "Names, emails, phone numbers, and card details are scrubbed locally in your browser before any prompt is sent to the LLM.",
      icon: (
        <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
    {
      tag: "Team Memory",
      title: "Your macros & tone of voice",
      description: "Import your team's existing canned responses. DraftPilot searches and references them so generated replies sound like your top agent.",
      icon: (
        <svg className="w-5 h-5 text-accent-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    },
    {
      tag: "Zero Overhead",
      title: "Zero migration required",
      description: "DraftPilot is a lightweight Chrome extension that layers right over Gmail. Keep your current email setup and workflows intact.",
      icon: (
        <svg className="w-5 h-5 text-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    {
      tag: "Transparent Pricing",
      title: "Flat seat pricing, AI included",
      description: "$19/agent/month flat. No per-resolution penalty fees like Intercom or surprise monthly add-ons like Zendesk.",
      icon: (
        <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      tag: "Practitioner Built",
      title: "Built from real CX operations",
      description: "Designed by someone with ~5 years in frontline customer support and CX ops. Built to solve real daily friction, not an AI gimmick.",
      icon: (
        <svg className="w-5 h-5 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      tag: "Continuous Learning",
      title: "Learns from your edits (v1.5)",
      description: "Whenever an agent tweaks a drafted response, DraftPilot captures the diff to continuously refine team voice and policy accuracy.",
      icon: (
        <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      )
    }
  ];

  return (
    <section id="features" className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <SectionHeading 
          tag="Core Capabilities"
          title="Built specifically for support teams of 1–10"
          subtitle="Everything you need to answer customer tickets with speed and precision, without paying enterprise taxes."
        />
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, i) => (
            <div 
              key={i} 
              className="rounded-3xl border border-border bg-bg-card/80 p-6 md:p-8 flex flex-col justify-between hover:border-accent/40 hover:bg-bg-card transition-all duration-300 shadow-lg group hover:-translate-y-1"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-10 h-10 rounded-2xl bg-elevated border border-border flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim px-2.5 py-1 rounded-full bg-elevated border border-border">
                    {feature.tag}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-text mb-2">{feature.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
