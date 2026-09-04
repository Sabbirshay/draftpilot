'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TryDemoModeModal from './dashboard/TryDemoModeModal';

export function InteractiveDemo() {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(true);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState<boolean>(false);

  const steps = [
    {
      id: 0,
      badge: 'Step 1',
      title: 'Gmail Reply Detected',
      desc: 'Opens directly alongside your active Gmail reply box. Zero tab switching.',
    },
    {
      id: 1,
      badge: 'Step 2',
      title: 'Knowledge Base Matched',
      desc: 'Instantly identifies relevant team macros & refund policies using local RAG.',
    },
    {
      id: 2,
      badge: 'Step 3',
      title: 'AI Draft Assembled',
      desc: 'Drafts a polished, human-sounding reply in your team tone in under 2 seconds.',
    },
    {
      id: 3,
      badge: 'Step 4',
      title: 'One-Click Insert',
      desc: 'Inserts directly into your compose field. You stay in control before hitting send.',
    },
  ];

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, steps.length]);

  return (
    <div className="w-full max-w-5xl mx-auto my-12">
      {/* Step Navigation Tabs (Jitter style) */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {steps.map((step, idx) => (
          <button
            key={step.id}
            onClick={() => {
              setActiveStep(idx);
              setIsAutoPlaying(false);
            }}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 flex items-center gap-2 border ${
              activeStep === idx
                ? 'bg-accent text-white border-accent shadow-[0_0_20px_rgba(124,58,237,0.4)]'
                : 'bg-elevated/70 text-text-muted border-border hover:border-border-hover hover:text-text'
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
              activeStep === idx ? 'bg-white text-accent' : 'bg-border text-text-muted'
            }`}>
              {idx + 1}
            </span>
            <span>{step.title}</span>
          </button>
        ))}
      </div>

      {/* Main Interactive Motion Canvas */}
      <div className="rounded-3xl border border-border bg-bg-card/90 backdrop-blur-xl p-4 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)] relative overflow-hidden">
        {/* Top Browser / Canvas Bar */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-border/70">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-3 text-xs text-text-dim font-mono">mail.google.com/mail/u/0/#inbox</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="px-3 py-1 rounded-full bg-accent/20 hover:bg-accent/30 text-accent-light text-[11px] font-bold border border-accent/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(124,58,237,0.3)]"
            >
              <span>✨ Try Demo Sandbox</span>
            </button>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
              <span>DraftPilot Copilot Active</span>
            </div>
          </div>
        </div>

        {/* Dual Pane Layout: Gmail thread on left + DraftPilot Side Panel on right */}
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Left: Gmail Thread (7 cols) */}
          <div className="lg:col-span-7 bg-bg/90 rounded-2xl border border-border/80 p-5 space-y-4 shadow-inner">
            {/* Customer Message */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan to-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                SC
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-text">Sarah Connor</span>
                  <span className="text-[10px] text-text-dim">10:42 AM</span>
                </div>
                <div className="text-xs text-text-muted leading-relaxed bg-elevated/40 p-3 rounded-xl border border-border/50">
                  <p className="font-medium text-text mb-1">Subject: Question regarding annual billing switch</p>
                  "Hi Team! We love using the platform. We currently have 5 seats on the monthly plan, but want to switch to annual billing for the team discount. How does the prorated switch work?"
                </div>
              </div>
            </div>

            {/* Gmail Active Reply Box */}
            <div className={`mt-4 rounded-xl border p-4 transition-all duration-500 ${
              activeStep >= 3 
                ? 'border-accent/80 bg-accent/5 shadow-[0_0_25px_rgba(124,58,237,0.15)]' 
                : 'border-border bg-elevated/20'
            }`}>
              <div className="flex items-center justify-between text-[11px] text-text-dim mb-2 pb-2 border-b border-border/40">
                <span>Reply to <strong className="text-text">Sarah Connor</strong></span>
                <span className="text-[10px] bg-border/50 px-2 py-0.5 rounded text-text-muted">Gmail Compose</span>
              </div>
              
              <div className="min-h-[110px] text-xs text-text leading-relaxed font-sans">
                {activeStep < 3 ? (
                  <span className="text-text-dim italic">
                    {activeStep === 0 && "Waiting for DraftPilot draft generation..."}
                    {activeStep === 1 && "Matching relevant macros..."}
                    {activeStep === 2 && "Draft ready in side panel. Click 'Insert into Reply'..."}
                  </span>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-2"
                  >
                    <p>Hi Sarah,</p>
                    <p>Thanks for reaching out! Switching your 5 seats to annual billing is straightforward. We apply an automatic <strong>20% discount</strong>, and your remaining monthly balance is immediately prorated as credit toward the annual plan.</p>
                    <p>You can make the switch directly under <strong>Settings &gt; Billing &gt; Plan</strong>, or let me know and I can apply it for you now!</p>
                    <p className="text-text-dim">Best regards,<br/>DraftPilot Support</p>
                  </motion.div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/40">
                <button className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow flex items-center gap-1.5">
                  <span>Send</span>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
                <span className="text-[10px] text-text-dim">Saved to Drafts</span>
              </div>
            </div>
          </div>

          {/* Right: DraftPilot Side Panel (5 cols) */}
          <div className="lg:col-span-5 bg-elevated/90 rounded-2xl border border-accent/40 p-4 shadow-[0_0_30px_rgba(124,58,237,0.1)] relative">
            {/* Side Panel Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/80">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-[10px] text-white font-bold">DP</div>
                <span className="text-xs font-bold text-text">DraftPilot Panel</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-medium">Online</span>
            </div>

            {/* Step 1: Thread Detected Badge */}
            <div className="bg-bg/80 rounded-xl p-3 border border-border mb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-text-dim font-medium">Detected Context:</span>
                <span className="text-[10px] text-success flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                  PII Scrubbed ✓
                </span>
              </div>
              <div className="text-[11px] text-text-muted truncate">
                "Sarah Connor ... switch to annual billing for team discount ..."
              </div>
            </div>

            {/* Step 2: Matched Macro */}
            <div className={`rounded-xl p-3 border transition-all duration-300 mb-3 ${
              activeStep >= 1 ? 'bg-accent/10 border-accent/40' : 'bg-bg/40 border-border/40 opacity-50'
            }`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-xs font-semibold text-text flex items-center gap-1.5">
                  <span>📚 Macro:</span>
                  <span className="text-accent">Annual Plan Upgrade</span>
                </span>
                <span className="text-[10px] bg-accent/20 text-accent-light px-1.5 py-0.5 rounded font-mono">98% Match</span>
              </div>
              <div className="text-[10px] text-text-dim">
                Includes 20% discount rate &amp; automatic proration formula.
              </div>
            </div>

            {/* Step 3 & 4: Generated Draft Box & Insert Action */}
            <div className={`rounded-xl p-3 border transition-all duration-300 ${
              activeStep >= 2 ? 'bg-bg border-accent/60 shadow-[0_0_15px_rgba(124,58,237,0.15)]' : 'bg-bg/40 border-border/40 opacity-40'
            }`}>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-text">Suggested Reply</span>
                <span className="text-[10px] text-text-dim">GPT-4o Mini (0.4s)</span>
              </div>

              <div className="text-[11px] text-text-muted leading-relaxed mb-3 max-h-28 overflow-hidden font-sans">
                "Hi Sarah, Thanks for reaching out! Switching your 5 seats to annual billing is straightforward. We apply an automatic 20% discount..."
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveStep(3)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    activeStep >= 3 
                      ? 'bg-success text-white' 
                      : 'bg-accent hover:bg-accent-hover text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]'
                  }`}
                >
                  {activeStep >= 3 ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Inserted into Gmail</span>
                    </>
                  ) : (
                    <>
                      <span>Insert into Reply</span>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Launch Full Interactive Sandbox Banner */}
        <div className="mt-6 pt-5 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 bg-elevated/30 -mx-4 -mb-4 md:-mx-8 md:-mb-8 p-4 md:p-6 rounded-b-3xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-sm font-bold">
              ✨
            </div>
            <div>
              <p className="text-xs font-bold text-text">Want to test other customer scenarios?</p>
              <p className="text-[11px] text-text-muted">
                Try Return/Refund, Shipping Inquiries, Password Resets &amp; Billing questions with live tone modulation.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsDemoModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_20px_rgba(124,58,237,0.4)] flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span>Launch Interactive Demo Mode</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* Interactive Try Demo Mode Modal */}
      <TryDemoModeModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
      />
    </div>
  );
}

export default InteractiveDemo;
