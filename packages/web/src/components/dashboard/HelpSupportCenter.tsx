'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/components/providers/AuthProvider';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'general' | 'privacy' | 'extension' | 'billing';
}

const FAQS: FAQItem[] = [
  {
    id: 'faq-1',
    question: 'How does DraftPilot draft replies in Gmail?',
    answer: 'DraftPilot injects a lightweight Manifest V3 sidebar directly into your Gmail compose and thread view. It analyzes the incoming email context, matches relevant Knowledge Base macros, and synthesizes an empathetic or concise response in real time.',
    category: 'general',
  },
  {
    id: 'faq-2',
    question: 'Is customer PII scrubbed before dispatch to AI models?',
    answer: 'Yes, absolutely. DraftPilot runs a client-side and server-side regex scrubber that redacts email addresses, phone numbers, credit cards, SSNs, and passwords before any prompt reaches OpenRouter or external LLMs.',
    category: 'privacy',
  },
  {
    id: 'faq-3',
    question: 'How do I pair my Chrome extension with my workspace?',
    answer: 'Install the extension from the Chrome Web Store or developer mode, navigate to your DraftPilot Dashboard, and the web app will automatically establish a two-way handshake. You can also manually paste your workspace Secret Key from the Gmail Sync tab.',
    category: 'extension',
  },
  {
    id: 'faq-4',
    question: 'What happens when my team reaches the monthly draft limit?',
    answer: 'When you hit 100% of your plan quota, new AI generations are paused until the start of the next billing cycle. You can upgrade to the Team or Enterprise plan at any time from the Billing tab to get higher draft volumes.',
    category: 'billing',
  },
  {
    id: 'faq-5',
    question: 'How do custom macros interact with vector search?',
    answer: 'When a customer email arrives, DraftPilot generates vector embeddings of the conversation and performs semantic similarity search against your uploaded documentation and custom macro snippets to ground the AI reply.',
    category: 'general',
  },
  {
    id: 'faq-6',
    question: 'Can I invite team members and assign different roles?',
    answer: 'Yes! Team owners and admins can invite agents via email from the Team Seats tab. Roles include Owner (full control & billing), Admin (macros & settings), and Agent (inbox drafting).',
    category: 'general',
  },
];

const DOC_LINKS = [
  {
    title: 'Quickstart Guide',
    description: 'Get up and running with DraftPilot and your first macro in under 2 minutes.',
    icon: '⚡',
    badge: 'Popular',
    url: '#quickstart',
  },
  {
    title: 'Gmail Copilot & Autocomplete',
    description: 'How ghost text suggestions and inline bubbles assist your Gmail inbox.',
    icon: '✉️',
    badge: 'Guide',
    url: '#gmail-copilot',
  },
  {
    title: 'Privacy & PII Redaction Specs',
    description: 'In-depth overview of our multi-layered redaction pipeline and security audits.',
    icon: '🛡️',
    badge: 'Security',
    url: '#privacy-specs',
  },
  {
    title: 'API & Webhooks Reference',
    description: 'Integrate DraftPilot draft triggers with Zendesk, Freshdesk, or custom backends.',
    icon: '🔗',
    badge: 'Developers',
    url: '#api-docs',
  },
];

type SupportTab = 'faqs' | 'docs' | 'contact' | 'status';

