# DraftPilot E2E Test Infrastructure & Methodology (Tiers 1–4)

## 1. Overview & Testing Philosophy

This document outlines the testing architecture, methodology, and verification framework for DraftPilot across all 8 prioritized features (R1–R8). The testing suite is built using the Node.js native test runner (`node:test` and `node:assert/strict`) executed with `--experimental-strip-types` and `--test-concurrency=1` to guarantee deterministic, isolated, and high-performance verification without flaky asynchronous race conditions.

Testing is governed by the **4-Tier Testing Methodology**:
- **Tier 1 — Feature Coverage**: Comprehensive unit and integration verification for each requirement under standard operation (>= 5 tests per feature, minimum 40 tests).
- **Tier 2 — Boundary & Corner Cases**: Defensive hardening against extreme inputs, malformed regex, ReDoS attacks, calendar and leap-year transitions, missing headers, and invalid version tags (>= 5 tests per feature, minimum 40 tests).
- **Tier 3 — Cross-Feature Combinations**: Verification of multi-subsystem interoperability (Demo Mode + Custom PII, Extension Handshake + Onboarding Checklist, Settings + Date Queries, Billing Cadence + Matrix, etc.).
- **Tier 4 — Real-World User Scenarios**: End-to-end user journeys simulating complete customer activation, onboarding, security hardening, support escalation, and subscription upgrades.

---

## 2. Requirement Matrix & Contract Specifications

| Req ID | Feature Name | Primary Source Files | Interface Contracts & Output Specifications |
|---|---|---|---|
| **R1** | Interactive "Try Demo Mode" Experience | `packages/web/src/data/demo-data.ts`<br>`TryDemoModeModal.tsx`<br>`InteractiveDemo.tsx` | 4 sample tickets (*Return/Refund*, *Shipping*, *Password Reset*, *Billing*), 4 tone modifiers (*Empathetic*, *Concise*, *Formal*, *Urgent*), macro modifiers, speed metric (`generationTimeMs > 0`), zero-auth client synthesizer `synthesizeDemoDraft(ticket, tone, macroId?)`. |
| **R2** | Authentic Chrome Extension Detection | `packages/extension/src/content/web-handshake.ts`<br>`useExtensionStatus.ts`<br>`GmailSyncManager.tsx` | DOM attributes (`data-draftpilot-extension-installed`, `data-draftpilot-extension-version`), `window.postMessage` ping/pong (`DRAFTPILOT_EXTENSION_PING` / `PONG`), hook states (`'checking'`, `'installed'`, `'not_installed'`, `'outdated'`). |
| **R3** | Help & Support Center in Global Header | `HelpSupportCenter.tsx`<br>`app/api/support/ticket/route.ts`<br>`DashboardHeader.tsx` | Header flyout/modal, client-side searchable FAQs, Ticket Dispatch API (`POST /api/support/ticket` returning `{ success: true, ticketId, message }`), system status & version `0.1.0`. |
| **R4** | Dynamic Date Range Default Fix | `packages/web/src/lib/date-utils.ts`<br>`DateRangePicker.tsx`<br>`OverviewBento.tsx` | Centralized `computeDatePresets(refDate?: Date)` relative to `new Date()`, presets (*Today*, *Last 7 Days*, *Last 30 Days*, *This Month*, *Last Month*, *YTD*), ISO formatting, calendar month initialization, dynamic date querying in metrics. |
| **R5** | User Profile & Account Settings Hub | `app/dashboard/settings/page.tsx`<br>`UserSettingsHub.tsx`<br>`DashboardHeader.tsx` | `/dashboard/settings` route, profile updates (name, avatar, initials derived), password change via Supabase Auth `updateUser`, notification preferences in `user_metadata`, workspace membership & role badges. |
| **R6** | Annual Billing Toggle & Feature Matrix | `components/Pricing.tsx`<br>`BillingManager.tsx`<br>`FeatureComparisonMatrix.tsx` | Monthly/Annual toggle with "Save 20%" callout, 3-tier pricing model ($0, $19/$15/seat, $99/$79), 6-dimension itemized comparison matrix, checkout cadence parameter (`'monthly' \| 'yearly'`). |
| **R7** | Custom PII Scrubbing Rules & Playground | `lib/pii-scrubber.ts`<br>`PiiPlayground.tsx`<br>`packages/api/src/utils/pii-scrubber.ts` | Custom rule contract (`CustomPiiRule`: regex/keyword, pattern, replacement, enabled), ReDoS and malformed regex protection, live diffing and match attribution, multi-package consistency. |
| **R8** | Onboarding Celebration & Gamification | `OnboardingDashboard.tsx`<br>`ConfettiCelebration.tsx`<br>`AuthProvider.tsx` | 4-step checklist (*Install Extension*, *Create Macro*, *Generate Draft*, *Invite Member*), 5 milestone achievement badges, progress calculation (0–100%), confetti particle celebration upon first draft. |

