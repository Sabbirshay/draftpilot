import React from 'react';
import SectionHeading from './SectionHeading';
import Card from './Card';

export default function ProblemSection() {
  const problems = [
    {
      badge: "The Daily Friction",
      stat: "2–3 mins",
      statLabel: "lost per ticket",
      title: "Endless tab switching",
      description: "Jumping between Gmail, Notion docs, and messy spreadsheets to copy-paste the right policy answer slows your entire team down.",
      accentColor: "from-amber-500/20 to-red-500/10",
      borderGlow: "group-hover:border-amber-500/40",
      icon: (
        <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      badge: "The Pricing Trap",
      stat: "$600+",
      statLabel: "per agent / year",
      title: "Cost punishes success",
      description: "Enterprise help desks charge $50+ AI add-on fees or $0.99 per resolution. When your AI usage actually works, your monthly bill explodes.",
      accentColor: "from-red-500/20 to-pink-500/10",
      borderGlow: "group-hover:border-red-500/40",
      icon: (
        <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      badge: "The Migration Nightmare",
      stat: "3–6 months",
      statLabel: "implementation delay",
      title: "Forced platform lock-in",
      description: "Big tools demand you rip out Gmail, train everyone on a clunky new inbox, and risk customer downtime just to get simple AI reply drafts.",
      accentColor: "from-violet-500/20 to-cyan/10",
      borderGlow: "group-hover:border-accent/40",
      icon: (
        <svg className="w-6 h-6 text-accent-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      )
    }
  ];

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <SectionHeading 
          tag="The Reality Today"
          title="Your competitors have AI assistants. You have a spreadsheet of canned responses."
          subtitle="Support teams shouldn't have to choose between expensive enterprise bloat and slow copy-pasting."
        />
        
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {problems.map((problem, i) => (
            <div 
              key={i} 
              className={`group relative rounded-3xl border border-border bg-bg-card/70 p-6 md:p-8 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${problem.borderGlow}`}
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center border border-border/60 bg-elevated/80 shadow-inner">
                    {problem.icon}
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-dim px-2.5 py-1 rounded-full bg-elevated border border-border/50">
                    {problem.badge}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="text-2xl md:text-3xl font-extrabold text-text tracking-tight mb-0.5">
                    {problem.stat}
                  </div>
                  <div className="text-xs text-text-dim font-medium uppercase tracking-wider">
                    {problem.statLabel}
                  </div>
                </div>

                <h3 className="text-lg font-bold text-text mb-2.5">{problem.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{problem.description}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-border/40 flex items-center gap-1 text-xs text-text-dim group-hover:text-text transition-colors">
                <span>See how DraftPilot solves this</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
