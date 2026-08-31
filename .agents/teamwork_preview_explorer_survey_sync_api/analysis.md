# Detailed Analysis Report: Cross-Party Sync, API Backend Architecture, & Build System Survey

**Surveyor**: Explorer 3  
**Date**: 2026-08-31  
**Scope**: `packages/api`, `packages/web`, `packages/extension`, Supabase Data Layer, Real-Time Event Sync, Build & TypeScript Validation  

---

## 1. Executive Summary

A comprehensive parallel investigation of the **DraftPilot** architecture was conducted to evaluate API backend design, multi-tenant data isolation, real-time cross-party state synchronization (between the User Dashboard `/dashboard`, Chrome Extension `packages/extension`, and SuperAdmin Command Center `/admin`), and the build/type-check health of all monorepo packages.

### Core Survey Findings:
1. **API & Data Architecture**: DraftPilot utilizes a high-performance multi-tier architecture. It features a NestJS backend (`packages/api`) on port 3001 for standalone and Swagger documentation operations, alongside Next.js 14 App Router API routes (`packages/web/src/app/api/`) for serverless edge execution. Database persistence and multi-tenancy are enforced via Supabase PostgreSQL with strict Row Level Security (RLS) policies and pgvector embeddings for knowledge base grounding.
2. **Cross-Party Real-Time Synchronization**:
   - **User -> Admin Propagation (Working & Resilient)**: User actions (draft generations in Gmail/web, macro creations, token usage) are logged into `draft_history` and `macros`. The SuperAdmin command center (`AdminOverview.tsx`, `AdminWorkspaces.tsx`, `AdminBillingAnalytics.tsx`) maintains active Supabase Realtime channels (`admin-live-metrics`, `admin-workspaces-live`, `admin-billing-live`) backed by an automatic 8-second polling fallback, providing real-time telemetry updates.
   - **Admin -> User Propagation (Partial / Specific Gaps Identified)**: Admin workspace quota/plan mutations propagate immediately to user context via `AuthProvider.tsx`, `BillingManager.tsx`, and `TeamManager.tsx` real-time listeners. AI model routing and system prompt updates in `AdminAIConfig.tsx` take immediate effect for draft generation. However, **Global Macro Broadcasts** (`AdminGlobalMacros.tsx`), **Overview Bento Draft Count** (`OverviewBento.tsx`), and **Feature Flags** (`AdminFeatureFlags.tsx`) lack reactive subscription triggers on the user client or persistent backend storage.
3. **Build & Static Typing Status**:
   - `packages/api`: `tsc` and `nest build` pass with **0 errors**.
   - `packages/web`: `next build` passes and compiles 10/10 routes successfully. `tsc` flags **1 syntax error** in `admin-auth.test.ts` (explicit `.ts` import extension).
   - `packages/extension`: `vite build` succeeds, but `tsc` flags **4 errors** (1 undefined variable bug `hint` in `api-client.ts:560`, and 3 test typing/extension issues in `pii-scrubber.test.ts`).

---

## 2. API Backend & Data Store Architecture

### 2.1 Backend Structure & Routing Matrix

| Layer | Module / Endpoint | Method | Purpose | Auth & Guards |
|---|---|---|---|---|
| **NestJS API** (`packages/api`) | `/auth/register` | `POST` | User registration & team auto-provision | Public |
| | `/auth/login` | `POST` | User authentication | Public |
| | `/auth/provision` | `POST` | OAuth post-login provisioning | Supabase JWT Header |
| | `/auth/me` | `GET` | User & team profile resolution | `AuthGuard` (Bearer) |
| | `/auth/onboarding` | `GET`, `PATCH` | Onboarding progress tracking | `AuthGuard` (Bearer) |
| | `/macros` | `GET`, `POST` | Team macro management | `AuthGuard` (Bearer) |
| | `/macros/:id` | `GET`, `PUT`, `DELETE` | Macro CRUD operations | `AuthGuard` (Bearer) |
| | `/drafts/generate` | `POST` | AI draft synthesis pipeline | `AuthGuard` (Bearer) |
| | `/billing/usage` | `GET` | Team draft usage vs quota | `AuthGuard` (Bearer) |
| | `/billing/checkout` | `POST` | Stripe subscription session | `AuthGuard` (Bearer) |
| | `/billing/portal` | `POST` | Stripe customer billing portal | `AuthGuard` (Bearer) |
| | `/billing/webhook` | `POST` | Stripe lifecycle events | Webhook Signature |
| **Next.js API** (`packages/web/src/app/api`) | `/api/auth/me` | `GET` | Profile and onboarding sync | Supabase JWT Bearer |
| | `/api/drafts/generate` | `POST` | AI draft generation with OpenRouter | Bearer + Sliding Rate Limiter |
| | `/api/admin/metrics` | `GET` | SuperAdmin executive telemetry | `verifySuperAdmin` |
| | `/api/admin/workspaces` | `GET`, `PATCH` | Workspace quota & plan overrides | `verifySuperAdmin` |
| | `/api/admin/billing` | `GET`, `PATCH` | Platform MRR/ARR & billing tiers | `verifySuperAdmin` |
| | `/api/admin/ai-config` | `GET`, `POST` | Global AI models & system prompt | `verifySuperAdmin` |