---

## 3. Tier Breakdown & Test Hierarchy

### Tier 1: Feature Coverage (40 Tests)
- **R1: Demo Mode (5 Tests)**:
  - T1.1.1: Verify all 4 predefined sample ticket fixtures exist with required fields.
  - T1.1.2: Validate draft synthesis across all 4 tone modifiers (Empathetic, Concise, Formal, Urgent).
  - T1.1.3: Verify macro modifier application updates draft content with template insertions.
  - T1.1.4: Confirm zero-auth execution produces simulated execution speed telemetry (`generationTimeMs`).
  - T1.1.5: Verify PII scrubbing redacts credit cards, emails, and phones inside demo ticket threads.
- **R2: Extension Detection & Handshake (5 Tests)**:
  - T1.2.1: Verify extension content script sets DOM attributes on web application origins.
  - T1.2.2: Validate two-way `window.postMessage` ping-pong handshake resolution.
  - T1.2.3: Verify detection hook reports `"installed"` (or `"installed_ready"`) when version matches current `0.1.0`.
  - T1.2.4: Verify detection hook reports `"outdated"` when extension version is lower than target.
  - T1.2.5: Verify detection hook reports `"not_installed"` when no DOM signature or pong is received.
- **R3: Help & Support Center (5 Tests)**:
  - T1.3.1: Verify Help & Support trigger and modal tab sections (Docs, Walkthrough, FAQs, Ticket, Status).
  - T1.3.2: Verify FAQ keyword search filtering returns matching items and handles empty queries.
  - T1.3.3: Validate `POST /api/support/ticket` endpoint processes valid submissions and returns ticket ID.
  - T1.3.4: Verify system telemetry displays current app version `0.1.0` and operational statuses.
  - T1.3.5: Verify support ticket priority assignment and category categorization.
- **R4: Dynamic Date Range Math (5 Tests)**:
  - T1.4.1: Verify `computeDatePresets` calculates presets relative to current reference date (`new Date()`).
  - T1.4.2: Validate "Last 7 Days" and "Last 30 Days" presets compute exact date spans and comparison windows.
  - T1.4.3: Validate "This Month (MTD)" preset computes 1st of month through current date or month-end.
  - T1.4.4: Validate "Last Month" preset accurately spans from the 1st to the last day of the prior month.
  - T1.4.5: Verify ISO `YYYY-MM-DD` formatting and human-readable month display strings.
- **R5: User Profile & Account Settings (5 Tests)**:
  - T1.5.1: Verify profile name updates and dynamic initials calculation from full name and email.
  - T1.5.2: Validate password change validation rules (min 8 chars, alphanumeric requirement).
  - T1.5.3: Verify notification preferences data structure and granular toggle updates.
  - T1.5.4: Verify workspace membership display (role badges, joined date formatting, plan limits).
  - T1.5.5: Validate profile settings route accessibility at `/dashboard/settings`.
- **R6: Annual Billing Toggle & Matrix (5 Tests)**:
  - T1.6.1: Verify monthly vs annual pricing calculation reflects 20% savings on Team and Enterprise.
  - T1.6.2: Validate seat pricing computation for single and multi-seat team workspaces.
  - T1.6.3: Verify itemized feature comparison matrix across Free, Team, and Enterprise tiers.
  - T1.6.4: Validate annual billing toggle switches pricing callouts and highlighted terms.
  - T1.6.5: Verify checkout / upgrade payload passes selected billing cadence (`'monthly'` vs `'yearly'`).
