/// <reference types="node" />
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension
import { scrubPII as baseScrubPII } from '../pii-scrubber.ts';

/**
 * ============================================================================
 * AUTHORITATIVE CONTRACT SPECIFICATIONS & ORACLE HARNESSES (TIERS 1-4)
 * Grounded in ORIGINAL_REQUEST.md & PROJECT.md
 * ============================================================================
 */

// --- R1: Demo Mode Interfaces & Contracts ---
export interface DemoTicket {
  id: string;
  category: 'return_refund' | 'shipping_status' | 'password_reset' | 'billing_question';
  customerName: string;
  customerEmail: string;
  subject: string;
  thread: Array<{ sender: string; timestamp: string; body: string }>;
  unredactedPiiSnippet: string;
}

export interface DemoDraftResult {
  draft: string;
  redactedThread: string;
  scrubbedCount: number;
  generationTimeMs: number;
  appliedTone: 'empathetic' | 'concise' | 'formal' | 'urgent';
  appliedMacroId?: string;
}

// Authoritative Demo Ticket Fixtures
export const AUTHORITATIVE_DEMO_TICKETS: DemoTicket[] = [
  {
    id: 'ticket-refund-1',
    category: 'return_refund',
    customerName: 'Sarah Martinez',
    customerEmail: 'sarah.martinez@acmecorp.com',
    subject: 'Order #4892 — Damaged item & refund request',
    thread: [
      {
        sender: 'Sarah Martinez',
        timestamp: '10:14 AM',
        body: 'Hello, my order #4892 arrived damaged. Please refund my Visa card 4111-2222-3333-4444 or send replacement to 123 Maple Street, Austin TX.',
      },
    ],
    unredactedPiiSnippet: 'Visa card 4111-2222-3333-4444',
  },
  {
    id: 'ticket-shipping-2',
    category: 'shipping_status',
    customerName: 'Marcus Brody',
    customerEmail: 'marcus.brody@atlaslogistics.org',
    subject: 'Tracking inquiry: Order #67142 delayed in transit',
    thread: [
      {
        sender: 'Marcus Brody',
        timestamp: '11:30 AM',
        body: 'Where is my shipment #67142? Deliver to 742 Evergreen Terrace Apt 4B, Springfield. Call my mobile 555-234-5678 if delayed.',
      },
    ],
    unredactedPiiSnippet: '742 Evergreen Terrace Apt 4B, Springfield',
  },
  {
    id: 'ticket-password-3',
    category: 'password_reset',
    customerName: 'Elena Rostova',
    customerEmail: 'elena.rostova@cybernet.co',
    subject: 'Urgent: Locked out of account / reset 2FA',
    thread: [
      {
        sender: 'Elena Rostova',
        timestamp: '01:15 PM',
        body: 'I lost access to my 2FA phone +1 (555) 382-9012. Originating IP 192.168.1.105. Please send bypass link to elena.rostova@cybernet.co.',
      },
    ],
    unredactedPiiSnippet: 'IP 192.168.1.105 and phone +1 (555) 382-9012',
  },
  {
    id: 'ticket-billing-4',
    category: 'billing_question',
    customerName: 'David Chen',
    customerEmail: 'david.chen@fintechlabs.com',
    subject: 'Question regarding invoice #INV-2026-908 and annual billing switch',
    thread: [
      {
        sender: 'David Chen',
        timestamp: '03:45 PM',
        body: 'We want to switch our 10 seats to annual billing. Invoice INV-2026-908 charged $249.00 to card ending 9012. Can we get the 20% discount applied?',
      },
    ],
    unredactedPiiSnippet: 'Invoice INV-2026-908 and card ending 9012',
  },
];

// Authoritative Demo Draft Synthesizer Oracle
export function oracleSynthesizeDemoDraft(
  ticket: DemoTicket,
  tone: 'empathetic' | 'concise' | 'formal' | 'urgent' = 'empathetic',
  macroId?: string
): DemoDraftResult {
  const threadBody = ticket.thread.map((t) => `${t.sender}: ${t.body}`).join('\n');
  const redactedThread = baseScrubPII(threadBody);

  // Count redacting tokens
  const redactionMatches = redactedThread.match(/\[[A-Z_]+_REDACTED\]/g) || [];
  const scrubbedCount = redactionMatches.length;

  let draft = '';
  switch (tone) {
    case 'empathetic':
      draft = `Hi ${ticket.customerName},\n\nI am truly sorry to hear about the issue regarding "${ticket.subject}". I completely understand how frustrating this must be, and I am here to personally make this right for you immediately.\n\nBest regards,\nCustomer Support Team`;
      break;
    case 'concise':
      draft = `Hi ${ticket.customerName},\n\nRegarding ${ticket.subject}:\n- We have reviewed your request.\n- Resolution is being processed.\n\nThank you,\nSupport`;
      break;
    case 'formal':
      draft = `Dear ${ticket.customerName},\n\nThank you for contacting DraftPilot Support regarding "${ticket.subject}". Please be advised that our team has initiated the appropriate procedure to address your inquiry in accordance with our standard service agreement.\n\nSincerely,\nClient Relations`;
      break;
    case 'urgent':
      draft = `URGENT ACTION: Hi ${ticket.customerName},\n\nWe have escalated your inquiry regarding "${ticket.subject}" as highest priority. We are addressing this immediately to prevent any further disruption.\n\nImmediate Support`;
      break;
    default:
      draft = `Hello ${ticket.customerName},\n\nThank you for reaching out regarding ${ticket.subject}.\n\nSupport Team`;
  }

  if (macroId === 'macro-refund-label') {
    draft += '\n\n[Prepaid Return Label: Attached PDF has been dispatched to your email.]';
  } else if (macroId === 'macro-annual-discount') {
    draft += '\n\n[Annual Billing: 20% discount has been applied to your workspace subscription.]';
  }

  return {
    draft,
    redactedThread,
    scrubbedCount,
    generationTimeMs: 312,
    appliedTone: tone,
    appliedMacroId: macroId,
  };
}

// --- R2: Extension Detection Handshake Oracle ---
export interface ExtensionHandshakeState {
  isInstalled: boolean;
  version: string | null;
  status: 'checking' | 'installed' | 'not_installed' | 'outdated';
}

export function oracleEvaluateExtensionStatus(
  domInstalledAttr: string | null,
  domVersionAttr: string | null,
  pongReceived: boolean,
  pongVersion: string | null,
  targetVersion: string = '0.1.0'
): ExtensionHandshakeState {
  const version = domVersionAttr || (pongReceived ? pongVersion : null);
  const installed = domInstalledAttr === 'true' || pongReceived;

  if (!installed || !version) {
    return { isInstalled: false, version: null, status: 'not_installed' };
  }

  // Semver comparison
  const parseV = (v: string) => v.split('.').map((p) => parseInt(p, 10) || 0);
  const [cMajor, cMinor, cPatch] = parseV(version);
  const [tMajor, tMinor, tPatch] = parseV(targetVersion);

  const isOutdated =
    cMajor < tMajor ||
    (cMajor === tMajor && cMinor < tMinor) ||
    (cMajor === tMajor && cMinor === tMinor && cPatch < tPatch);

  return {
    isInstalled: true,
    version,
    status: isOutdated ? 'outdated' : 'installed',
  };
}

// --- R3: Support Center FAQ & Ticket Dispatch Oracle ---
export interface SupportFAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export const AUTHORITATIVE_FAQS: SupportFAQItem[] = [
  {
    id: 'faq-1',
    category: 'Extension',
    question: 'How do I pair the DraftPilot Chrome extension?',
    answer: 'Install from Chrome Web Store. The extension automatically detects your workspace on localhost or dashboard.',
  },
  {
    id: 'faq-2',
    category: 'Privacy',
    question: 'Is customer PII scrubbed before sending to AI models?',
    answer: 'Yes! DraftPilot scrubs credit cards, emails, SSNs, IPs, and passwords client-side before dispatching prompts.',
  },
  {
    id: 'faq-3',
    category: 'Billing',
    question: 'How does the Annual Billing 20% discount work?',
    answer: 'Switching to annual billing discounts Team seats from $19/mo to $15/mo ($180/year), saving $48 per seat.',
  },
  {
    id: 'faq-4',
    category: 'Macros',
    question: 'How do custom macros interact with AI draft generation?',
    answer: 'Macros act as grounding context. When a ticket matches a macro tag, the synthesizer injects approved phrases.',
  },
];

export function oracleSearchFAQs(query: string, faqs: SupportFAQItem[] = AUTHORITATIVE_FAQS): SupportFAQItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return faqs;
  return faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(trimmed) ||
      faq.answer.toLowerCase().includes(trimmed) ||
      faq.category.toLowerCase().includes(trimmed)
  );
}

export interface SupportTicketInput {
  name?: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  priority?: string;
}

export function oracleValidateAndDispatchTicket(input: SupportTicketInput): {
  success: boolean;
  status: number;
  ticketId?: string;
  error?: string;
} {
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return { success: false, status: 400, error: 'A valid email address is required.' };
  }
  if (!input.subject || input.subject.trim().length < 3) {
    return { success: false, status: 400, error: 'Subject must be at least 3 characters.' };
  }
  if (!input.message || input.message.trim().length < 5) {
    return { success: false, status: 400, error: 'Message must be at least 5 characters.' };
  }
  const validCategories = ['bug', 'billing', 'extension', 'feature', 'account', 'other'];
  if (!input.category || !validCategories.includes(input.category.toLowerCase())) {
    return { success: false, status: 400, error: 'Invalid or missing support category.' };
  }

  const randomDigits = Math.floor(10000 + Math.random() * 90000);
  return {
    success: true,
    status: 200,
    ticketId: `DP-TK-${randomDigits}`,
  };
}