### 2.2 Data Models & Schema Design (`packages/api/supabase/migrations/`)

1. **`teams`**: Multi-tenant workspace entities (`id`, `name`, `plan`, `stripe_customer_id`, `stripe_subscription_id`, `monthly_draft_limit`, `created_at`).
2. **`users`**: Team-scoped user accounts (`id`, `team_id`, `email`, `role`, `full_name`, `avatar_url`, `created_at`).
3. **`team_members`**: Workspace membership junction (`team_id`, `user_id`, `role`, `joined_at`).
4. **`macros`**: Support templates (`id`, `team_id`, `name`, `category`, `content`, `tags`, `usage_count`, `created_at`, `updated_at`).
5. **`knowledge_documents`**: Uploaded KB files (`id`, `team_id`, `name`, `file_type`, `file_size`, `chunks_count`, `status`, `created_at`).
6. **`document_chunks`**: Chunked text with `vector(1536)` OpenAI embeddings for semantic match (`id`, `document_id`, `team_id`, `chunk_text`, `chunk_index`, `embedding`).
7. **`usage`**: Monthly tracking ledger (`id`, `team_id`, `month`, `draft_count`).
8. **`draft_history`**: Generation event log (`id`, `team_id`, `user_id`, `thread_snippet`, `generated_draft`, `macro_used_id`, `was_sent`, `created_at`).
9. **`platform_settings`**: SuperAdmin singleton configuration (`id`, `ai_provider`, `openrouter_api_key`, `openrouter_model`, `openai_api_key`, `anthropic_api_key`, `selected_model`, `system_prompt`, `temperature`, `max_tokens`, `updated_at`).
10. **`onboarding_state`**: Team onboarding step status (`team_id`, `gmail_connected`, `first_macro_added`, `extension_installed`, `viewed_demo`).

### 2.3 Multi-Tenant Isolation & Security Hardening
- Every database query strictly isolates records with `.eq('team_id', teamId)` or evaluates Postgres Row Level Security policies.
- Migration `005_secure_platform_settings.sql` restricts read/write access on `platform_settings` strictly to `service_role` (backend servers and Next.js edge API routes), preventing authenticated users from reading plaintext API keys.

---

## 3. Cross-Party Real-Time Synchronization Audit

### 3.1 Flow Matrix: User Actions -> Admin Real-Time View

| User Event | Trigger Location | Target DB Table | Admin Listener / Mechanism | Real-Time Status | Latency / Sync Behavior |
|---|---|---|---|---|---|
| **Draft Generation** | Extension (`api-client.ts`) / Web (`/api/drafts/generate`) | `draft_history` | `AdminOverview.tsx` (`admin-live-metrics`), `AdminWorkspaces.tsx` (`admin-workspaces-live`) | ✅ **Real-Time** | Instant via Supabase WebSocket + 8s polling interval fallback. Total draft counters and activity stream update live. |
| **Macro Creation** | Web (`MacrosManager.tsx`) / Extension (`sidepanel.ts`) | `macros` | `AdminOverview.tsx` (`admin-live-metrics`) | ✅ **Real-Time** | Instant via Supabase WebSocket + 8s polling interval. Total macros count updates live. |
| **New User Registration** | Web (`/join`, `AuthProvider.tsx`) | `users`, `teams` | `AdminOverview.tsx`, `AdminWorkspaces.tsx` | ✅ **Real-Time** | Instant via Supabase WebSocket + 8s polling interval. |
| **Token / Cost Analytics** | Draft Generation | `draft_history` | `AdminBillingAnalytics.tsx` (`admin-billing-live`) | ✅ **Real-Time** | Computed dynamically from draft volume and pricing multipliers. |

### 3.2 Flow Matrix: Admin Changes -> User Client & Extension

