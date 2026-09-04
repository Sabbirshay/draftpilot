# Project: DraftPilot 8 UX, Account Management & Real-Time Integration Features

## Architecture
DraftPilot is a monorepo consisting of:
- **`packages/web` (`@draftpilot/web`)**: Next.js 14 App Router, React 18, Tailwind CSS, Framer Motion, Supabase JS Client.
- **`packages/api` (`@draftpilot/api`)**: NestJS 10 backend, Express, Supabase JS Client, Stripe.
- **`packages/extension` (`@draftpilot/extension`)**: Chrome Manifest V3 extension, Vite 5, TypeScript.
- **`packages/api/supabase/migrations`**: PostgreSQL database migrations with Row Level Security (RLS).

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| F1 | Demo Mode Sample Tickets & Synthesizer | 4 sample tickets (Return, Shipping, Reset, Billing), tone/macro modifiers, client-side zero-auth reply synthesizer | M1 | R1 | DONE |
| F2 | Interactive Demo Sandbox UI | `TryDemoModeModal` / embedded sandbox accessible from header & onboarding with speed & PII callouts | M1 | R1 | DONE |
| F3 | Chrome Extension Web Handshake | `web-handshake.ts` content script in `packages/extension`, DOM attributes & postMessage ping/pong | M1 | R2 | DONE |
| F4 | Authentic Extension Detection UI | `useExtensionStatus()` hook, accurate status badges ("Not Installed", "Installed & Ready", "Outdated Version") in `GmailSyncManager` & header | M1 | R2 | DONE |
| F5 | Global Help & Support Center UI | Header support trigger button, modal/flyout with Documentation, Video Walkthrough, searchable FAQs, ticket form, system status/version | M2 | R3 | DONE |
| F6 | Support Ticket Dispatch API | `POST /api/support/ticket` endpoint validating and processing support tickets/feedback | M2 | R3 | DONE |
| F7 | Dynamic Date Range Computation | Centralized `date-utils.ts` computing dynamic defaults (Last 7 Days, Last 30 Days, Current Month MTD) relative to `new Date()` | M2 | R4 | DONE |
| F8 | Metrics & Calendar Dynamic Integration | Update `DateRangePicker.tsx`, `dashboard/page.tsx`, and `OverviewBento.tsx` with dynamic date querying | M2 | R4 | DONE |
| F9 | User Profile & Account Settings Hub | Comprehensive `/dashboard/settings` route with Profile, Security (password change), Notifications, and Workspace info tabs | M2 | R5 | DONE |
| F10 | Annual Billing Toggle & Pricing Updates | Monthly/Annual toggle on billing & `Pricing.tsx` with "Save 20%" callout and 3-tier pricing ($0, $15/19, $79/99) | M3 | R6 | DONE |
| F11 | Tier Feature Comparison Matrix | Itemized comparison matrix across Free, Team, and Enterprise tiers (drafts, macros, docs, seats, PII, support SLA) | M3 | R6 | DONE |
| F12 | Unified Custom PII Engine | Upgrade `scrubPII(text, customRules?: CustomPiiRule[])` across Web, API, and Extension with ReDoS protection | M3 | R7 | DONE |
| F13 | Custom PII Management & Live Playground | Settings interface to manage custom regex/keywords and interactive Live PII Playground with real-time redaction preview | M3 | R7 | DONE |
| F14 | 4-Step Onboarding Checklist & Badges | Interactive checklist (Install Extension, Create Macro, Generate Draft, Invite Member) with auto-detection & 5 milestone badges | M3 | R8 | DONE |
| F15 | Celebration Confetti & Delight Banner | Particle confetti animation (`ConfettiCelebration.tsx`) and celebratory banner upon first AI draft generation | M3 | R8 | DONE |
| F16 | Opaque-Box E2E Test Suite (Tiers 1-4) | Systematic requirement-driven test suite covering all 8 features (Tiers 1-4: 91 test cases) | M4 | Quality | DONE |
| F17 | Adversarial Hardening & Monorepo Build Health | White-box stress tests, malformed regex guards, date boundary tests, and `pnpm test`, `pnpm build:*` verification | M4 | Quality | IN_PROGRESS |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Activation & Pairing: Demo Mode & Authentic Extension Detection | F1, F2, F3, F4 | none | DONE |
| M2 | Navigation, Analytics & Account Hub: Help Center, Dynamic Dates & Profile Hub | F5, F6, F7, F8, F9 | none | DONE |
| M3 | Growth, Privacy & Gamification: Annual Billing, Custom PII Rules & Onboarding Celebrations | F10, F11, F12, F13, F14, F15 | none | DONE |
| M4 | Final Milestone: Full E2E Test Suite Pass, Adversarial Hardening & Monorepo Build Verification | F16, F17 | M1, M2, M3, TEST_READY | IN_PROGRESS |