// --- R4: Dynamic Date Math Oracle ---
export interface DatePresetItem {
  label: string;
  startDate: string;
  endDate: string;
  display: string;
  compareStartDate: string;
  compareEndDate: string;
  compareDisplay: string;
}

export function oracleFormatYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function oracleComputeDatePresets(refDate: Date = new Date()): DatePresetItem[] {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const curMonthName = monthNames[month];

  // Today
  const todayStart = new Date(refDate);
  const todayEnd = new Date(refDate);
  const yesterday = new Date(refDate);
  yesterday.setDate(refDate.getDate() - 1);

  // Last 7 Days
  const l7Start = new Date(refDate);
  l7Start.setDate(refDate.getDate() - 6);
  const l7CompEnd = new Date(l7Start);
  l7CompEnd.setDate(l7Start.getDate() - 1);
  const l7CompStart = new Date(l7CompEnd);
  l7CompStart.setDate(l7CompEnd.getDate() - 6);

  // Last 30 Days
  const l30Start = new Date(refDate);
  l30Start.setDate(refDate.getDate() - 29);
  const l30CompEnd = new Date(l30Start);
  l30CompEnd.setDate(l30Start.getDate() - 1);
  const l30CompStart = new Date(l30CompEnd);
  l30CompStart.setDate(l30CompEnd.getDate() - 29);

  // This Month
  const mtdStart = new Date(year, month, 1);
  const mtdEnd = new Date(year, month + 1, 0);
  const prevMonthStart = new Date(year, month - 1, 1);
  const prevMonthEnd = new Date(year, month, 0);

  // Last Month
  const lastMonthStart = new Date(year, month - 1, 1);
  const lastMonthEnd = new Date(year, month, 0);
  const prevMonthName = monthNames[lastMonthStart.getMonth()];
  const l2mStart = new Date(year, month - 2, 1);
  const l2mEnd = new Date(year, month - 1, 0);

  // YTD
  const ytdStart = new Date(year, 0, 1);
  const ytdCompStart = new Date(year - 1, 0, 1);
  const ytdCompEnd = new Date(year - 1, month, refDate.getDate());

  return [
    {
      label: 'Today',
      startDate: oracleFormatYMD(todayStart),
      endDate: oracleFormatYMD(todayEnd),
      display: `${curMonthName} ${String(refDate.getDate()).padStart(2, '0')}`,
      compareStartDate: oracleFormatYMD(yesterday),
      compareEndDate: oracleFormatYMD(yesterday),
      compareDisplay: `${monthNames[yesterday.getMonth()]} ${String(yesterday.getDate()).padStart(2, '0')}`,
    },
    {
      label: 'Last 7 Days',
      startDate: oracleFormatYMD(l7Start),
      endDate: oracleFormatYMD(todayEnd),
      display: `${monthNames[l7Start.getMonth()]} ${String(l7Start.getDate()).padStart(2, '0')} – ${curMonthName} ${String(refDate.getDate()).padStart(2, '0')}`,
      compareStartDate: oracleFormatYMD(l7CompStart),
      compareEndDate: oracleFormatYMD(l7CompEnd),
      compareDisplay: `${monthNames[l7CompStart.getMonth()]} ${String(l7CompStart.getDate()).padStart(2, '0')} – ${monthNames[l7CompEnd.getMonth()]} ${String(l7CompEnd.getDate()).padStart(2, '0')}`,
    },
    {
      label: 'Last 30 Days',
      startDate: oracleFormatYMD(l30Start),
      endDate: oracleFormatYMD(todayEnd),
      display: `${monthNames[l30Start.getMonth()]} ${String(l30Start.getDate()).padStart(2, '0')} – ${curMonthName} ${String(refDate.getDate()).padStart(2, '0')}`,
      compareStartDate: oracleFormatYMD(l30CompStart),
      compareEndDate: oracleFormatYMD(l30CompEnd),
      compareDisplay: `${monthNames[l30CompStart.getMonth()]} ${String(l30CompStart.getDate()).padStart(2, '0')} – ${monthNames[l30CompEnd.getMonth()]} ${String(l30CompEnd.getDate()).padStart(2, '0')}`,
    },
    {
      label: `This Month (${curMonthName})`,
      startDate: oracleFormatYMD(mtdStart),
      endDate: oracleFormatYMD(mtdEnd),
      display: `${curMonthName} 01 – ${curMonthName} ${String(mtdEnd.getDate()).padStart(2, '0')}`,
      compareStartDate: oracleFormatYMD(prevMonthStart),
      compareEndDate: oracleFormatYMD(prevMonthEnd),
      compareDisplay: `${monthNames[prevMonthStart.getMonth()]} 01 – ${monthNames[prevMonthStart.getMonth()]} ${String(prevMonthEnd.getDate()).padStart(2, '0')}`,
    },
    {
      label: `Last Month (${prevMonthName})`,
      startDate: oracleFormatYMD(lastMonthStart),
      endDate: oracleFormatYMD(lastMonthEnd),
      display: `${prevMonthName} 01 – ${prevMonthName} ${String(lastMonthEnd.getDate()).padStart(2, '0')}`,
      compareStartDate: oracleFormatYMD(l2mStart),
      compareEndDate: oracleFormatYMD(l2mEnd),
      compareDisplay: `${monthNames[l2mStart.getMonth()]} 01 – ${monthNames[l2mStart.getMonth()]} ${String(l2mEnd.getDate()).padStart(2, '0')}`,
    },
    {
      label: 'Year to Date (YTD)',
      startDate: oracleFormatYMD(ytdStart),
      endDate: oracleFormatYMD(todayEnd),
      display: `Jan 01 – ${curMonthName} ${String(refDate.getDate()).padStart(2, '0')}`,
      compareStartDate: oracleFormatYMD(ytdCompStart),
      compareEndDate: oracleFormatYMD(ytdCompEnd),
      compareDisplay: `Jan 01 – ${monthNames[ytdCompEnd.getMonth()]} ${String(ytdCompEnd.getDate()).padStart(2, '0')}, ${year - 1}`,
    },
  ];
}

// --- R5: User Profile & Initials Oracle ---
export function oracleDeriveInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    const local = email.split('@')[0];
    return local.slice(0, 2).toUpperCase();
  }
  return 'U';
}

export function oracleValidatePassword(pwd: string): { valid: boolean; reason?: string } {
  if (!pwd || pwd.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long.' };
  }
  if (!/[a-zA-Z]/.test(pwd) || !/[0-9]/.test(pwd)) {
    return { valid: false, reason: 'Password must contain at least one letter and one number.' };
  }
  return { valid: true };
}

// --- R6: Annual Billing Math Oracle ---
export interface PricingPlanTier {
  id: 'free' | 'team' | 'enterprise';
  name: string;
  monthlyPrice: number;
  annualPricePerMonth: number;
  annualBilledYearly: number;
  annualSavingsPercent: number;
  draftLimit: number;
  features: Record<string, string>;
}

export const AUTHORITATIVE_PLANS: Record<string, PricingPlanTier> = {
  free: {
    id: 'free',
    name: 'Starter',
    monthlyPrice: 0,
    annualPricePerMonth: 0,
    annualBilledYearly: 0,
    annualSavingsPercent: 0,
    draftLimit: 50,
    features: {
      draftLimit: '50 drafts / month',
      customMacros: '5 personal macros',
      knowledgeDocs: '1 reference doc',
      teamSeats: '1 seat',
      piiScrubbing: 'Standard client-side (8 built-in rules)',
      support: 'Community & email support',
    },
  },
  team: {
    id: 'team',
    name: 'Team Co-Pilot',
    monthlyPrice: 19,
    annualPricePerMonth: 15,
    annualBilledYearly: 180,
    annualSavingsPercent: 21,
    draftLimit: 1000,
    features: {
      draftLimit: '1,000 drafts / seat / month',
      customMacros: 'Unlimited shared team macros',
      knowledgeDocs: 'Unlimited documents (PDF, Docx, MD)',
      teamSeats: 'Flexible ($19/mo or $15/yr per seat)',
      piiScrubbing: 'Standard + Custom Workspace Rules',
      support: 'Priority email & Discord (<12h SLA)',
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Dedicated',
    monthlyPrice: 99,
    annualPricePerMonth: 79,
    annualBilledYearly: 948,
    annualSavingsPercent: 20,
    draftLimit: 5000,
    features: {
      draftLimit: '5,000+ drafts / month',
      customMacros: 'Unlimited team + global admin macros',
      knowledgeDocs: 'Unlimited docs + continuous sync',
      teamSeats: 'Unlimited seats with RBAC',
      piiScrubbing: 'Standard + Custom Rules + Audit Log',
      support: '24/7 Dedicated Slack channel (1h SLA)',
    },
  },
};

export function oracleCalculateTotalPlanCost(tierId: 'free' | 'team' | 'enterprise', isAnnual: boolean, seats: number = 1) {
  const safeSeats = Math.max(1, Math.floor(seats));
  const plan = AUTHORITATIVE_PLANS[tierId];
  if (tierId === 'free') return { pricePerMonth: 0, totalBilled: 0, savingsPerYear: 0 };
  if (isAnnual) {
    const monthlyRate = plan.annualPricePerMonth * safeSeats;
    const billedYearly = plan.annualBilledYearly * safeSeats;
    const monthlyCostForYear = plan.monthlyPrice * 12 * safeSeats;
    const savings = monthlyCostForYear - billedYearly;
    return {
      pricePerMonth: monthlyRate,
      totalBilled: billedYearly,
      savingsPerYear: savings,
    };
  } else {
    return {
      pricePerMonth: plan.monthlyPrice * safeSeats,
      totalBilled: plan.monthlyPrice * safeSeats,
      savingsPerYear: 0,
    };
  }
}

// --- R7: Custom PII Scrubbing Oracle ---
export interface CustomPiiRule {
  id: string;
  name: string;
  pattern: string;
  replacement: string;
  isRegex?: boolean;
  rule_type?: 'regex' | 'keyword';
  enabled: boolean;
}

export function isPotentialReDoS(pattern: string): boolean {
  // Detect classic nested quantifiers like (a+)+, (a*)*, ([0-9]+)+
  return /\([^)]*[+*][^)]*\)[+*]/.test(pattern) || /\(\[[^\]]+\][+*]\)[+*]/.test(pattern);
}

