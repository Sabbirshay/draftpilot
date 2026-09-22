'use client';

import React from 'react';
import Button from './Button';
import { ThreeDStaggerFlip } from './ThreeDStaggerFlip';
import LiquidGlassCluster from '@/components/originkit/ui/glass-icon';
import InteractiveDemo from './InteractiveDemo';

export default function Hero() {
  return (
    <section className="relative pt-12 pb-14 md:pt-20 md:pb-20 overflow-hidden">
      {/* Jitter-style Ambient Violet/Cyan Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-accent/20 blur-[130px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-1/3 w-[300px] h-[200px] bg-cyan/10 blur-[100px] rounded-full pointer-events-none -z-10" />
      
      <div className="container mx-auto px-4 relative z-10 flex flex-col items-center text-center">
        {/* Jitter-style Announcement Pill */}
        <a 
          href="#pricing" 
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-elevated border border-border hover:border-accent/50 text-xs text-text-muted hover:text-text mb-6 transition-all duration-300 shadow-sm group"
        >
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          <span><strong>Stage 1 MVP:</strong> AI-drafted replies right inside Gmail</span>
          <span className="text-accent group-hover:translate-x-0.5 transition-transform">→</span>
        </a>

        {/* 3D Glass Icon Showcase */}
        <div className="mb-6 w-24 h-24 md:w-32 md:h-32 rounded-3xl overflow-hidden shadow-[0_10px_40px_rgba(124,58,237,0.3)] border border-border/60 relative group cursor-grab active:cursor-grabbing">
          <LiquidGlassCluster
            shape="Torus"
            size={75}
            speed={70}
            backdrop={{
              type: "Text",
              text: "DRAFT\nPILOT",
              textColor: "#FFFFFF",
              font: {
                fontSize: "24px",
                fontWeight: 800,
                fontFamily: "Inter, sans-serif",
              },
            }}
            glass={{
              tint: "#7c3aed",
              chromatic: 80,
              frost: 25,
            }}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-text max-w-5xl mb-6 leading-[1.12]">
          <span className="block whitespace-normal sm:whitespace-nowrap">
            <ThreeDStaggerFlip text="Support replies in seconds." secondaryText="Support replies in seconds." className="inline-flex" />
          </span>
          <span className="block whitespace-normal sm:whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-r from-text via-text-muted to-accent-light">
            Without leaving your inbox.
          </span>
        </h1>
        
        {/* Subtitle */}
        <p className="text-base sm:text-lg md:text-xl text-text-muted max-w-2xl mb-8 leading-relaxed font-normal">
          Stop copy-pasting from spreadsheets. DraftPilot retrieves the exact answer from your team's knowledge base and writes the reply for you in Gmail.
        </p>
        
        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 mb-6">
          <Button variant="primary" href="/join" className="text-sm px-8 py-3.5 rounded-full font-semibold shadow-[0_0_30px_rgba(124,58,237,0.4)] flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
            <span>Add to Chrome — Free</span>
          </Button>
          <Button variant="ghost" href="#how-it-works" className="text-sm px-6 py-3.5 rounded-full border border-border hover:border-border-hover">
            See how it works
          </Button>
        </div>
        
        {/* Trust bullet line */}
        <p className="text-xs text-text-dim flex items-center justify-center gap-2 mb-10">
          <span>✓ 100% Free tier available</span>
          <span>•</span>
          <span>✓ Works with Gmail</span>
          <span>•</span>
          <span>✓ Client-side PII scrubbing</span>
        </p>

        {/* Jitter-style Interactive Live Demo Showcase */}
        <InteractiveDemo />

        {/* Architectural Trust & Compliance Bar */}
        <div className="mt-8 pt-8 border-t border-border/40 w-full max-w-4xl">
          <p className="text-xs uppercase tracking-widest text-text-dim font-semibold mb-6">
            Engineered for privacy, reliability &amp; speed
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="flex flex-col items-center p-3 rounded-2xl bg-elevated/40 border border-border/50 text-center">
              <span className="text-accent-light text-base mb-1">🛡️</span>
              <span className="text-xs font-semibold text-text">Pre-Flight PII Redaction</span>
              <span className="text-[10px] text-text-dim mt-0.5">Scrubbed locally in browser</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-2xl bg-elevated/40 border border-border/50 text-center">
              <span className="text-cyan text-base mb-1">⚡</span>
              <span className="text-xs font-semibold text-text">7-Tier AI Cascade</span>
              <span className="text-[10px] text-text-dim mt-0.5">&lt;300ms reply generation</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-2xl bg-elevated/40 border border-border/50 text-center">
              <span className="text-emerald-400 text-base mb-1">🔒</span>
              <span className="text-xs font-semibold text-text">Zero Model Training</span>
              <span className="text-[10px] text-text-dim mt-0.5">Your data stays your data</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-2xl bg-elevated/40 border border-border/50 text-center">
              <span className="text-purple-400 text-base mb-1">📩</span>
              <span className="text-xs font-semibold text-text">Native Gmail MV3</span>
              <span className="text-[10px] text-text-dim mt-0.5">No new inbox software</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