- **R7: Custom PII Scrubber & Playground (5 Tests)**:
  - T1.7.1: Verify custom keyword redaction replaces whole-word matches with custom tag.
  - T1.7.2: Verify custom regex redaction matches specified patterns (e.g. employee IDs `EMP-\d{5}`).
  - T1.7.3: Validate combined execution: custom rules execute alongside built-in PII rules.
  - T1.7.4: Verify live PII playground preview calculates redaction counts and identifies matching rules.
  - T1.7.5: Verify disabled custom rules are ignored during text scrubbing.
- **R8: Onboarding Gamification & Badges (5 Tests)**:
  - T1.8.1: Verify 4-step onboarding checklist schema and completion percentage calculation (0%, 25%, 50%, 75%, 100%).
  - T1.8.2: Validate automatic milestone completion when extension pairing is detected.
  - T1.8.3: Validate automatic milestone completion when first AI draft is generated.
  - T1.8.4: Verify 5 milestone achievement badges unlock at respective completion milestones.
  - T1.8.5: Validate confetti celebration particle parameters and celebratory banner trigger.

---

### Tier 2: Boundary & Corner Cases (40 Tests)
- **R1: Demo Mode Boundaries (5 Tests)**:
  - T2.1.1: Synthesizer handles empty or whitespace-only customer body gracefully without crashing.
  - T2.1.2: Synthesizer handles missing or unknown tone modifier by defaulting to standard tone.
  - T2.1.3: Synthesizer handles unknown or invalid macro ID without breaking draft generation.
  - T2.1.4: Handles extreme input text sizes (>50KB thread content) within safe execution bounds.
  - T2.1.5: Handles tickets with zero PII entities while maintaining valid output structure.
- **R2: Extension Detection Boundaries (5 Tests)**:
  - T2.2.1: Rejects postMessage events originating from untrusted window sources or wrong data types.
  - T2.2.2: Handles malformed extension version strings (e.g. `"v0.1"`, `"0.1.0-beta.1"`, empty string).
  - T2.2.3: Handles missing DOM attributes when extension is partially loaded or blocked by sandbox.
  - T2.2.4: Immune to rapid repeated ping events (flooding) without generating duplicate listeners.
  - T2.2.5: Properly classifies pre-release or zero version (`"0.0.0"`) as outdated.