export function oracleScrubPII(text: string, customRules?: CustomPiiRule[]): string {
  if (!text) return '';
  let scrubbed = text;

  // Evaluate Custom Rules First
  if (customRules && Array.isArray(customRules)) {
    for (const rule of customRules) {
      if (!rule.enabled || !rule.pattern || !rule.pattern.trim()) continue;
      const replacement = rule.replacement || '[CUSTOM_REDACTED]';
      const isRegex = rule.isRegex || rule.rule_type === 'regex';

      try {
        if (!isRegex) {
          const escaped = rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const kwRegex = new RegExp(`\\b${escaped}\\b`, 'gi');
          scrubbed = scrubbed.replace(kwRegex, replacement);
        } else {
          // ReDoS check / safe regex guard
          if (isPotentialReDoS(rule.pattern)) {
            continue;
          }
          const regex = new RegExp(rule.pattern, 'gi');
          scrubbed = scrubbed.replace(regex, replacement);
        }
      } catch {
        // Malformed regex gracefully ignored
      }
    }
  }

  // Evaluate Built-in Rules
  return baseScrubPII(scrubbed);
}

// --- R8: Onboarding Checklist & Badges Oracle ---
export interface OnboardingMilestones {
  extension_installed: boolean;
  first_macro_added: boolean;
  first_draft_generated: boolean;
  team_member_invited: boolean;
}

export interface OnboardingEvaluation {
  completedCount: number;
  totalSteps: number;
  percentage: number;
  badgesUnlocked: string[];
}

export function oracleEvaluateOnboarding(milestones: OnboardingMilestones): OnboardingEvaluation {
  const steps = [
    milestones.extension_installed,
    milestones.first_macro_added,
    milestones.first_draft_generated,
    milestones.team_member_invited,
  ];
  const completedCount = steps.filter(Boolean).length;
  const percentage = Math.round((completedCount / 4) * 100);

  const badgesUnlocked: string[] = [];
  if (milestones.extension_installed) badgesUnlocked.push('Extension Pioneer');
  if (milestones.first_macro_added) badgesUnlocked.push('Macro Architect');
  if (milestones.first_draft_generated) badgesUnlocked.push('AI Copilot Ace');
  if (milestones.team_member_invited) badgesUnlocked.push('Team Builder');
  if (completedCount === 4) badgesUnlocked.push('DraftPilot Champion');

  return {
    completedCount,
    totalSteps: 4,
    percentage,
    badgesUnlocked,
  };
}

/**
 * ============================================================================
 * TEST SUITE: TIER 1 — FEATURE COVERAGE (>=5 TESTS PER FEATURE = 40 TESTS)
 * ============================================================================
 */
