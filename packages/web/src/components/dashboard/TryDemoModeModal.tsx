'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DEMO_TICKETS,
  DEMO_MACROS,
  DemoTicket,
  DemoDraftResult,
  synthesizeDemoDraft,
  resolveDemoTicket,
} from '@/data/demo-data';

interface TryDemoModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTicketId?: string;
}

export default function TryDemoModeModal({
  isOpen,
  onClose,
  initialTicketId,
}: TryDemoModeModalProps) {
  const [selectedTicketId, setSelectedTicketId] = useState<string>(() => {
    return resolveDemoTicket(initialTicketId).id;
  });
  const [selectedTone, setSelectedTone] = useState<'empathetic' | 'concise' | 'formal' | 'urgent'>('empathetic');
  const [selectedMacroId, setSelectedMacroId] = useState<string | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [draftResult, setDraftResult] = useState<DemoDraftResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [inserted, setInserted] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const copiedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const insertedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  const currentTicket = DEMO_TICKETS.find((t) => t.id === selectedTicketId) || DEMO_TICKETS[0];

  // Sync and reset state when modal opens or initialTicketId changes
  useEffect(() => {
    if (isOpen) {
      const resolved = resolveDemoTicket(initialTicketId);
      setSelectedTicketId(resolved.id);
      setSelectedMacroId(undefined);
      setCopied(false);
      setInserted(false);
    } else {
      // Clear timers and reset pending generation when modal closes
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
        copiedTimeoutRef.current = null;
      }
      if (insertedTimeoutRef.current) {
        clearTimeout(insertedTimeoutRef.current);
        insertedTimeoutRef.current = null;
      }
      setIsGenerating(false);
    }
  }, [isOpen, initialTicketId]);

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      if (insertedTimeoutRef.current) clearTimeout(insertedTimeoutRef.current);
    };
  }, []);

  // Lock body scroll and manage accessible focus
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      previousActiveElementRef.current = document.activeElement;
    }

    const focusTimer = setTimeout(() => {
      modalContainerRef.current?.focus();
    }, 50);

    return () => {
      document.body.style.overflow = originalOverflow;
      clearTimeout(focusTimer);
      if (
        previousActiveElementRef.current &&
        typeof document !== 'undefined' &&
        document.contains(previousActiveElementRef.current)
      ) {
        previousActiveElementRef.current.focus?.();
      }
      previousActiveElementRef.current = null;
    };
  }, [isOpen]);

  // Helper to trigger generation with race condition prevention
  const handleGenerate = (ticket: DemoTicket, tone: string, macroId?: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsGenerating(true);
    setInserted(false);

    timerRef.current = setTimeout(() => {
      const result = synthesizeDemoDraft(ticket, tone, macroId);
      setDraftResult(result);
      setIsGenerating(false);
    }, 300);
  };

  // Generate draft when modal opens or ticket/tone changes
  useEffect(() => {
    if (isOpen) {
      handleGenerate(currentTicket, selectedTone, selectedMacroId);
    }
  }, [isOpen, selectedTicketId, selectedTone, selectedMacroId]);

  // Handle ESC key to close and Tab key focus trapping
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const container = modalContainerRef.current;
        if (!container) return;

        const focusable = container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (!focusable || focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !container.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !container.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const fallbackCopy = (text: string) => {
    if (typeof document === 'undefined') return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.setAttribute('aria-hidden', 'true');
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus?.();
      }
    } catch {
      // Ignore fallback copy errors
    }
  };

  const handleCopy = () => {
    if (draftResult) {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(draftResult.draft).catch(() => {
          fallbackCopy(draftResult.draft);
        });
      } else {
        fallbackCopy(draftResult.draft);
      }
      setCopied(true);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleInsert = () => {
    if (draftResult) {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(draftResult.draft).catch(() => {
          fallbackCopy(draftResult.draft);
        });
      } else {
        fallbackCopy(draftResult.draft);
      }
      setInserted(true);
      if (insertedTimeoutRef.current) clearTimeout(insertedTimeoutRef.current);
      insertedTimeoutRef.current = setTimeout(() => setInserted(false), 3000);
    }
  };

  // Highlight PII tokens in redacted text without stateful regex issues
  const isRedactedToken = (str: string) =>
    /^\[(?:CARD|EMAIL|TOKEN|SECRET|SSN|IP|PHONE|ADDRESS|CUSTOM)_REDACTED\]$/.test(str);

  const renderHighlightedRedaction = (text: string) => {
    const parts = text.split(/(\[(?:CARD|EMAIL|TOKEN|SECRET|SSN|IP|PHONE|ADDRESS|CUSTOM)_REDACTED\])/g);

    return parts.map((part, idx) => {
      if (isRedactedToken(part)) {
        return (
          <span
            key={idx}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 mx-0.5"
          >
            🔒 {part}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="demo-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto"
          onClick={onClose}
          data-testid="demo-modal-backdrop"
        >
          <motion.div
            ref={modalContainerRef}
            tabIndex={-1}
            key="demo-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-5xl rounded-3xl border border-border/80 bg-bg-card/95 shadow-2xl backdrop-blur-2xl flex flex-col max-h-[92vh] overflow-hidden focus:outline-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-modal-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border/80 bg-elevated/40 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-base sm:text-lg font-bold">
                  ✨
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 id="demo-modal-title" className="text-sm sm:text-base font-bold text-text">
                      Interactive Demo Mode
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                      Zero Auth Required
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-text-muted">
                    Test AI reply synthesis, real-time tone modulation, and client-side PII scrubbing on sample threads.
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-elevated hover:bg-border text-text-muted hover:text-text flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
                aria-label="Close demo modal"
              >
                ✕
              </button>
            </div>

            {/* Ticket Selector Bar */}
            <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-b border-border/60 bg-bg/50 flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
              <span className="text-xs font-semibold text-text-dim uppercase tracking-wider mr-1">
                Sample Tickets:
              </span>
              {DEMO_TICKETS.map((ticket) => {
                const isSelected = ticket.id === selectedTicketId;
                const icons: Record<string, string> = {
                  return_refund: '🛍️ Return / Refund',
                  shipping_status: '📦 Shipping Status',
                  password_reset: '🔐 Password Reset',
                  billing_question: '💳 Billing Question',
                };

                return (
                  <button
                    key={ticket.id}
                    onClick={() => {
                      setSelectedTicketId(ticket.id);
                      setSelectedMacroId(undefined);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-accent text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]'
                        : 'bg-elevated/70 text-text-muted hover:text-text hover:bg-elevated border border-border/60'
                    }`}
                  >
                    <span>{icons[ticket.category] || ticket.subject}</span>
                  </button>
                );
              })}
            </div>

            {/* Main Dual-Pane Body */}
            <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 overflow-y-auto">
            {/* Left Pane: Customer Thread & PII Scrubbing Details (6 cols) */}
            <div className="lg:col-span-6 space-y-5">
              {/* Customer Email Card */}
              <div className="rounded-2xl bg-bg/80 border border-border p-4 space-y-3 shadow-inner">
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-pink-500 flex items-center justify-center text-xs font-bold text-white">
                      {currentTicket.customerName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-text">{currentTicket.customerName}</h3>
                      <p className="text-[11px] text-text-dim">{currentTicket.customerEmail}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-text-dim">{currentTicket.thread[0]?.timestamp || 'Just now'}</span>
                </div>

                <div>
                  <p className="text-xs font-semibold text-text mb-1">{currentTicket.subject}</p>
                  <p className="text-xs text-text-muted leading-relaxed whitespace-pre-wrap">
                    {currentTicket.thread[0]?.body}
                  </p>
                </div>
              </div>

              {/* Privacy Scrubbing Callout */}
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 text-sm">🔒</span>
                    <h4 className="text-xs font-bold text-amber-300">
                      Real-Time Client-Side PII Scrubbing
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                    {draftResult?.scrubbedCount || 0} Entities Redacted
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  DraftPilot automatically identifies and scrubs customer credit cards, contact numbers, passwords, and sensitive identifiers before prompt dispatch.
                </p>

                {/* Redacted Preview */}
                <div className="mt-2 p-3 rounded-xl bg-black/40 border border-amber-500/20 text-[11px] text-text-muted leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {draftResult?.redactedThread ? (
                    renderHighlightedRedaction(draftResult.redactedThread)
                  ) : (
                    <span className="italic text-text-dim">Scrubbing thread...</span>
                  )}
                </div>

                <div className="pt-1 text-[10px] text-text-dim font-mono truncate">
                  Unscrubbed PII captured in memory: <span className="text-rose-400">{currentTicket.unredactedPiiSnippet}</span>
                </div>
              </div>

              {/* Controls: Tone & Macro selection */}
              <div className="rounded-2xl bg-elevated/40 border border-border p-4 space-y-4">
                {/* Tone Selector */}
                <div>
                  <label className="block text-xs font-bold text-text mb-2">
                    Select Response Tone:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['empathetic', 'concise', 'formal', 'urgent'] as const).map((t) => {
                      const isSelected = selectedTone === t;
                      const labels: Record<string, { name: string; desc: string }> = {
                        empathetic: { name: 'Empathetic', desc: 'Warm & caring' },
                        concise: { name: 'Concise', desc: 'Direct bullets' },
                        formal: { name: 'Formal', desc: 'Enterprise' },
                        urgent: { name: 'Urgent', desc: 'Escalated' },
                      };

                      return (
                        <button
                          key={t}
                          onClick={() => setSelectedTone(t)}
                          className={`p-2 rounded-xl text-left transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-accent/20 border-accent text-accent-light shadow-[0_0_12px_rgba(124,58,237,0.3)]'
                              : 'bg-bg/60 border-border/70 text-text-muted hover:border-border hover:text-text'
                          }`}
                        >
                          <p className="text-xs font-bold capitalize">{labels[t].name}</p>
                          <p className="text-[10px] opacity-75">{labels[t].desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Macro Selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-text">Apply Knowledge Macro:</label>
                    {selectedMacroId && (
                      <button
                        onClick={() => setSelectedMacroId(undefined)}
                        className="text-[10px] text-accent-light hover:underline cursor-pointer"
                      >
                        Clear Macro
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {DEMO_MACROS.map((macro) => {
                      const isSelected = selectedMacroId === macro.id;
                      return (
                        <button
                          key={macro.id}
                          onClick={() => setSelectedMacroId(isSelected ? undefined : macro.id)}
                          className={`p-2 rounded-xl text-left text-xs transition-all border cursor-pointer ${
                            isSelected
                              ? 'bg-accent/20 border-accent text-accent-light'
                              : 'bg-bg/60 border-border/70 text-text-muted hover:border-border hover:text-text'
                          }`}
                        >
                          <p className="font-semibold truncate">📚 {macro.name}</p>
                          <p className="text-[10px] text-text-dim truncate">{macro.category} • {macro.usage_count} uses</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Regenerate Action */}
                <button
                  onClick={() => handleGenerate(currentTicket, selectedTone, selectedMacroId)}
                  disabled={isGenerating}
                  className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-[0_0_20px_rgba(124,58,237,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Synthesizing Draft...</span>
                    </>
                  ) : (
                    <>
                      <span>✨ Synthesize AI Draft</span>
                      <span className="text-[10px] opacity-75">(~0.3s)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Pane: AI-Synthesized Reply & Actions (6 cols) */}
            <div className="lg:col-span-6 flex flex-col space-y-4">
              {/* Draft Header & Telemetry */}
              <div className="rounded-2xl bg-elevated/70 border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-xs font-bold text-white">
                      DP
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-text">DraftPilot AI Composer</h4>
                      <p className="text-[10px] text-text-dim">Simulated Gmail Integration</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {draftResult && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold font-mono">
                        ⚡ {draftResult.generationTimeMs}ms
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-accent/20 border border-accent/40 text-accent-light text-[10px] font-bold capitalize">
                      {selectedTone}
                    </span>
                  </div>
                </div>

                {/* Badges Bar */}
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-bg border border-border text-text-muted flex items-center gap-1">
                    <span>🛡️ Zero PII Retention</span>
                  </span>
                  {selectedMacroId && (
                    <span className="px-2 py-0.5 rounded bg-bg border border-accent/30 text-accent-light flex items-center gap-1">
                      <span>📚 Macro Injected</span>
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-bg border border-border text-emerald-400 flex items-center gap-1">
                    <span>✓ Grounded Local Model</span>
                  </span>
                </div>
              </div>

              {/* Draft Content Box */}
              <div className="flex-1 min-h-[280px] rounded-2xl bg-bg/90 border border-border/80 p-4 sm:p-5 shadow-inner flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[11px] text-text-dim pb-2.5 mb-3 border-b border-border/50">
                    <span>
                      Reply to: <strong className="text-text">{currentTicket.customerName}</strong>
                    </span>
                    <span>Ready to insert</span>
                  </div>

                  {isGenerating ? (
                    <div className="h-48 flex flex-col items-center justify-center gap-3 text-text-muted text-xs">
                      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      <span>Synthesizing smart draft in {selectedTone} tone...</span>
                    </div>
                  ) : (
                    <div className="text-xs text-text leading-relaxed whitespace-pre-wrap font-sans">
                      {draftResult?.draft}
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-border/50 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleCopy}
                      disabled={isGenerating || !draftResult}
                      className="px-3.5 py-1.5 rounded-xl bg-elevated hover:bg-border border border-border text-xs font-semibold text-text transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {copied ? (
                        <>
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <span>📋</span>
                          <span>Copy Reply</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleInsert}
                      disabled={isGenerating || !draftResult}
                      className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        inserted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                      }`}
                    >
                      {inserted ? (
                        <>
                          <span>✓</span>
                          <span>Inserted into Gmail!</span>
                        </>
                      ) : (
                        <>
                          <span>✉️</span>
                          <span>Insert into Gmail</span>
                        </>
                      )}
                    </button>
                  </div>

                  <span className="text-[10px] text-text-dim">
                    Drafted by DraftPilot
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer CTA with Responsive Stacking for narrow mobile viewports */}
          <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-t border-border/80 bg-elevated/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shrink-0">
            <p className="text-text-muted">
              Ready to use DraftPilot with your live Gmail inbox?
            </p>
            <div className="flex items-center justify-end gap-2.5 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none text-center px-4 py-1.5 rounded-xl bg-bg border border-border hover:border-border-hover text-text font-medium cursor-pointer"
              >
                Close Demo
              </button>
              <a
                href="/join"
                className="flex-1 sm:flex-none text-center px-4 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)]"
              >
                Get Started Free →
              </a>
            </div>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
  );
}