## Interface Contracts

### 1. Demo Mode Synthesizer (`packages/web/src/data/demo-data.ts`)
```typescript
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

export function synthesizeDemoDraft(ticket: DemoTicket, tone: string, macroId?: string): DemoDraftResult;
```

### 2. Chrome Extension Web Handshake (`packages/extension/src/content/web-handshake.ts` & `packages/web/src/hooks/useExtensionStatus.ts`)
- **DOM Signature**: Extension content script injects onto `localhost` and `*.vercel.app`:
  - `document.documentElement.setAttribute('data-draftpilot-extension-installed', 'true')`
  - `document.documentElement.setAttribute('data-draftpilot-extension-version', '0.1.0')`
- **Window Event**: Listens for `window.addEventListener('message')`:
  - Request: `{ source: 'draftpilot-web', type: 'DRAFTPILOT_EXTENSION_PING' }`
  - Response: `{ source: 'draftpilot-extension', type: 'DRAFTPILOT_EXTENSION_PONG', version: '0.1.0', ready: true }`
- **Hook States**: `'checking' | 'installed' | 'not_installed' | 'outdated'`

### 3. Support Ticket API (`POST /api/support/ticket`)
- Request Body: `{ name: string, email: string, category: string, subject: string, message: string }`
- Response: `{ success: true, ticketId: string, message: string }`
- Status: 200 on success, 400 on validation error.

### 4. Dynamic Date Math Contract (`packages/web/src/lib/date-utils.ts`)
```typescript
export interface DatePreset {
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  compareStartDate?: string;
  compareEndDate?: string;
  compareLabel?: string;
}

export function computeDatePresets(referenceDate?: Date): {
  presets: DatePreset[];
  initialRange: DateRangeState;
};
```

### 5. Custom PII Rule Contract (`packages/web/src/lib/pii-scrubber.ts` & api & extension)
```typescript
export interface CustomPiiRule {
  id: string;
  name: string;
  pattern: string; // Regex string or keyword
  replacement: string; // e.g. '[CUSTOM-ID]'
  isRegex: boolean;
  enabled: boolean;
}

export function scrubPII(text: string, customRules?: CustomPiiRule[]): string;
```

## Code Layout
- `packages/web/src/`:
  - `data/demo-data.ts`: 4 demo ticket fixtures and client synthesizer.
  - `components/dashboard/TryDemoModeModal.tsx`: Demo mode interactive modal.
  - `components/dashboard/GmailSyncManager.tsx`: Extension status integration.
  - `components/dashboard/HelpSupportCenter.tsx`: Help & support flyout.
  - `components/dashboard/DateRangePicker.tsx`: Dynamic date presets.
  - `components/dashboard/OverviewBento.tsx`: Date-filtered metrics queries.
  - `app/dashboard/settings/page.tsx`: Profile, security, notifications, PII playground.
  - `app/api/support/ticket/route.ts`: Support ticket dispatch endpoint.
  - `components/Pricing.tsx`: Annual billing toggle & 3 tiers.
  - `components/dashboard/BillingManager.tsx`: Annual toggle & feature matrix.
  - `components/dashboard/FeatureComparisonMatrix.tsx`: Itemized tier comparison table.
  - `lib/date-utils.ts`: Dynamic date range calculation.
  - `lib/pii-scrubber.ts`: Custom PII rule engine.
  - `components/settings/PiiPlayground.tsx`: Interactive PII playground.
  - `components/dashboard/OnboardingDashboard.tsx`: 4-step checklist & badges.
  - `components/dashboard/ConfettiCelebration.tsx`: Particle confetti.
  - `hooks/useExtensionStatus.ts`: Extension handshake detection hook.
- `packages/extension/`:
  - `manifest.json`: Web handshake content script registration.
  - `src/content/web-handshake.ts`: DOM attribute & postMessage handler.
  - `src/utils/pii-scrubber.ts`: Shared custom PII rules.
- `packages/api/src/`:
  - `utils/pii-scrubber.ts`: Shared custom PII rules.