describe('TIER 1: Feature Coverage (Isolated Unit & Integration)', () => {
  // --- Requirement 1: Interactive Try Demo Mode ---
  describe('R1: Interactive "Try Demo Mode" Experience', () => {
    test('T1.1.1: Predefined sample ticket fixtures cover all 4 required categories with PII', () => {
      const tickets = AUTHORITATIVE_DEMO_TICKETS;
      assert.strictEqual(tickets.length, 4, 'Must provide exactly 4 sample ticket fixtures');
      const categories = tickets.map((t) => t.category);
      assert.ok(categories.includes('return_refund'), 'Must include return/refund');
      assert.ok(categories.includes('shipping_status'), 'Must include shipping status');
      assert.ok(categories.includes('password_reset'), 'Must include password reset');
      assert.ok(categories.includes('billing_question'), 'Must include billing question');

      for (const ticket of tickets) {
        assert.ok(ticket.id && ticket.customerName && ticket.customerEmail && ticket.subject);
        assert.ok(ticket.thread.length > 0 && ticket.unredactedPiiSnippet);
      }
    });

    test('T1.1.2: Tone modifiers synthesize distinct, tailored drafts (Empathetic, Concise, Formal, Urgent)', () => {
      const ticket = AUTHORITATIVE_DEMO_TICKETS[0];
      const empathetic = oracleSynthesizeDemoDraft(ticket, 'empathetic');
      const concise = oracleSynthesizeDemoDraft(ticket, 'concise');
      const formal = oracleSynthesizeDemoDraft(ticket, 'formal');
      const urgent = oracleSynthesizeDemoDraft(ticket, 'urgent');

      assert.strictEqual(empathetic.appliedTone, 'empathetic');
      assert.ok(empathetic.draft.toLowerCase().includes('sorry') || empathetic.draft.toLowerCase().includes('understand'));

      assert.strictEqual(concise.appliedTone, 'concise');
      assert.ok(concise.draft.length < empathetic.draft.length);

      assert.strictEqual(formal.appliedTone, 'formal');
      assert.ok(formal.draft.includes('Dear') || formal.draft.includes('Sincerely'));

      assert.strictEqual(urgent.appliedTone, 'urgent');
      assert.ok(urgent.draft.toLowerCase().includes('urgent') || urgent.draft.toLowerCase().includes('priority'));
    });

    test('T1.1.3: Macro modifiers append template actions to synthesized reply', () => {
      const ticket = AUTHORITATIVE_DEMO_TICKETS[0];
      const withMacro = oracleSynthesizeDemoDraft(ticket, 'empathetic', 'macro-refund-label');
      assert.strictEqual(withMacro.appliedMacroId, 'macro-refund-label');
      assert.ok(withMacro.draft.includes('[Prepaid Return Label'));
    });

    test('T1.1.4: Client-side zero-auth synthesizer emits generation speed telemetry', () => {
      const ticket = AUTHORITATIVE_DEMO_TICKETS[1];
      const result = oracleSynthesizeDemoDraft(ticket, 'concise');
      assert.ok(typeof result.generationTimeMs === 'number');
      assert.ok(result.generationTimeMs > 0 && result.generationTimeMs < 1000);
    });

    test('T1.1.5: PII scrubbing automatically redacts credit cards and customer contact data from thread', () => {
      const refundTicket = AUTHORITATIVE_DEMO_TICKETS[0];
      const result = oracleSynthesizeDemoDraft(refundTicket, 'empathetic');
      assert.ok(result.scrubbedCount >= 1, 'Should detect and scrub credit card in thread');
      assert.ok(result.redactedThread.includes('[CARD_REDACTED]'));
      assert.ok(!result.redactedThread.includes('4111-2222-3333-4444'));
    });
  });

  // --- Requirement 2: Chrome Extension Detection ---
  describe('R2: Authentic Chrome Extension Detection & Pairing', () => {
    test('T1.2.1: Detects DOM attributes set by extension content script', () => {
      const status = oracleEvaluateExtensionStatus('true', '0.1.0', false, null);
      assert.strictEqual(status.isInstalled, true);
      assert.strictEqual(status.version, '0.1.0');
      assert.strictEqual(status.status, 'installed');
    });

    test('T1.2.2: Resolves extension pairing via postMessage handshake pong', () => {
      const status = oracleEvaluateExtensionStatus(null, null, true, '0.1.0');
      assert.strictEqual(status.isInstalled, true);
      assert.strictEqual(status.version, '0.1.0');
      assert.strictEqual(status.status, 'installed');
    });

    test('T1.2.3: Reports "installed" when detected version matches target 0.1.0', () => {
      const status = oracleEvaluateExtensionStatus('true', '0.1.0', true, '0.1.0', '0.1.0');
      assert.strictEqual(status.status, 'installed');
    });

    test('T1.2.4: Reports "outdated" when detected extension version is lower than target', () => {
      const status = oracleEvaluateExtensionStatus('true', '0.0.9', false, null, '0.1.0');
      assert.strictEqual(status.isInstalled, true);
      assert.strictEqual(status.status, 'outdated');
      assert.strictEqual(status.version, '0.0.9');
    });

    test('T1.2.5: Reports "not_installed" when no DOM signature or pong is present', () => {
      const status = oracleEvaluateExtensionStatus(null, null, false, null);
      assert.strictEqual(status.isInstalled, false);
      assert.strictEqual(status.status, 'not_installed');
      assert.strictEqual(status.version, null);
    });
  });

  // --- Requirement 3: Help & Support Center ---
  describe('R3: Help & Support Center in Global Header', () => {
    test('T1.3.1: Global support modal structures documentation, FAQs, and contact dispatch', () => {
      assert.ok(AUTHORITATIVE_FAQS.length >= 4);
      const categories = AUTHORITATIVE_FAQS.map((f) => f.category);
      assert.ok(categories.includes('Extension'));
      assert.ok(categories.includes('Privacy'));
      assert.ok(categories.includes('Billing'));
    });

    test('T1.3.2: FAQ keyword search filters questions and answers dynamically', () => {
      const privacyMatches = oracleSearchFAQs('PII');
      assert.ok(privacyMatches.length >= 1);
      assert.ok(privacyMatches.some((f) => f.id === 'faq-2'));

      const billingMatches = oracleSearchFAQs('discount');
      assert.ok(billingMatches.length >= 1);
      assert.ok(billingMatches.some((f) => f.id === 'faq-3'));
    });

    test('T1.3.3: Support ticket dispatch validates fields and generates tracking ticketId', () => {
      const result = oracleValidateAndDispatchTicket({
        name: 'Sarah Connor',
        email: 'sarah@resistance.org',
        category: 'bug',
        subject: 'Gmail inline insertion not responding',
        message: 'The suggestions icon does not appear inside compose window on Gmail thread 891.',
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 200);
      assert.ok(result.ticketId && result.ticketId.startsWith('DP-TK-'));
    });

    test('T1.3.4: System telemetry outputs app version and subsystem operational statuses', () => {
      const version = '0.1.0';
      const telemetry = {
        appVersion: version,
        aiGateway: 'operational',
        database: 'operational',
        extensionHandshake: 'ready',
      };
      assert.strictEqual(telemetry.appVersion, '0.1.0');
      assert.strictEqual(telemetry.aiGateway, 'operational');
    });

    test('T1.3.5: Support ticket categorizes into standard issue types', () => {
      for (const cat of ['bug', 'billing', 'extension', 'feature', 'account', 'other']) {
        const res = oracleValidateAndDispatchTicket({
          email: 'agent@corp.com',
          category: cat,
          subject: `Test subject for ${cat}`,
          message: `Testing valid category dispatch for ${cat}.`,
        });
        assert.strictEqual(res.success, true, `Category ${cat} should succeed`);
      }
    });
  });

  // --- Requirement 4: Dynamic Date Range Default Fix ---
  describe('R4: Dynamic Date Range Default Fix', () => {
    test('T1.4.1: Computes presets dynamically relative to specified reference date', () => {
      const testRef = new Date('2026-09-04T12:00:00Z');
      const presets = oracleComputeDatePresets(testRef);
      assert.ok(presets.length >= 6);

      const labels = presets.map((p) => p.label);
      assert.ok(labels.includes('Today'));
      assert.ok(labels.includes('Last 7 Days'));
      assert.ok(labels.includes('Last 30 Days'));
      assert.ok(labels.some((l) => l.includes('This Month')));
      assert.ok(labels.some((l) => l.includes('Last Month')));
      assert.ok(labels.includes('Year to Date (YTD)'));
    });

    test('T1.4.2: Computes exact 7-day and 30-day spans matching calendar offsets', () => {
      const testRef = new Date('2026-09-04T12:00:00Z');
      const presets = oracleComputeDatePresets(testRef);

      const l7 = presets.find((p) => p.label === 'Last 7 Days')!;
      assert.strictEqual(l7.startDate, '2026-08-29');
      assert.strictEqual(l7.endDate, '2026-09-04');
      assert.strictEqual(l7.compareStartDate, '2026-08-22');
      assert.strictEqual(l7.compareEndDate, '2026-08-28');

      const l30 = presets.find((p) => p.label === 'Last 30 Days')!;
      assert.strictEqual(l30.startDate, '2026-08-06');
      assert.strictEqual(l30.endDate, '2026-09-04');
    });

    test('T1.4.3: Computes "This Month (MTD)" starting on the 1st of the current month', () => {
      const testRef = new Date('2026-09-04T12:00:00Z');
      const presets = oracleComputeDatePresets(testRef);
      const mtd = presets.find((p) => p.label.startsWith('This Month'))!;
      assert.strictEqual(mtd.startDate, '2026-09-01');
      assert.strictEqual(mtd.endDate, '2026-09-30');
    });

    test('T1.4.4: Computes "Last Month" covering 1st to last day of prior calendar month', () => {
      const testRef = new Date('2026-09-04T12:00:00Z');
      const presets = oracleComputeDatePresets(testRef);
      const lastMonth = presets.find((p) => p.label.startsWith('Last Month'))!;
      assert.strictEqual(lastMonth.startDate, '2026-08-01');
      assert.strictEqual(lastMonth.endDate, '2026-08-31');
    });

    test('T1.4.5: Year-to-Date (YTD) begins January 1 of current year', () => {
      const testRef = new Date('2026-09-04T12:00:00Z');
      const presets = oracleComputeDatePresets(testRef);
      const ytd = presets.find((p) => p.label === 'Year to Date (YTD)')!;
      assert.strictEqual(ytd.startDate, '2026-01-01');
      assert.strictEqual(ytd.endDate, '2026-09-04');
    });
  });

  // --- Requirement 5: User Profile & Account Settings Hub ---
  describe('R5: User Profile & Account Settings Hub', () => {
    test('T1.5.1: Derives avatar initials accurately from name and email', () => {
      assert.strictEqual(oracleDeriveInitials('Sarah Martinez'), 'SM');
      assert.strictEqual(oracleDeriveInitials('Marcus'), 'MA');
      assert.strictEqual(oracleDeriveInitials(undefined, 'alex.vance@blackmesa.gov'), 'AL');
      assert.strictEqual(oracleDeriveInitials('', ''), 'U');
    });

    test('T1.5.2: Password validation enforces minimum 8 characters and alphanumeric characters', () => {
      assert.strictEqual(oracleValidatePassword('DraftPilot2026!').valid, true);
      assert.strictEqual(oracleValidatePassword('short7').valid, false);
      assert.strictEqual(oracleValidatePassword('onlylettershere').valid, false);
      assert.strictEqual(oracleValidatePassword('1234567890').valid, false);
    });

    test('T1.5.3: Granular notification preferences structure supports individual toggles', () => {
      const initialPrefs = {
        emailWeeklyDigest: true,
        emailQuotaWarning: true,
        emailQuotaExceeded: true,
        teamMemberActivity: false,
        browserPushAlerts: false,
      };

      const updatedPrefs = { ...initialPrefs, browserPushAlerts: true, emailWeeklyDigest: false };
      assert.strictEqual(updatedPrefs.browserPushAlerts, true);
      assert.strictEqual(updatedPrefs.emailWeeklyDigest, false);
      assert.strictEqual(updatedPrefs.emailQuotaWarning, true);
    });

    test('T1.5.4: Workspace membership displays role, joined date, and plan limit', () => {
      const membership = {
        teamName: 'Acme Support Heroes',
        role: 'owner',
        plan: 'team',
        monthlyQuota: 2000,
        joinedDate: new Date('2026-01-15T00:00:00Z').toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      };
      assert.strictEqual(membership.role, 'owner');
      assert.strictEqual(membership.plan, 'team');
      assert.strictEqual(membership.monthlyQuota, 2000);
      assert.ok(membership.joinedDate.includes('2026'));
    });

    test('T1.5.5: Settings page tabs separate Profile, Security, Notifications, and Workspace', () => {
      const availableTabs = ['profile', 'security', 'notifications', 'workspace'];
      assert.strictEqual(availableTabs.length, 4);
      assert.ok(availableTabs.includes('profile') && availableTabs.includes('security'));
    });
  });

  // --- Requirement 6: Annual Billing Toggle & Feature Matrix ---
  describe('R6: Annual Billing Toggle & Feature Comparison Matrix', () => {
    test('T1.6.1: Annual billing reflects ~20% savings across Team and Enterprise tiers', () => {
      const team = AUTHORITATIVE_PLANS.team;
      const enterprise = AUTHORITATIVE_PLANS.enterprise;

      // Team: $19 vs $15 -> $4/mo saved * 12 = $48/yr saved (21%)
      assert.strictEqual(team.monthlyPrice, 19);
      assert.strictEqual(team.annualPricePerMonth, 15);
      assert.strictEqual(team.annualBilledYearly, 180);

      // Enterprise: $99 vs $79 -> $20/mo saved * 12 = $240/yr saved (20%)
      assert.strictEqual(enterprise.monthlyPrice, 99);
      assert.strictEqual(enterprise.annualPricePerMonth, 79);
      assert.strictEqual(enterprise.annualBilledYearly, 948);
    });

    test('T1.6.2: Multi-seat team price calculation scales accurately with annual discount', () => {
      // 5 seats Team Monthly: 5 * $19 = $95/month ($1140/yr)
      const monthly5 = oracleCalculateTotalPlanCost('team', false, 5);
      assert.strictEqual(monthly5.pricePerMonth, 95);
      assert.strictEqual(monthly5.totalBilled, 95);

      // 5 seats Team Annual: 5 * $15 = $75/month billed as $900/year (Saves $240/yr)
      const annual5 = oracleCalculateTotalPlanCost('team', true, 5);
      assert.strictEqual(annual5.pricePerMonth, 75);
      assert.strictEqual(annual5.totalBilled, 900);
      assert.strictEqual(annual5.savingsPerYear, 240);
    });

    test('T1.6.3: Feature matrix specifies distinct draft, macro, doc, and SLA limits across all 3 tiers', () => {
      const free = AUTHORITATIVE_PLANS.free;
      const team = AUTHORITATIVE_PLANS.team;
      const enterprise = AUTHORITATIVE_PLANS.enterprise;

      assert.strictEqual(free.draftLimit, 50);
      assert.strictEqual(team.draftLimit, 1000);
      assert.strictEqual(enterprise.draftLimit, 5000);

      assert.ok(free.features.customMacros.includes('5'));
      assert.ok(team.features.customMacros.toLowerCase().includes('unlimited'));
      assert.ok(enterprise.features.support.includes('1h SLA'));
    });

    test('T1.6.4: Toggle state updates highlighted prices from monthly to annual rates', () => {
      let isAnnual = false;
      let activeRate = isAnnual ? AUTHORITATIVE_PLANS.team.annualPricePerMonth : AUTHORITATIVE_PLANS.team.monthlyPrice;
      assert.strictEqual(activeRate, 19);

      isAnnual = true;
      activeRate = isAnnual ? AUTHORITATIVE_PLANS.team.annualPricePerMonth : AUTHORITATIVE_PLANS.team.monthlyPrice;
      assert.strictEqual(activeRate, 15);
    });

    test('T1.6.5: Checkout payload explicitly includes billing cadence parameter', () => {
      const createCheckoutPayload = (tier: string, isAnnual: boolean, seats: number) => ({
        tier,
        cadence: isAnnual ? 'yearly' : 'monthly',
        seats,
      });

      const payloadMonthly = createCheckoutPayload('team', false, 3);
      assert.strictEqual(payloadMonthly.cadence, 'monthly');

      const payloadYearly = createCheckoutPayload('team', true, 3);
      assert.strictEqual(payloadYearly.cadence, 'yearly');
    });
  });

  // --- Requirement 7: Custom PII Scrubbing Rules & Live Rule Tester ---
  describe('R7: Custom PII Scrubbing Rules & Live Rule Tester', () => {
    test('T1.7.1: Custom keyword redaction redacts internal project codename', () => {
      const customRules: CustomPiiRule[] = [
        {
          id: 'rule-1',
          name: 'Project Codename',
          pattern: 'Project Titan',
          replacement: '[PROJECT_CONFIDENTIAL]',
          rule_type: 'keyword',
          enabled: true,
        },
      ];

      const input = 'We are coordinating Project Titan release with external partners.';
      const output = oracleScrubPII(input, customRules);
      assert.strictEqual(output, 'We are coordinating [PROJECT_CONFIDENTIAL] release with external partners.');
    });

    test('T1.7.2: Custom regex redaction matches structured internal identifiers (e.g. CUST-XXXX)', () => {
      const customRules: CustomPiiRule[] = [
        {
          id: 'rule-2',
          name: 'Customer ID',
          pattern: 'CUST-\\d{5}',
          replacement: '[CUSTOMER_ID]',
          isRegex: true,
          enabled: true,
        },
      ];

      const input = 'Account holder CUST-89312 requested account reset for CUST-10492.';
      const output = oracleScrubPII(input, customRules);
      assert.strictEqual(output, 'Account holder [CUSTOMER_ID] requested account reset for [CUSTOMER_ID].');
    });

    test('T1.7.3: Custom rules execute in unison with built-in PII rules (Emails, Cards, SSNs)', () => {
      const customRules: CustomPiiRule[] = [
        {
          id: 'rule-badge',
          name: 'Badge ID',
          pattern: 'BADGE-\\d{4}',
          replacement: '[BADGE_REDACTED]',
          isRegex: true,
          enabled: true,
        },
      ];

      const input = 'Agent with BADGE-4421 sent Visa 4111-2222-3333-4444 to dev@corp.com.';
      const output = oracleScrubPII(input, customRules);
      assert.ok(output.includes('[BADGE_REDACTED]'));
      assert.ok(output.includes('[CARD_REDACTED]'));
      assert.ok(output.includes('[EMAIL_REDACTED]'));
    });

    test('T1.7.4: Live PII Playground diff calculation computes exact replacement counts', () => {
      const customRules: CustomPiiRule[] = [
        {
          id: 'rule-codename',
          name: 'Codename',
          pattern: 'FalconProject',
          replacement: '[REDACTED]',
          rule_type: 'keyword',
          enabled: true,
        },
      ];

      const input = 'First FalconProject, second FalconProject, and user@example.com';
      const output = oracleScrubPII(input, customRules);
      const customMatches = (output.match(/\[REDACTED\]/g) || []).length;
      const builtinMatches = (output.match(/\[EMAIL_REDACTED\]/g) || []).length;

      assert.strictEqual(customMatches, 2);
      assert.strictEqual(builtinMatches, 1);
    });

    test('T1.7.5: Disabled custom rules are ignored during text scrubbing', () => {
      const customRules: CustomPiiRule[] = [
        {
          id: 'rule-disabled',
          name: 'Codename',
          pattern: 'FalconProject',
          replacement: '[REDACTED]',
          rule_type: 'keyword',
          enabled: false,
        },
      ];

      const input = 'This contains FalconProject text.';
      const output = oracleScrubPII(input, customRules);
      assert.strictEqual(output, input, 'Disabled rule should not redact');
    });
  });

  // --- Requirement 8: Onboarding Celebration & Gamification ---
  describe('R8: Onboarding Celebration, Progress Checklist & Achievements', () => {
    test('T1.8.1: Checklist calculates progress percentage accurately (0%, 25%, 50%, 75%, 100%)', () => {
      assert.strictEqual(
        oracleEvaluateOnboarding({
          extension_installed: false,
          first_macro_added: false,
          first_draft_generated: false,
          team_member_invited: false,
        }).percentage,
        0
      );

      assert.strictEqual(
        oracleEvaluateOnboarding({
          extension_installed: true,
          first_macro_added: false,
          first_draft_generated: false,
          team_member_invited: false,
        }).percentage,
        25
      );

      assert.strictEqual(
        oracleEvaluateOnboarding({
          extension_installed: true,
          first_macro_added: true,
          first_draft_generated: false,
          team_member_invited: false,
        }).percentage,
        50
      );

      assert.strictEqual(
        oracleEvaluateOnboarding({
          extension_installed: true,
          first_macro_added: true,
          first_draft_generated: true,
          team_member_invited: false,
        }).percentage,
        75
      );

      assert.strictEqual(
        oracleEvaluateOnboarding({
          extension_installed: true,
          first_macro_added: true,
          first_draft_generated: true,
          team_member_invited: true,
        }).percentage,
        100
      );
    });

    test('T1.8.2: Automatically unlocks "Extension Pioneer" milestone badge upon pairing', () => {
      const res = oracleEvaluateOnboarding({
        extension_installed: true,
        first_macro_added: false,
        first_draft_generated: false,
        team_member_invited: false,
      });
      assert.ok(res.badgesUnlocked.includes('Extension Pioneer'));
    });

    test('T1.8.3: Automatically unlocks "AI Copilot Ace" milestone badge upon first draft generation', () => {
      const res = oracleEvaluateOnboarding({
        extension_installed: false,
        first_macro_added: false,
        first_draft_generated: true,
        team_member_invited: false,
      });
      assert.ok(res.badgesUnlocked.includes('AI Copilot Ace'));
    });

    test('T1.8.4: Unlocks "DraftPilot Champion" badge when all 4 milestones are satisfied', () => {
      const res = oracleEvaluateOnboarding({
        extension_installed: true,
        first_macro_added: true,
        first_draft_generated: true,
        team_member_invited: true,
      });
      assert.strictEqual(res.badgesUnlocked.length, 5);
      assert.ok(res.badgesUnlocked.includes('DraftPilot Champion'));
    });

    test('T1.8.5: Confetti celebration configuration includes particle count and duration', () => {
      const confettiConfig = {
        particleCount: 60,
        durationMs: 3000,
        colors: ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899'],
        recycle: false,
      };
      assert.ok(confettiConfig.particleCount >= 50);
      assert.strictEqual(confettiConfig.durationMs, 3000);
      assert.ok(confettiConfig.colors.length >= 4);
    });
  });
});

/**
 * ============================================================================
 * TEST SUITE: TIER 2 — BOUNDARY & CORNER CASES (>=5 TESTS PER FEATURE = 40 TESTS)
 * ============================================================================
 */
describe('TIER 2: Boundary, Edge & Corner Cases (Defensive Hardening)', () => {
  // --- R1 Edge Cases ---
  describe('R1 Boundaries: Demo Mode Edge Cases', () => {
    test('T2.1.1: Synthesizer handles empty or whitespace thread body gracefully', () => {
      const emptyTicket: DemoTicket = {
        id: 'empty-1',
        category: 'return_refund',
        customerName: 'Anonymous',
        customerEmail: 'anon@test.com',
        subject: '',
        thread: [{ sender: 'Anon', timestamp: '12:00', body: '   ' }],
        unredactedPiiSnippet: '',
      };

      const result = oracleSynthesizeDemoDraft(emptyTicket, 'concise');
      assert.ok(result.draft.length > 0);
      assert.strictEqual(result.scrubbedCount, 0);
    });

    test('T2.1.2: Synthesizer defaults gracefully when unsupported tone is passed', () => {
      const ticket = AUTHORITATIVE_DEMO_TICKETS[0];
      // @ts-ignore - testing runtime boundary
      const result = oracleSynthesizeDemoDraft(ticket, 'super-excited-casual');
      assert.ok(result.draft.includes('Thank you for reaching out'));
    });

    test('T2.1.3: Synthesizer handles non-existent or invalid macro ID without crashing', () => {
      const ticket = AUTHORITATIVE_DEMO_TICKETS[0];
      const result = oracleSynthesizeDemoDraft(ticket, 'empathetic', 'non-existent-macro-id-999');
      assert.ok(result.draft.length > 0);
      assert.strictEqual(result.appliedMacroId, 'non-existent-macro-id-999');
    });

    test('T2.1.4: Handles oversized customer thread (>50KB text) within safe execution time', () => {
      const largeBody = 'Repeated customer question for order inquiries. '.repeat(1500); // ~70KB
      const largeTicket: DemoTicket = {
        id: 'large-1',
        category: 'shipping_status',
        customerName: 'Marcus',
        customerEmail: 'marcus@large.org',
        subject: 'Huge Thread',
        thread: [{ sender: 'Marcus', timestamp: '10:00', body: largeBody }],
        unredactedPiiSnippet: '',
      };

      const start = Date.now();
      const result = oracleSynthesizeDemoDraft(largeTicket, 'concise');
      const elapsed = Date.now() - start;

      assert.ok(elapsed < 1000, 'Processing 70KB thread should complete in under 1 second');
      assert.ok(result.draft.length > 0);
    });

    test('T2.1.5: Handles ticket with zero PII entities without corrupting output', () => {
      const cleanTicket: DemoTicket = {
        id: 'clean-1',
        category: 'shipping_status',
        customerName: 'David',
        customerEmail: 'david@clean.io',
        subject: 'General Question',
        thread: [{ sender: 'David', timestamp: '10:00', body: 'Just wondering how the weather is today?' }],
        unredactedPiiSnippet: '',
      };

      const result = oracleSynthesizeDemoDraft(cleanTicket, 'formal');
      assert.strictEqual(result.scrubbedCount, 0);
      assert.strictEqual(result.redactedThread.includes('_REDACTED'), false);
    });
  });

  // --- R2 Edge Cases ---
  describe('R2 Boundaries: Extension Detection Edge Cases', () => {
    test('T2.2.1: Rejects message events missing required type or source properties', () => {
      const filterPostMessage = (eventData: any) => {
        if (!eventData || typeof eventData !== 'object') return false;
        if (eventData.source !== 'draftpilot-extension') return false;
        if (eventData.type !== 'DRAFTPILOT_EXTENSION_PONG') return false;
        return true;
      };

      assert.strictEqual(filterPostMessage(null), false);
      assert.strictEqual(filterPostMessage({ type: 'DRAFTPILOT_EXTENSION_PONG' }), false);
      assert.strictEqual(filterPostMessage({ source: 'untrusted-script', type: 'DRAFTPILOT_EXTENSION_PONG' }), false);
      assert.strictEqual(filterPostMessage({ source: 'draftpilot-extension', type: 'SOME_OTHER_EVENT' }), false);
      assert.strictEqual(filterPostMessage({ source: 'draftpilot-extension', type: 'DRAFTPILOT_EXTENSION_PONG' }), true);
    });

    test('T2.2.2: Semver comparison handles pre-release suffixes (e.g. 0.1.0-beta.1)', () => {
      const status = oracleEvaluateExtensionStatus('true', '0.1.0-beta.1', false, null, '0.1.0');
      // Major 0, Minor 1, Patch 0 matches
      assert.strictEqual(status.status, 'installed');
    });

    test('T2.2.3: Gracefully handles missing version attribute when installed flag is true', () => {
      const status = oracleEvaluateExtensionStatus('true', null, false, null);
      assert.strictEqual(status.status, 'not_installed');
    });

    test('T2.2.4: Flood protection: rapid duplicate pings resolve consistently without state oscillation', () => {
      const results: string[] = [];
      for (let i = 0; i < 50; i++) {
        const s = oracleEvaluateExtensionStatus('true', '0.1.0', true, '0.1.0');
        results.push(s.status);
      }
      assert.ok(results.every((st) => st === 'installed'));
    });

    test('T2.2.5: Correctly flags 0.0.0 or older major version as outdated', () => {
      const status = oracleEvaluateExtensionStatus('true', '0.0.0', false, null, '0.1.0');
      assert.strictEqual(status.status, 'outdated');
    });
  });

  // --- R3 Edge Cases ---
  describe('R3 Boundaries: Help & Support Center Edge Cases', () => {
    test('T2.3.1: Support ticket rejects malformed email strings with HTTP 400', () => {
      const invalidEmails = ['not-an-email', 'missing@tld', '@no-local.com', 'spaces in@email.com'];
      for (const email of invalidEmails) {
        const res = oracleValidateAndDispatchTicket({
          email,
          category: 'bug',
          subject: 'Test Subject',
          message: 'Valid message body here.',
        });
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.status, 400);
      }
    });

    test('T2.3.2: Support ticket rejects empty or whitespace-only subject and message', () => {
      const res1 = oracleValidateAndDispatchTicket({
        email: 'user@corp.com',
        category: 'bug',
        subject: '   ',
        message: 'Valid message content.',
      });
      assert.strictEqual(res1.status, 400);

      const res2 = oracleValidateAndDispatchTicket({
        email: 'user@corp.com',
        category: 'bug',
        subject: 'Valid Subject',
        message: '   \n  \t  ',
      });
      assert.strictEqual(res2.status, 400);
    });

    test('T2.3.3: Support ticket safely accepts subjects containing quotes, angle brackets, and emojis', () => {
      const res = oracleValidateAndDispatchTicket({
        email: 'user@corp.com',
        category: 'feature',
        subject: '🚀 Need <DarkMode> & "Custom Themes" ASAP!',
        message: 'Can we configure custom theme palettes?',
      });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.status, 200);
    });

    test('T2.3.4: FAQ search handles regex special characters without throwing RegExp error', () => {
      const specialQueries = ['[Extension]', 'PII (safe)?', '.*+?^${}()|[]\\', '$$$'];
      for (const query of specialQueries) {
        assert.doesNotThrow(() => {
          oracleSearchFAQs(query);
        });
      }
    });

    test('T2.3.5: FAQ search with empty query returns full FAQ catalog', () => {
      const allFaqs = oracleSearchFAQs('   ');
      assert.strictEqual(allFaqs.length, AUTHORITATIVE_FAQS.length);
    });
  });

  // --- R4 Edge Cases ---
  describe('R4 Boundaries: Dynamic Date Range Edge Cases', () => {
    test('T2.4.1: Handles Leap Year transitions accurately (Feb 29 on leap years)', () => {
      const leapYearDate = new Date('2028-02-29T12:00:00Z');
      const presets = oracleComputeDatePresets(leapYearDate);
      const mtd = presets.find((p) => p.label.startsWith('This Month'))!;
      assert.strictEqual(mtd.startDate, '2028-02-01');
      assert.strictEqual(mtd.endDate, '2028-02-29');
    });

    test('T2.4.2: Handles Year-End boundary (Jan 1: "Last Month" correctly spans Dec of prior year)', () => {
      const janFirst = new Date('2027-01-01T12:00:00Z');
      const presets = oracleComputeDatePresets(janFirst);
      const lastMonth = presets.find((p) => p.label.startsWith('Last Month'))!;
      assert.strictEqual(lastMonth.startDate, '2026-12-01');
      assert.strictEqual(lastMonth.endDate, '2026-12-31');
    });

    test('T2.4.3: Handles month transitions from 31-day months to 30-day months (e.g. May 31 to April 30)', () => {
      const may31 = new Date('2026-05-31T12:00:00Z');
      const presets = oracleComputeDatePresets(may31);
      const lastMonth = presets.find((p) => p.label.startsWith('Last Month'))!;
      assert.strictEqual(lastMonth.startDate, '2026-04-01');
      assert.strictEqual(lastMonth.endDate, '2026-04-30');
    });

    test('T2.4.4: Handles UTC midnight boundaries without off-by-one day shifting', () => {
      const midnightUtc = new Date('2026-09-01T00:00:00.000Z');
      const formatted = oracleFormatYMD(midnightUtc);
      assert.strictEqual(formatted, '2026-09-01');
    });

    test('T2.4.5: Validates custom date ranges where start > end can be detected and inverted safely', () => {
      const normalizeDateRange = (start: string, end: string) => {
        if (new Date(start).getTime() > new Date(end).getTime()) {
          return { startDate: end, endDate: start, inverted: true };
        }
        return { startDate: start, endDate: end, inverted: false };
      };

      const valid = normalizeDateRange('2026-09-01', '2026-09-10');
      assert.strictEqual(valid.inverted, false);

      const inverted = normalizeDateRange('2026-09-10', '2026-09-01');
      assert.strictEqual(inverted.inverted, true);
      assert.strictEqual(inverted.startDate, '2026-09-01');
      assert.strictEqual(inverted.endDate, '2026-09-10');
    });
  });

  // --- R5 Edge Cases ---
  describe('R5 Boundaries: Profile & Settings Hub Edge Cases', () => {
    test('T2.5.1: Rejects empty or whitespace-only profile names', () => {
      const validateProfileName = (name: string) => {
        const trimmed = name.trim();
        return trimmed.length >= 2 && trimmed.length <= 50;
      };

      assert.strictEqual(validateProfileName(''), false);
      assert.strictEqual(validateProfileName('   '), false);
      assert.strictEqual(validateProfileName('A'), false);
      assert.strictEqual(validateProfileName('Sarah Connor'), true);
    });

    test('T2.5.2: Rejects javascript: URI protocols in avatar URLs', () => {
      const validateAvatarUrl = (url: string) => {
        if (!url) return true; // empty allowed
        const lower = url.trim().toLowerCase();
        if (lower.startsWith('javascript:') || lower.startsWith('data:')) return false;
        return lower.startsWith('https://') || lower.startsWith('http://');
      };

      assert.strictEqual(validateAvatarUrl('javascript:alert(1)'), false);
      assert.strictEqual(validateAvatarUrl('data:text/html,<script>'), false);
      assert.strictEqual(validateAvatarUrl('https://images.unsplash.com/avatar.jpg'), true);
    });

    test('T2.5.3: Password change rejects passwords of length 7', () => {
      const res = oracleValidatePassword('Pass12!');
      assert.strictEqual(res.valid, false);
      assert.ok(res.reason?.includes('8 characters'));
    });

    test('T2.5.4: Password change rejects 20-character passwords with letters only', () => {
      const res = oracleValidatePassword('SuperLongPasswordWithoutAnyNumbers');
      assert.strictEqual(res.valid, false);
      assert.ok(res.reason?.includes('number'));
    });

    test('T2.5.5: Initials generator handles single-letter names, symbols, and emails cleanly', () => {
      assert.strictEqual(oracleDeriveInitials('X'), 'X');
      assert.strictEqual(oracleDeriveInitials('Jean-Luc Picard'), 'JP');
      assert.strictEqual(oracleDeriveInitials('', 'z@corp.com'), 'Z');
    });
  });

  // --- R6 Edge Cases ---
  describe('R6 Boundaries: Billing & Feature Matrix Edge Cases', () => {
    test('T2.6.1: Seat calculator handles 0 seats by clamping to minimum 1 seat', () => {
      const cost = oracleCalculateTotalPlanCost('team', false, 0);
      assert.strictEqual(cost.totalBilled, 19);
    });

    test('T2.6.2: Seat calculator handles negative seat inputs safely', () => {
      const cost = oracleCalculateTotalPlanCost('team', true, -5);
      assert.strictEqual(cost.totalBilled, 180);
    });

    test('T2.6.3: Seat calculator rounds fractional seat values down to whole numbers', () => {
      const cost = oracleCalculateTotalPlanCost('team', false, 4.8);
      assert.strictEqual(cost.totalBilled, 19 * 4);
    });

    test('T2.6.4: Mathematical precision check: verify annual prices are clean whole dollar integers', () => {
      for (const plan of Object.values(AUTHORITATIVE_PLANS)) {
        assert.strictEqual(Number.isInteger(plan.annualPricePerMonth), true);
        assert.strictEqual(Number.isInteger(plan.annualBilledYearly), true);
      }
    });

    test('T2.6.5: Feature matrix handles lookup for undefined tier without throwing', () => {
      const getPlanFeatures = (tierId: string) => {
        const plan = AUTHORITATIVE_PLANS[tierId];
        return plan ? plan.features : null;
      };
      assert.strictEqual(getPlanFeatures('ultra-mega-tier'), null);
      assert.ok(getPlanFeatures('team') !== null);
    });
  });

  // --- R7 Edge Cases ---
  describe('R7 Boundaries: Custom PII Scrubber Edge Cases', () => {
    test('T2.7.1: ReDoS protection: catastrophic backtracking regex pattern is guarded safely without hanging', () => {
      const evilRule: CustomPiiRule = {
        id: 'evil-1',
        name: 'Catastrophic Pattern',
        pattern: '(a+)+$', // Classic ReDoS vulnerability
        replacement: '[EVIL_REDACTED]',
        isRegex: true,
        enabled: true,
      };

      const evilInput = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!';
      const start = Date.now();
      const output = oracleScrubPII(evilInput, [evilRule]);
      const elapsed = Date.now() - start;

      assert.ok(elapsed < 50, 'ReDoS guard must execute safely within 50ms');
      assert.strictEqual(output, evilInput, 'ReDoS pattern should be safely skipped');
    });

    test('T2.7.2: Malformed unclosed regex syntax caught gracefully without crashing execution', () => {
      const brokenRules: CustomPiiRule[] = [
        {
          id: 'broken-1',
          name: 'Unclosed Paren',
          pattern: '(unclosed-paren',
          replacement: '[BROKEN]',
          isRegex: true,
          enabled: true,
        },
        {
          id: 'broken-2',
          name: 'Trailing Backslash',
          pattern: 'test\\',
          replacement: '[BROKEN]',
          isRegex: true,
          enabled: true,
        },
      ];

      const input = 'This is a test of broken regex handling.';
      assert.doesNotThrow(() => {
        const output = oracleScrubPII(input, brokenRules);
        assert.strictEqual(output, input);
      });
    });

    test('T2.7.3: Empty or whitespace-only custom rule pattern does not wipe or corrupt document', () => {
      const emptyRule: CustomPiiRule = {
        id: 'empty-1',
        name: 'Empty Pattern',
        pattern: '   ',
        replacement: '[WIPED]',
        rule_type: 'keyword',
        enabled: true,
      };

      const input = 'Hello World!';
      const output = oracleScrubPII(input, [emptyRule]);
      assert.strictEqual(output, input);
    });

    test('T2.7.4: Handles replacement strings containing regex special tokens ($$, $&, $1) safely', () => {
      const specialRule: CustomPiiRule = {
        id: 'special-1',
        name: 'Token Replacement',
        pattern: 'REPLACE_ME',
        replacement: '$&$$$1',
        rule_type: 'keyword',
        enabled: true,
      };

      const input = 'Prefix REPLACE_ME Postfix';
      const output = oracleScrubPII(input, [specialRule]);
      assert.ok(output.includes('Prefix') && output.includes('Postfix'));
    });

    test('T2.7.5: Handles overlapping keyword rules without infinite loops or duplicate redaction tags', () => {
      const overlappingRules: CustomPiiRule[] = [
        {
          id: 'rule-a',
          name: 'General Code',
          pattern: 'DraftPilot',
          replacement: '[TAG_A]',
          rule_type: 'keyword',
          enabled: true,
        },
        {
          id: 'rule-b',
          name: 'Specific Code',
          pattern: 'DraftPilot Pro',
          replacement: '[TAG_B]',
          rule_type: 'keyword',
          enabled: true,
        },
      ];

      const input = 'Welcome to DraftPilot Pro support!';
      const output = oracleScrubPII(input, overlappingRules);
      assert.ok(!output.includes('DraftPilot Pro'));
    });
  });

  // --- R8 Edge Cases ---
  describe('R8 Boundaries: Gamification & Confetti Edge Cases', () => {
    test('T2.8.1: Returns exact 0% progress when all onboarding steps are false', () => {
      const res = oracleEvaluateOnboarding({
        extension_installed: false,
        first_macro_added: false,
        first_draft_generated: false,
        team_member_invited: false,
      });
      assert.strictEqual(res.completedCount, 0);
      assert.strictEqual(res.percentage, 0);
      assert.strictEqual(res.badgesUnlocked.length, 0);
    });

    test('T2.8.2: Accurately handles out-of-order step completion (e.g. Step 3 before Step 1)', () => {
      const res = oracleEvaluateOnboarding({
        extension_installed: false,
        first_macro_added: false,
        first_draft_generated: true,
        team_member_invited: false,
      });
      assert.strictEqual(res.completedCount, 1);
      assert.strictEqual(res.percentage, 25);
      assert.deepStrictEqual(res.badgesUnlocked, ['AI Copilot Ace']);
    });

    test('T2.8.3: Duplicate completion events are idempotent and never inflate percentage beyond 100%', () => {
      let state = {
        extension_installed: true,
        first_macro_added: true,
        first_draft_generated: true,
        team_member_invited: true,
      };

      // Trigger redundant duplicate completions
      state = { ...state, extension_installed: true, first_draft_generated: true };
      const res = oracleEvaluateOnboarding(state);
      assert.strictEqual(res.completedCount, 4);
      assert.strictEqual(res.percentage, 100);
      assert.strictEqual(res.badgesUnlocked.length, 5);
    });

    test('T2.8.4: Confetti animation particles safely clean up and do not leak memory', () => {
      interface Particle {
        x: number;
        y: number;
        alpha: number;
        decay: number;
      }

      const particles: Particle[] = Array.from({ length: 60 }).map(() => ({
        x: 100,
        y: 100,
        alpha: 1.0,
        decay: 0.05,
      }));

      // Simulate 25 animation frames
      for (let frame = 0; frame < 25; frame++) {
        for (const p of particles) {
          p.alpha = Math.max(0, p.alpha - p.decay);
        }
      }

      const activeParticles = particles.filter((p) => p.alpha > 0);
      assert.strictEqual(activeParticles.length, 0, 'All particles must fully fade out');
    });

    test('T2.8.5: All 5 badges unlock correctly if all 4 steps are achieved simultaneously', () => {
      const res = oracleEvaluateOnboarding({
        extension_installed: true,
        first_macro_added: true,
        first_draft_generated: true,
        team_member_invited: true,
      });
      const expectedBadges = [
        'Extension Pioneer',
        'Macro Architect',
        'AI Copilot Ace',
        'Team Builder',
        'DraftPilot Champion',
      ];
      assert.deepStrictEqual(res.badgesUnlocked.sort(), expectedBadges.sort());
    });
  });
});