| Admin Action | Admin Component | Target DB Table / API | User Client Listener | Real-Time Status | Latency / Sync Behavior |
|---|---|---|---|---|---|
| **Workspace Quota / Limit Override** | `AdminWorkspaces.tsx` | `PATCH /api/admin/workspaces` -> `teams.monthly_draft_limit` | `AuthProvider.tsx` (`team-live-${teamId}`), `BillingManager.tsx` (`user-billing-live`) | ✅ **Real-Time** | Instant on web dashboard. Chrome extension refreshes quota on tab switch or draft generation. |
| **Workspace Plan Upgrade (Free -> Team)** | `AdminWorkspaces.tsx` / `AdminBillingAnalytics.tsx` | `PATCH /api/admin/billing` -> `teams.plan` | `AuthProvider.tsx`, `TeamManager.tsx` (`team-manager-live-${teamId}`) | ✅ **Real-Time** | Instant plan tier change, allocated seat expansion (1 -> 5 seats). |
| **AI Model & Prompt Tuning** | `AdminAIConfig.tsx` | `PATCH /api/admin/ai-config` -> `platform_settings` | Server-Side Draft Route (`/api/drafts/generate`) | ✅ **Immediate** | Next generation in extension or web queries updated `platform_settings` without requiring extension rebuild. |
| **Global Macro Distribution** | `AdminGlobalMacros.tsx` | Direct `macros` insertion across `teams` | `MacrosManager.tsx` (`packages/web`) | ⚠️ **Partial Gap** | Broadcast writes to database, but `MacrosManager.tsx` lacks `postgres_changes` listener (requires page refresh to appear). |
| **System Feature Flags** | `AdminFeatureFlags.tsx` | Local `useState` | Extension / Web Dashboard | ❌ **Missing Persistence** | Feature flag toggles exist only in local React state. Not persisted to `platform_settings` or queried by clients. |
| **Overview Bento Quota Display** | User Dashboard (`OverviewBento.tsx`) | `draft_history`, `macros` | `OverviewBento.tsx` | ⚠️ **Display Gap** | Quota progress in `OverviewBento.tsx:398` is hardcoded to `50` instead of referencing `dbUser.teams.monthly_draft_limit`. |

---

## 4. Build Configurations, TypeScript Configs, & Test Runners

### 4.1 Monorepo Build Scripts & Commands

Root `package.json` defines standard workspace orchestration commands:
- `pnpm dev`: Runs Next.js web application (`packages/web`) on port 3000.
- `pnpm dev:api`: Runs NestJS API (`packages/api`) in watch mode on port 3001.
- `pnpm dev:ext`: Runs Vite watch mode for Chrome Extension (`packages/extension`).
- `pnpm build:web`: Executes `next build` in `packages/web`.
- `pnpm build:api`: Executes `nest build` in `packages/api`.
- `pnpm build:ext`: Executes `vite build && cp manifest.json dist/ && cp -r icons dist/` in `packages/extension`.
- `pnpm test`: Executes `pnpm -r test`.
- `pnpm lint`: Executes `pnpm -r lint`.

### 4.2 TypeScript Configuration Hierarchy
- **Root**: `tsconfig.base.json` (Target: ES2022, ModuleResolution: bundler, strict: true, declaration: true).
- **`packages/api/tsconfig.json`**: Extends base, module: commonjs, moduleResolution: node, emitDecoratorMetadata: true, outDir: `./dist`.
- **`packages/web/tsconfig.json`**: Extends base, target: es5, jsx: preserve, moduleResolution: node, paths: `@/* -> ./src/*`.
- **`packages/extension/tsconfig.json`**: Extends base, lib: `["ES2022", "DOM", "DOM.Iterable"]`, types: `["chrome"]`, outDir: `./dist`.

### 4.3 Static Typing & Build Verification Results

| Package | Build Command | Result | TypeScript Check (`tsc --noEmit`) | Identified Errors & Bottlenecks |
|---|---|---|---|---|
| `packages/api` | `nest build` | ✅ **SUCCESS** | ✅ **0 errors** | Clean build and valid types. |
| `packages/web` | `next build` | ✅ **SUCCESS** (10/10 routes) | ❌ **1 error** | `packages/web/src/lib/__tests__/admin-auth.test.ts:3:34`: Import path ending in `.ts` extension (`../admin-auth.ts`). |
| `packages/extension` | `vite build` | ✅ **SUCCESS** (146ms) | ❌ **4 errors** | 1. `api-client.ts:560`: `Cannot find name 'hint'` (runtime variable bug).<br/>2. `pii-scrubber.test.ts:1`: `Cannot find module 'node:test'`.<br/>3. `pii-scrubber.test.ts:2`: `Cannot find module 'node:assert'`.<br/>4. `pii-scrubber.test.ts:3`: Explicit `.ts` extension on import. |