- **R3: Support Center Boundaries (5 Tests)**:
  - T2.3.1: Ticket API rejects malformed email addresses with HTTP 400.
  - T2.3.2: Ticket API rejects missing subject, empty message, or whitespace-only body.
  - T2.3.3: Ticket API handles XSS and script injection strings in ticket subject/body safely.
  - T2.3.4: FAQ search handles regex special meta-characters (`[`, `*`, `+`, `?`, `\`) without syntax errors.
  - T2.3.5: FAQ search with pure whitespace or Unicode symbols returns expected boundaries.
- **R4: Date Range Boundaries (5 Tests)**:
  - T2.4.1: Handles Leap Year transitions (Feb 29 on leap years vs Feb 28 on standard years).
  - T2.4.2: Handles Year-End transitions (Jan 1: "Last Month" correctly transitions to Dec 31 of prior year).
  - T2.4.3: Handles month transitions from 31-day months to 30-day months (e.g. March 31 -> April 30).
  - T2.4.4: Handles timezone offsets (UTC midnight boundaries) without date shifting.
  - T2.4.5: Validates custom date ranges where `startDate > endDate` are rejected or normalized.
- **R5: Profile & Settings Boundaries (5 Tests)**:
  - T2.5.1: Rejects whitespace-only or empty profile names.
  - T2.5.2: Sanitizes HTML/script injection attempts in profile name and avatar fields.
  - T2.5.3: Password change rejects passwords shorter than 8 characters.
  - T2.5.4: Password change rejects passwords missing numbers or letters.
  - T2.5.5: Initials generator handles single-letter names, symbols, and empty strings safely.
- **R6: Billing Boundaries (5 Tests)**:
  - T2.6.1: Seat calculator handles 0 seats (clamps to minimum 1 seat).
  - T2.6.2: Seat calculator handles negative numbers gracefully.
  - T2.6.3: Seat calculator rounds non-integer fractional seat counts safely.
  - T2.6.4: Mathematical precision check: verify 20% annual discount formula produces exact dollar integers.
  - T2.6.5: Feature matrix handles lookup for undefined or invalid plan tier without throwing.
- **R7: Custom PII Boundaries (5 Tests)**:
  - T2.7.1: ReDoS protection: complex catastrophic backtracking regex patterns do not hang execution.
  - T2.7.2: Malformed regex syntax (unclosed parenthesis, dangling brackets) caught gracefully without crashing.
  - T2.7.3: Handles empty pattern string or whitespace pattern without redacting entire document.
  - T2.7.4: Handles custom replacement strings containing regex replacement tokens (`$$`, `$&`, `$1`).
  - T2.7.5: Handles overlapping keyword matches without infinite loops or double replacements.
- **R8: Onboarding Gamification Boundaries (5 Tests)**:
  - T2.8.1: State calculation handles all flags `false` (yields exact 0% progress).
  - T2.8.2: Handles out-of-order step completion (e.g. Step 3 complete before Step 1).
  - T2.8.3: Duplicate completion events are strictly idempotent and do not inflate progress > 100%.
  - T2.8.4: Confetti animation safely cleans up animation particles after execution timeout.
  - T2.8.5: Badges unlock correctly even if all 4 steps are achieved simultaneously in a single transaction.

---

### Tier 3: Cross-Feature Combinations (7 Tests)
- **T3.1: Demo Mode + Custom PII Rules Interoperability**:
  Demonstrates that custom workspace PII rules (e.g. `[INTERNAL-REF]`) are executed during zero-auth demo draft generation on sample tickets.
- **T3.2: Extension Handshake Detection + Onboarding Checklist Auto-Progression**:
  Successful R2 handshake detection automatically flips `extension_installed` to `true`, advancing checklist progress to 25% and unlocking "Extension Pioneer" badge.
- **T3.3: First Demo Draft Generation + Milestone Celebration Flow**:
  Generating a draft in Demo Mode automatically triggers Step 3 (`first_draft_generated`), unlocks "AI Copilot Ace", and invokes the Confetti Celebration.
- **T3.4: User Profile State + Support Ticket Telemetry Dispatch**:
  Support ticket dispatch automatically merges user profile data (name, email, role) with authentic extension pairing telemetry.
- **T3.5: Dynamic Date Range Selection + Overview Metrics Query Filtering**:
  Selecting dynamic date preset computes ISO date boundary filters matching Supabase `created_at` telemetry.
- **T3.6: Annual Billing Switch + Feature Comparison Matrix Dynamics**:
  Toggling between Monthly and Annual dynamically recalculates the entire Feature Comparison Matrix pricing, savings badges, and seat calculators in unison.
- **T3.7: Custom PII Rule Management + Cross-Package Redaction Parity**:
  Verifies that custom PII rules configured via the settings engine produce identical redaction output across Web, Extension, and API scrubbers.

---

### Tier 4: Real-World User Scenarios (4 Tests)
- **T4.1: Complete First-Time User Onboarding & Activation Journey**:
  End-to-end journey from initial unauthenticated landing page visit, testing demo mode, signing up, pairing extension, authoring a macro, generating first draft with confetti, and inviting a teammate to achieve 100% onboarding completion.
- **T4.2: Enterprise Privacy & Custom Redaction Configuration Lifecycle**:
  Company administrator sets up workspace settings, defines custom regex and keyword redaction rules, verifies them in the live PII playground, and executes draft synthesis ensuring zero data leakage.
- **T4.3: Extension Version Mismatch & Support Escalation Journey**:
  User with outdated extension receives clear visual advisory, uses the Header Help Center to search documentation, and submits an authenticated support ticket with auto-attached system telemetry.
- **T4.4: Workspace Expansion & Annual Subscription Upgrade Journey**:
  Workspace administrator approaches draft quota, reviews the dynamic 3-tier comparison matrix, toggles annual billing to save 20%, calculates multi-seat team cost, and dispatches the annual upgrade checkout payload.

---

## 4. Test Execution & Verification

### Running the Full Test Suite
To run all test suites across the monorepo:
```bash
export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
pnpm test
```

### Running the E2E Test Suite Directly
To run the dedicated E2E test suite in isolation:
```bash
export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
cd "/home/md-roni-ahamed/Test project/packages/web"
node --experimental-strip-types --test src/lib/__tests__/e2e-all-features.test.ts
```

### Running with Production Builds
To verify end-to-end monorepo build health:
```bash
pnpm build:web
pnpm build:api
pnpm build:ext
```