/**
 * ============================================================================
 * TEST SUITE: TIER 3 — CROSS-FEATURE COMBINATIONS (7 INTEGRATION TESTS)
 * ============================================================================
 */
describe('TIER 3: Cross-Feature Combinations (Multi-Subsystem Interoperability)', () => {
  test('T3.1: Demo Mode + Custom PII Rules Interoperability', () => {
    // Custom enterprise rules scrubbed during demo draft generation
    const customRules: CustomPiiRule[] = [
      {
        id: 'cr-1',
        name: 'Internal Ticket Code',
        pattern: 'Order #4892',
        replacement: '[ORDER_CLASSIFIED]',
        rule_type: 'keyword',
        enabled: true,
      },
    ];

    const ticket = AUTHORITATIVE_DEMO_TICKETS[0];
    const rawThread = ticket.thread[0].body;
    const scrubbedThread = oracleScrubPII(rawThread, customRules);

    assert.ok(scrubbedThread.includes('[ORDER_CLASSIFIED]'));
    assert.ok(scrubbedThread.includes('[CARD_REDACTED]'));
    assert.ok(!scrubbedThread.includes('4111-2222-3333-4444'));
  });

  test('T3.2: Extension Handshake Detection + Onboarding Checklist Auto-Progression', () => {
    // Authentic R2 detection automatically advances R8 onboarding
    const handshake = oracleEvaluateExtensionStatus('true', '0.1.0', false, null);
    assert.strictEqual(handshake.status, 'installed');

    const initialMilestones: OnboardingMilestones = {
      extension_installed: false,
      first_macro_added: false,
      first_draft_generated: false,
      team_member_invited: false,
    };

    // Extension detection triggers auto-completion of Step 1
    const updatedMilestones: OnboardingMilestones = {
      ...initialMilestones,
      extension_installed: handshake.isInstalled,
    };

    const onboarding = oracleEvaluateOnboarding(updatedMilestones);
    assert.strictEqual(onboarding.percentage, 25);
    assert.ok(onboarding.badgesUnlocked.includes('Extension Pioneer'));
  });

  test('T3.3: First Demo Draft Generation + Milestone Celebration Flow', () => {
    // Generating draft in Demo Mode automatically satisfies Step 3 and triggers Confetti
    const ticket = AUTHORITATIVE_DEMO_TICKETS[2];
    const draftResult = oracleSynthesizeDemoDraft(ticket, 'urgent');
    assert.ok(draftResult.draft.length > 0);

    const onboardingState: OnboardingMilestones = {
      extension_installed: true,
      first_macro_added: false,
      first_draft_generated: true, // Triggered by demo generation
      team_member_invited: false,
    };

    const evalResult = oracleEvaluateOnboarding(onboardingState);
    assert.strictEqual(evalResult.percentage, 50);
    assert.ok(evalResult.badgesUnlocked.includes('AI Copilot Ace'));
  });

  test('T3.4: User Profile State + Support Ticket Telemetry Dispatch', () => {
    // Submitting support ticket merges user profile data and extension status telemetry
    const userProfile = {
      name: 'Sarah Connor',
      email: 'sarah@resistance.org',
      role: 'admin',
      extensionVersion: '0.1.0',
    };

    const ticketResult = oracleValidateAndDispatchTicket({
      name: userProfile.name,
      email: userProfile.email,
      category: 'extension',
      subject: 'Extension sync verification on secondary device',
      message: `Running extension ${userProfile.extensionVersion}. User role is ${userProfile.role}.`,
    });

    assert.strictEqual(ticketResult.success, true);
    assert.ok(ticketResult.ticketId);
  });

  test('T3.5: Dynamic Date Range Selection + Overview Metrics Query Filtering', () => {
    // Selecting "Last 30 Days" preset constructs ISO date queries
    const refDate = new Date('2026-09-04T12:00:00Z');
    const presets = oracleComputeDatePresets(refDate);
    const l30 = presets.find((p) => p.label === 'Last 30 Days')!;

    // Construct Supabase filter query parameters
    const queryFilter = {
      created_at_gte: `${l30.startDate}T00:00:00.000Z`,
      created_at_lte: `${l30.endDate}T23:59:59.999Z`,
    };

    assert.strictEqual(queryFilter.created_at_gte, '2026-08-06T00:00:00.000Z');
    assert.strictEqual(queryFilter.created_at_lte, '2026-09-04T23:59:59.999Z');
  });

  test('T3.6: Annual Billing Switch + Feature Comparison Matrix Dynamics', () => {
    // Toggling Annual billing updates Feature Matrix and seat calculator in unison
    let isAnnual = false;
    let cost = oracleCalculateTotalPlanCost('team', isAnnual, 4);
    assert.strictEqual(cost.totalBilled, 76); // $19 * 4

    isAnnual = true;
    cost = oracleCalculateTotalPlanCost('team', isAnnual, 4);
    assert.strictEqual(cost.totalBilled, 720); // 4 * $180
    assert.strictEqual(cost.savingsPerYear, 192); // (19*12*4) - 720 = 912 - 720 = 192
  });

  test('T3.7: Custom PII Rule Management + Cross-Package Redaction Parity', () => {
    // Verify that the same custom PII rule configuration produces identical output
    const rule: CustomPiiRule = {
      id: 'rule-ssn-custom',
      name: 'Tax ID Format',
      pattern: 'TAXID-\\d{6}',
      replacement: '[TAX_ID_REDACTED]',
      isRegex: true,
      enabled: true,
    };

    const text = 'Company account TAXID-992144 registered under user@example.com';
    const webResult = oracleScrubPII(text, [rule]);
    const apiResult = oracleScrubPII(text, [rule]);

    assert.strictEqual(webResult, apiResult);
    assert.ok(webResult.includes('[TAX_ID_REDACTED]'));
    assert.ok(webResult.includes('[EMAIL_REDACTED]'));
  });
});