### 4.4 Test Runners Audit
- Test files located:
  - `packages/extension/src/utils/__tests__/pii-scrubber.test.ts` (7 test cases covering email, credit cards, SSN, phone numbers, addresses, tokens).
  - `packages/web/src/lib/__tests__/admin-auth.test.ts` (4 test cases covering missing header, non-Bearer scheme, empty token, invalid/expired token).
- Execution:
  - Node 22 native test runner (`node --experimental-strip-types --test packages/extension/src/utils/__tests__/pii-scrubber.test.ts`) passes **7/7 tests** in 94ms.
  - `admin-auth.test.ts` requires a fallback key string during initialization (`process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key'`) to avoid module instantiation errors in disconnected unit testing environments.

---

## 5. Identified Defects & Remediation Strategies

### Defect 1: Undefined Variable `hint` in `packages/extension/src/utils/api-client.ts`
- **Location**: `packages/extension/src/utils/api-client.ts:560`
- **Observation**:
  ```ts
  body: JSON.stringify({
    threadContent: scrubbed,
    macroHint: hint, // <-- ERROR: 'hint' is undefined. Parameter is macroHint
    matchedMacro,
    kbSnippets,
  })
  ```
- **Impact**: Invoking `generateDraft` in Chrome extension triggers `ReferenceError: hint is not defined` and fails TypeScript typecheck.
- **Remediation**: Change `macroHint: hint` to `macroHint: macroHint || ''`.

---

### Defect 2: Explicit `.ts` Extension in Test File Imports
- **Location**:
  - `packages/web/src/lib/__tests__/admin-auth.test.ts:3` (`import { verifySuperAdmin } from '../admin-auth.ts'`)
  - `packages/extension/src/utils/__tests__/pii-scrubber.test.ts:3` (`import { scrubPII } from '../pii-scrubber.ts'`)
- **Impact**: Fails standard TypeScript compilation with `error TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled.`
- **Remediation**: Remove `.ts` extension from import paths (`'../admin-auth'` and `'../pii-scrubber'`).

---

### Defect 3: Extension TypeScript Config Missing Node Types for Test Directory
- **Location**: `packages/extension/tsconfig.json`
- **Observation**: `tsconfig.json` includes `src/**/*` with `types: ["chrome"]`. It includes `src/utils/__tests__/pii-scrubber.test.ts` which uses `node:test` and `node:assert`.
- **Impact**: `tsc --noEmit -p packages/extension/tsconfig.json` throws `Cannot find module 'node:test'` and `Cannot find module 'node:assert'`.
- **Remediation**: Add `"exclude": ["src/**/__tests__/*"]` or configure test tsconfig / node types.

---

### Defect 4: Missing Reactive Subscription in `MacrosManager.tsx` and `OverviewBento.tsx`
- **Location**:
  - `packages/web/src/components/dashboard/MacrosManager.tsx`
  - `packages/web/src/components/dashboard/OverviewBento.tsx`
- **Observation**: Neither component subscribes to `postgres_changes` on `macros` or `draft_history`.
- **Impact**:
  1. When SuperAdmin broadcasts global macros in `AdminGlobalMacros.tsx`, customer dashboard macros list does not update until page refresh.
  2. When a user drafts an email in the Chrome extension, the Overview Bento draft counters don't update live.
  3. `OverviewBento.tsx:398` hardcodes `/ 50 drafts` quota limit.
- **Remediation**: Add `supabase.channel` subscriptions on `macros` and `draft_history` inside `MacrosManager.tsx` and `OverviewBento.tsx`, and bind `monthlyQuota` to `dbUser?.teams?.monthly_draft_limit || 50`.

---

### Defect 5: Feature Flags Lack Persistence and Propagation
- **Location**: `packages/web/src/components/admin/AdminFeatureFlags.tsx`
- **Observation**: State is stored in component memory `useState(INITIAL_FLAGS)` and never synced to Supabase or consulted by clients.
- **Remediation**: Persist feature flags into `platform_settings` table or a dedicated `feature_flags` table with Supabase Realtime subscriptions.

---

### Defect 6: Supabase Initialization Crash in Test Environments
- **Location**: `packages/web/src/lib/admin-auth.ts:4`
- **Observation**: `const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''` causes `createClient` to throw `Error: supabaseKey is required.` when imported during unit tests where environment variables are unset.
- **Remediation**: Provide a safe fallback: `process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key'`.