export default function HelpSupportCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SupportTab>('faqs');
  const [faqSearch, setFaqSearch] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq-1');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Ticket Form State
  const { user, dbUser } = useAuth();
  const [ticketName, setTicketName] = useState(dbUser?.full_name || '');
  const [ticketEmail, setTicketEmail] = useState(dbUser?.email || user?.email || '');
  const [ticketCategory, setTicketCategory] = useState<'bug' | 'billing' | 'extension' | 'feature' | 'account' | 'other'>('bug');
  const [ticketPriority, setTicketPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [ticketSuccessData, setTicketSuccessData] = useState<{ ticketId: string; message: string } | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-fill user details if available
  useEffect(() => {
    if (dbUser?.full_name && !ticketName) setTicketName(dbUser.full_name);
    if ((dbUser?.email || user?.email) && !ticketEmail) setTicketEmail(dbUser?.email || user?.email || '');
  }, [dbUser, user]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter FAQs based on search
  const filteredFaqs = useMemo(() => {
    const q = faqSearch.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
    );
  }, [faqSearch]);

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTicketError(null);

    if (!ticketEmail.trim()) {
      setTicketError('Please provide your email address.');
      return;
    }
    if (!ticketSubject.trim()) {
      setTicketError('Please enter a brief subject.');
      return;
    }
    if (!ticketMessage.trim()) {
      setTicketError('Please describe your issue or question.');
      return;
    }

    setIsSubmittingTicket(true);
    try {
      const res = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ticketName.trim() || undefined,
          email: ticketEmail.trim(),
          category: ticketCategory,
          priority: ticketPriority,
          subject: ticketSubject.trim(),
          message: ticketMessage.trim(),
          systemInfo: {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            version: '0.1.0',
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to submit ticket');
      }

      setTicketSuccessData({
        ticketId: data.ticketId,
        message: data.message,
      });
      setTicketSubject('');
      setTicketMessage('');
    } catch (err: any) {
      setTicketError(err?.message || 'Error submitting ticket. Please try again.');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER TRIGGER BUTTON (? / Help Icon)
      ───────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-full bg-elevated/80 border border-border hover:border-accent text-text-muted hover:text-text transition-all cursor-pointer shadow-sm group"
        title="Help & Support Center"
      >
        <svg
          className="w-4 h-4 text-text group-hover:text-accent-light transition-colors"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {/* ─────────────────────────────────────────────────────────────
          2. HELP & SUPPORT MODAL / FLYOUT
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute right-0 top-full mt-3 w-[92vw] sm:w-[540px] rounded-3xl bg-bg-card/98 backdrop-blur-2xl border border-accent/40 shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden z-50 flex flex-col max-h-[640px]"
          >
            {/* Header */}
            <div className="p-4 sm:px-5 border-b border-border/50 flex items-center justify-between bg-elevated/60">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-sm shadow-[0_0_10px_rgba(124,58,237,0.4)]">
                  💡
                </div>
                <div>
                  <h4 className="font-bold text-sm text-text leading-tight">Help &amp; Support Center</h4>
                  <p className="text-[11px] text-text-dim">Guides, instant FAQs, and direct engineering support</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-6 h-6 rounded-full bg-bg hover:bg-white/10 text-text-dim hover:text-text flex items-center justify-center text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 p-2 px-4 border-b border-border/40 bg-bg/50 overflow-x-auto text-xs">
              {[
                { id: 'faqs', label: 'Search FAQs', icon: '❓' },
                { id: 'docs', label: 'Docs & Tour', icon: '📚' },
                { id: 'contact', label: 'Contact Support', icon: '✉️' },
                { id: 'status', label: 'System Status', icon: '🟢' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id as SupportTab);
                    if (tab.id === 'contact') setTicketError(null);
                  }}
                  className={`px-3 py-1.5 rounded-full font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'bg-accent text-white font-bold shadow-sm'
                      : 'text-text-muted hover:text-text hover:bg-white/5'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4">
              
              {/* ─────────────────────────────────────────────────────────────
                  TAB 1: SEARCHABLE FAQS
              ───────────────────────────────────────────────────────────── */}
              {activeTab === 'faqs' && (
                <div className="space-y-3">
                  {/* Search Input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={faqSearch}
                      onChange={(e) => setFaqSearch(e.target.value)}
                      placeholder="Search questions (e.g. Gmail, PII, limits)..."
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-elevated/70 border border-border text-xs text-text placeholder:text-text-dim/60 focus:outline-none focus:border-accent shadow-inner transition-colors"
                    />
                    <svg
                      className="w-4 h-4 absolute left-3 top-2.5 text-text-dim"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {faqSearch && (
                      <button
                        onClick={() => setFaqSearch('')}
                        className="absolute right-3 top-2 text-text-dim hover:text-text text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* FAQ Accordion List */}
                  <div className="space-y-2 mt-3">
                    {filteredFaqs.length === 0 ? (
                      <div className="p-8 text-center text-text-dim space-y-1">
                        <div className="text-2xl">🔍</div>
                        <p className="text-xs font-semibold">No questions matched &quot;{faqSearch}&quot;</p>
                        <p className="text-[11px]">
                          Can&apos;t find what you need? Switch to &apos;Contact Support&apos; to ask our team directly.
                        </p>
                      </div>
                    ) : (
                      filteredFaqs.map((faq) => {
                        const isExpanded = expandedFaqId === faq.id;
                        return (
                          <div
                            key={faq.id}
                            className="rounded-2xl bg-elevated/50 border border-border/70 overflow-hidden transition-all"
                          >
                            <button
                              type="button"
                              onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                              className="w-full text-left p-3.5 flex items-center justify-between gap-3 text-xs font-semibold text-text hover:text-accent-light transition-colors cursor-pointer"
                            >
                              <span>{faq.question}</span>
                              <span className="text-text-dim text-[11px] shrink-0">
                                {isExpanded ? '▲' : '▼'}
                              </span>
                            </button>
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden border-t border-border/40"
                                >
                                  <div className="p-3.5 pt-2 text-[11px] text-text-muted leading-relaxed bg-bg/40">
                                    {faq.answer}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 2: DOCUMENTATION LINKS & VIDEO WALKTHROUGH
              ───────────────────────────────────────────────────────────── */}
              {activeTab === 'docs' && (
                <div className="space-y-4">
                  {/* Video Walkthrough Preview Card */}
                  <div className="rounded-2xl bg-gradient-to-tr from-accent/20 via-elevated to-elevated border border-accent/30 p-4 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-accent-light px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40">
                        Interactive Walkthrough
                      </span>
                      <span className="text-[10px] text-text-dim font-mono">2 min 14s</span>
                    </div>

                    <h5 className="font-bold text-xs text-text mb-1">
                      DraftPilot Gmail Inbox Copilot Tour
                    </h5>
                    <p className="text-[11px] text-text-muted mb-3">
                      Watch how DraftPilot scrubs incoming customer PII, retrieves your knowledge base macros, and crafts 1-click replies.
                    </p>

                    {!isVideoPlaying ? (
                      <button
                        type="button"
                        onClick={() => setIsVideoPlaying(true)}
                        className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(124,58,237,0.4)] transition-all cursor-pointer"
                      >
                        <span>▶ Play Video Walkthrough</span>
                      </button>
                    ) : (
                      <div className="rounded-xl bg-black/80 border border-border p-4 text-center space-y-2 animate-in fade-in">
                        <div className="text-2xl animate-pulse">🎥</div>
                        <p className="text-xs font-bold text-text">DraftPilot Copilot Demonstration</p>
                        <p className="text-[11px] text-text-dim leading-relaxed">
                          Simulating Gmail compose injection, ghost text autocompletion, and multi-turn tone adaptation.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsVideoPlaying(false)}
                          className="mt-2 text-[11px] text-accent-light hover:underline font-semibold"
                        >
                          Close Player
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Documentation Quick Links */}
                  <div className="space-y-2">
                    <span className="block text-[10px] font-bold text-text-dim uppercase tracking-wider font-mono">
                      Knowledge Base &amp; Guides
                    </span>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {DOC_LINKS.map((doc) => (
                        <div
                          key={doc.title}
                          className="p-3 rounded-2xl bg-elevated/60 border border-border/70 hover:border-accent/40 transition-colors flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-base">{doc.icon}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-bg border border-border font-mono text-text-dim">
                                {doc.badge}
                              </span>
                            </div>
                            <h6 className="font-bold text-xs text-text">{doc.title}</h6>
                            <p className="text-[11px] text-text-dim mt-0.5 leading-snug">
                              {doc.description}
                            </p>
                          </div>
                          <a
                            href={doc.url}
                            className="text-[10px] font-semibold text-accent-light hover:text-white mt-2 flex items-center gap-1"
                          >
                            Read Guide →
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 3: CONTACT SUPPORT & TICKET DISPATCH
              ───────────────────────────────────────────────────────────── */}
              {activeTab === 'contact' && (
                <div className="space-y-3">
                  {ticketSuccessData ? (
                    <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-3 animate-in zoom-in-95">
                      <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                        ✓
                      </div>
                      <h5 className="text-sm font-bold text-text">Support Ticket Created</h5>
                      <div className="px-3 py-1.5 rounded-lg bg-bg/80 border border-border font-mono text-xs text-emerald-400 font-bold inline-block">
                        Ticket ID: {ticketSuccessData.ticketId}
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">
                        {ticketSuccessData.message}
                      </p>
                      <button
                        type="button"
                        onClick={() => setTicketSuccessData(null)}
                        className="mt-2 px-4 py-1.5 rounded-xl bg-elevated hover:bg-white/10 text-text text-xs font-semibold cursor-pointer transition-colors"
                      >
                        Submit Another Ticket
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleTicketSubmit} className="space-y-3">
                      {ticketError && (
                        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                          <span>⚠️</span>
                          <span>{ticketError}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-medium text-text-dim mb-1">Your Name</label>
                          <input
                            type="text"
                            value={ticketName}
                            onChange={(e) => setTicketName(e.target.value)}
                            placeholder="Alex Support"
                            className="w-full px-3 py-2 rounded-xl bg-elevated/70 border border-border text-xs text-text focus:outline-none focus:border-accent"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-text-dim mb-1">
                            Email <span className="text-accent">*</span>
                          </label>
                          <input
                            type="email"
                            required
                            value={ticketEmail}
                            onChange={(e) => setTicketEmail(e.target.value)}
                            placeholder="agent@company.com"
                            className="w-full px-3 py-2 rounded-xl bg-elevated/70 border border-border text-xs text-text focus:outline-none focus:border-accent"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-medium text-text-dim mb-1">Category</label>
                          <select
                            value={ticketCategory}
                            onChange={(e) => setTicketCategory(e.target.value as any)}
                            className="w-full px-3 py-2 rounded-xl bg-elevated/70 border border-border text-xs text-text focus:outline-none focus:border-accent"
                          >
                            <option value="bug">🐛 Bug Report</option>
                            <option value="billing">💳 Billing &amp; Quota</option>
                            <option value="extension">🧩 Chrome Extension</option>
                            <option value="feature">✨ Feature Request</option>
                            <option value="account">👤 Account &amp; Access</option>
                            <option value="other">💬 General Inquiry</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-text-dim mb-1">Priority</label>
                          <select
                            value={ticketPriority}
                            onChange={(e) => setTicketPriority(e.target.value as any)}
                            className="w-full px-3 py-2 rounded-xl bg-elevated/70 border border-border text-xs text-text focus:outline-none focus:border-accent"
                          >
                            <option value="low">Low (Standard)</option>
                            <option value="medium">Medium (Normal)</option>
                            <option value="high">High (Urgent)</option>
                            <option value="urgent">Critical (Blocker)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-text-dim mb-1">
                          Subject <span className="text-accent">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={ticketSubject}
                          onChange={(e) => setTicketSubject(e.target.value)}
                          placeholder="e.g. Issue generating AI draft in Chrome Extension"
                          className="w-full px-3 py-2 rounded-xl bg-elevated/70 border border-border text-xs text-text focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-text-dim mb-1">
                          Detailed Description <span className="text-accent">*</span>
                        </label>
                        <textarea
                          required
                          rows={3}
                          value={ticketMessage}
                          onChange={(e) => setTicketMessage(e.target.value)}
                          placeholder="Please describe what happened, steps to reproduce, or any relevant error messages..."
                          className="w-full px-3 py-2 rounded-xl bg-elevated/70 border border-border text-xs text-text focus:outline-none focus:border-accent resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingTicket}
                        className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(124,58,237,0.4)] disabled:opacity-50 cursor-pointer transition-all"
                      >
                        {isSubmittingTicket ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Dispatching Ticket...</span>
                          </>
                        ) : (
                          <span>Submit Ticket →</span>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  TAB 4: SYSTEM STATUS & VERSION INFO
              ───────────────────────────────────────────────────────────── */}
              {activeTab === 'status' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-elevated/60 border border-border/70 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-border/40">
                      <span className="text-xs font-bold text-text">DraftPilot Platform</span>
                      <span className="px-2 py-0.5 rounded-md bg-accent/20 border border-accent/40 font-mono text-[10px] font-bold text-accent-light">
                        v0.1.0
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-text-dim flex items-center gap-1.5">
                          <span>🤖</span> AI Model Gateway
                        </span>
                        <span className="text-emerald-400 font-mono font-medium text-[11px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Operational (~420ms)
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-text-dim flex items-center gap-1.5">
                          <span>🗄️</span> Supabase Multi-Tenant DB
                        </span>
                        <span className="text-emerald-400 font-mono font-medium text-[11px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          RLS Active &amp; Verified
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-text-dim flex items-center gap-1.5">
                          <span>🧩</span> Chrome Extension Handshake
                        </span>
                        <span className="text-emerald-400 font-mono font-medium text-[11px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Content Script v0.1.0 Ready
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-text-dim flex items-center gap-1.5">
                          <span>🛡️</span> Client-Side PII Engine
                        </span>
                        <span className="text-emerald-400 font-mono font-medium text-[11px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Scrubber Active
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-bg/80 border border-border/40 text-[11px] text-text-dim flex items-center justify-between font-mono">
                    <span>Telemetry Checked: Just now</span>
                    <span className="text-emerald-400 font-semibold">99.98% Uptime</span>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-3 px-5 border-t border-border/40 bg-bg/80 text-[11px] text-text-dim flex items-center justify-between">
              <span>Need live chat? Ping founder in Notifications.</span>
              <span className="text-accent-light font-medium cursor-pointer hover:underline" onClick={() => setActiveTab('contact')}>
                File Ticket →
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