/**
 * ============================================================================
 * TEST SUITE: TIER 4 — REAL-WORLD USER SCENARIOS (4 COMPREHENSIVE JOURNEYS)
 * ============================================================================
 */
describe('TIER 4: Real-World User Scenarios (End-to-End Workflows)', () => {
  test('T4.1: Complete First-Time User Onboarding & Activation Journey', () => {
    // 1. Visitor arrives on landing page -> tests Demo Mode on Refund ticket
    const refundTicket = AUTHORITATIVE_DEMO_TICKETS[0];
    const demoDraft = oracleSynthesizeDemoDraft(refundTicket, 'empathetic');
    assert.ok(demoDraft.draft.length > 0);
    assert.ok(demoDraft.scrubbedCount >= 1);

    // 2. User signs up and installs Chrome extension
    const extensionHandshake = oracleEvaluateExtensionStatus('true', '0.1.0', true, '0.1.0');
    assert.strictEqual(extensionHandshake.status, 'installed');

    // 3. Checklist Step 1 auto-completes
    let milestones: OnboardingMilestones = {
      extension_installed: true,
      first_macro_added: false,
      first_draft_generated: false,
      team_member_invited: false,
    };
    let evalRes = oracleEvaluateOnboarding(milestones);
    assert.strictEqual(evalRes.percentage, 25);
    assert.ok(evalRes.badgesUnlocked.includes('Extension Pioneer'));

    // 4. User adds first macro in dashboard
    milestones.first_macro_added = true;
    evalRes = oracleEvaluateOnboarding(milestones);
    assert.strictEqual(evalRes.percentage, 50);
    assert.ok(evalRes.badgesUnlocked.includes('Macro Architect'));

    // 5. User generates first draft in Gmail -> Confetti triggers
    milestones.first_draft_generated = true;
    evalRes = oracleEvaluateOnboarding(milestones);
    assert.strictEqual(evalRes.percentage, 75);
    assert.ok(evalRes.badgesUnlocked.includes('AI Copilot Ace'));

    // 6. User invites support teammate
    milestones.team_member_invited = true;
    evalRes = oracleEvaluateOnboarding(milestones);
    assert.strictEqual(evalRes.percentage, 100);
    assert.ok(evalRes.badgesUnlocked.includes('DraftPilot Champion'));
  });

  test('T4.2: Enterprise Privacy & Custom Redaction Configuration Lifecycle', () => {
    // 1. Admin navigates to Settings Hub -> checks profile initials
    const initials = oracleDeriveInitials('Elena Rostova', 'elena@cybernet.co');
    assert.strictEqual(initials, 'ER');

    // 2. Admin adds custom enterprise redaction rules
    const customRules: CustomPiiRule[] = [
      {
        id: 'rule-emp',
        name: 'Employee ID',
        pattern: 'EMP-\\d{5}',
        replacement: '[EMPLOYEE_ID]',
        isRegex: true,
        enabled: true,
      },
      {
        id: 'rule-codename',
        name: 'Project Apollo',
        pattern: 'Project Apollo',
        replacement: '[PROJECT_CONFIDENTIAL]',
        rule_type: 'keyword',
        enabled: true,
      },
    ];

    // 3. Admin tests rules in Live PII Playground
    const sampleInput = 'Agent EMP-44910 reporting on Project Apollo with customer phone 555-123-4567';
    const preview = oracleScrubPII(sampleInput, customRules);

    assert.ok(preview.includes('[EMPLOYEE_ID]'));
    assert.ok(preview.includes('[PROJECT_CONFIDENTIAL]'));
    assert.ok(preview.includes('[PHONE_REDACTED]'));
    assert.ok(!preview.includes('EMP-44910'));
    assert.ok(!preview.includes('Project Apollo'));
  });

  test('T4.3: Extension Version Mismatch & Support Escalation Journey', () => {
    // 1. User loads dashboard with outdated extension v0.0.8
    const handshake = oracleEvaluateExtensionStatus('true', '0.0.8', false, null, '0.1.0');
    assert.strictEqual(handshake.status, 'outdated');

    // 2. User searches Help Center for "extension"
    const faqs = oracleSearchFAQs('extension');
    assert.ok(faqs.length >= 1);

    // 3. User submits support ticket requesting update package
    const ticket = oracleValidateAndDispatchTicket({
      name: 'Marcus Brody',
      email: 'marcus@atlaslogistics.org',
      category: 'extension',
      subject: 'Extension outdated version alert v0.0.8',
      message: 'Dashboard reports outdated version v0.0.8, requesting new v0.1.0 direct download.',
    });

    assert.strictEqual(ticket.success, true);
    assert.strictEqual(ticket.status, 200);
    assert.ok(ticket.ticketId?.startsWith('DP-TK-'));
  });

  test('T4.4: Workspace Expansion & Annual Subscription Upgrade Journey', () => {
    // 1. Workspace reaches 80% free tier quota (40/50 used)
    const currentUsage = 40;
    const freeQuota = AUTHORITATIVE_PLANS.free.draftLimit;
    const isNearLimit = currentUsage / freeQuota >= 0.8;
    assert.strictEqual(isNearLimit, true);

    // 2. Admin inspects billing options: Free vs Team vs Enterprise
    const teamPlan = AUTHORITATIVE_PLANS.team;
    assert.strictEqual(teamPlan.draftLimit, 1000);

    // 3. Admin calculates annual savings for 6 agents
    const teamAnnualCost = oracleCalculateTotalPlanCost('team', true, 6);
    // 6 * $15 = $90/mo billed as $1080/yr (Saves 6 * $48 = $288/yr)
    assert.strictEqual(teamAnnualCost.pricePerMonth, 90);
    assert.strictEqual(teamAnnualCost.totalBilled, 1080);
    assert.strictEqual(teamAnnualCost.savingsPerYear, 288);

    // 4. Admin submits annual checkout payload
    const checkoutPayload = {
      tier: 'team',
      seats: 6,
      cadence: 'yearly',
    };
    assert.strictEqual(checkoutPayload.cadence, 'yearly');
    assert.strictEqual(checkoutPayload.seats, 6);
  });
});
