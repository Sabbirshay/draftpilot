# Project: DraftPilot Audit & Remediation

## Architecture
- Monorepo structure with `packages/web` (Next.js 14), `packages/api` (NestJS 10), and `packages/extension` (Vite / CRXJS Manifest V3).
- Authentication via Supabase Auth + Master Passkey for Super Admin.
- Data Layer: PostgreSQL on Supabase with Row Level Security (RLS) for multi-tenancy.
- Real-time synchronization: Supabase Realtime (`postgres_changes`) channels + polling fallbacks.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Extension AI Draft Generation | Fix ReferenceError on `hint` in `api-client.ts:560`, ensuring prompt customizations and macro hints pass cleanly to server. | M1 | survey (Explorer 1) |
| 2 | User Auth & Password Recovery | Connect "Forgot Password" in `AuthForm.tsx` to Supabase password reset. | M1 | survey (Explorer 1) |
| 3 | Team & Billing User Flows | Enhance `TeamManager.tsx` invitation handling and `BillingManager.tsx` portal trigger. | M1 | survey (Explorer 1) |
| 4 | Macro Manager Rollback | Add optimistic update rollback on delete error in `MacrosManager.tsx`. | M1 | survey (Explorer 1) |
| 5 | PII Scrubber Test Syntax | Fix `.ts` import specifier and test runner typings in `pii-scrubber.test.ts`. | M1 | survey (Explorer 1) |
| 6 | AdminGuard Passkey Authentication | Fix passkey unlock deadlock in `AdminGuard.tsx` for direct console access without existing session. | M2 | survey (Explorer 2) |
| 7 | Admin Auth Key Resilience | Make `admin-auth.ts` safe against empty/missing service role key to prevent crashing routes. | M2 | survey (Explorer 2) |
| 8 | Admin AI Config Passkey Header | Pass `x-admin-passkey` header in `AdminAIConfig.tsx` to allow passkey-authorized mutations. | M2 | survey (Explorer 2) |
| 9 | Admin Auth Test Syntax | Fix `.ts` import specifier in `admin-auth.test.ts`. | M2 | survey (Explorer 2) |
| 10 | Feature Flags Persistence | Add API route and persistence mechanism for `AdminFeatureFlags.tsx`. | M3 | survey (Explorer 2, 3) |
| 11 | Global Macros CRUD & Broadcast | Add server-side broadcast API route and UI controls in `AdminGlobalMacros.tsx`. | M3 | survey (Explorer 2, 3) |
| 12 | Live Cross-Party State Sync | Add Supabase Realtime subscriptions to `OverviewBento.tsx` and `MacrosManager.tsx`. | M3 | survey (Explorer 3) |
| 13 | Dynamic Quota Display | Replace hardcoded `/ 50` quota limit in `OverviewBento.tsx` with dynamic team quota limit. | M3 | survey (Explorer 3) |
| 14 | Multi-Package Static Typing & Build Suite | Verify 0 TypeScript errors and clean production builds for `build:web`, `build:api`, `build:ext`. | M4 | survey (All) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Extension AI & User Dashboard Fixes | Extension AI `hint` fix, auth reset, team/billing polish, macro rollback, pii test fix | none | DONE |
| 2 | M2: Admin Security & Auth Resilience | AdminGuard unlock fix, admin-auth resilience, AI config passkey headers, admin test fix | none | DONE |
| 3 | M3: Admin Feature Flags, Global Macros & Real-Time Sync | Feature flags persistence, global macros broadcast API + CRUD, realtime channels, dynamic quota | M1, M2 | DONE |
| 4 | M4: E2E Verification & Multi-Package Build Integrity | Static type checks, unit tests, production builds across web/api/ext, challenger & forensic audit | M1, M2, M3 | DONE |

## Interface Contracts
### Extension ↔ API
- `POST /api/drafts/generate`: `{ threadContent: string, macroHint?: string, customPrompt?: string, tone?: string, model?: string }`
- Response: `{ draft: string, tokensUsed: number, provider: string, model: string }`

### Admin ↔ Server API
- `GET/POST /api/admin/feature-flags`: Returns and updates feature flag settings with `x-admin-passkey` or bearer auth.
- `POST /api/admin/global-macros/broadcast`: Broadcasts macro definitions to all teams using service role.

## Code Layout
- `packages/web`: Next.js 14 frontend and admin console (`src/components/dashboard`, `src/components/admin`, `src/app/api`)
- `packages/api`: NestJS backend microservice (`src/auth`, `src/drafts`, `src/macros`, `src/billing`)
- `packages/extension`: Chrome Extension Manifest V3 (`src/content`, `src/background`, `src/popup`, `src/sidepanel`, `src/utils`)
