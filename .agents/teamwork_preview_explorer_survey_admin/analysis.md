# Super Admin Control Suite Diagnosis & Inventory Report (`analysis.md`)

**Date**: 2026-08-31  
**Agent**: Explorer 2 (Super Admin Control Suite Survey)  
**Target Areas**: `/admin`, `/admin/login`, `packages/web/src/components/admin/*`, `packages/web/src/app/api/admin/*`, `packages/api/supabase/migrations/*`

---

## 1. Executive Summary

This investigation covers **Requirement R2 (Super Admin Control Suite Diagnosis)** for DraftPilot. We conducted a comprehensive code audit across all super admin modules, authentication guards, server API routes, database schemas, and state persistence lifecycles.

### Key Takeaways:
1. **Admin Architecture**: The admin command center `/admin` uses Next.js 14 App Router with client-side sub-tab routing (`AdminOverview`, `AdminWorkspaces`, `AdminAIConfig`, `AdminGlobalMacros`, `AdminBillingAnalytics`, `AdminFeatureFlags`, `GmailSyncManager`) protected by `<AdminGuard>`.
2. **Persistence Reality**:
   - **Workspaces & Billing Analytics**: Fully connected to live database tables (`teams`, `users`, `draft_history`, `usage`) with functioning server API endpoints (`/api/admin/workspaces`, `/api/admin/billing`).
   - **AI Configuration**: Fully connected to `platform_settings` table via `/api/admin/ai-config` and mirrored in `localStorage` and backend services (`drafts.service.ts`, `ai-provider.service.ts`).
   - **Feature Flags (`AdminFeatureFlags`)**: 100% ephemeral in-memory mock state. No API endpoint, no database table, and no backend or extension synchronization.
   - **Global Macros (`AdminGlobalMacros`)**: Lacks CRUD capabilities (Create/Edit/Delete). The "Broadcast" function attempts direct client-side insertion into foreign teams, which is blocked by Supabase Row-Level Security (RLS).
3. **Security & Guarding**:
   - Master security passkey login in `AdminGuard.tsx` suffers from a deadlock where unauthenticated passkey unlock is blocked by an unfulfilled `!user` check.
   - Missing `SUPABASE_SERVICE_ROLE_KEY` in environment causes an immediate crash when importing `admin-auth.ts`.
   - TypeScript extension error in `admin-auth.test.ts:3` (`.ts` import path).

---

## 2. Complete Inventory of Admin Controls & Action Buttons

| Component / Route | Control / Element | Handler / Dispatch Target | State / Persistence Status | Verified Behavior |
|---|---|---|---|---|
| **`AdminLoginPage`** (`/admin/login`) | Sign In Form (`email`, `password`, `passkey`) | `supabase.auth.signInWithPassword` + whitelist check | Persists Supabase session & `sessionStorage('draftpilot_admin_unlocked')` | ✅ Functional with valid user credentials. |
| **`AdminGuard`** (`AdminGuard.tsx`) | Master Passkey Direct Unlock | `handleAdminLogin` / `handleUnlockWithPasskey` | `sessionStorage('draftpilot_admin_unlocked')` | ⚠️ **BUG**: When `user === null`, passkey unlock fails to display dashboard because `if (!user)` takes precedence. |
| **`AdminGuard`** (`AdminGuard.tsx`) | Google Sign-In for Admin | `handleAdminGoogleSignIn` (`supabase.auth.signInWithOAuth`) | Redirects to `/admin` via OAuth | ✅ Functional |
| **`AdminSidebar`** (`AdminSidebar.tsx`) | Tab Switchers (7 tabs) | `onTabChange(tab)` | React state `activeTab` in `AdminPage` | ✅ Functional |
| **`AdminSidebar`** (`AdminSidebar.tsx`) | Search Input | `onSearchChange(q)` | React state `searchQuery` in `AdminPage` | ⚠️ UI only: `searchQuery` is not consumed by sub-tabs. |
| **`AdminSidebar`** (`AdminSidebar.tsx`) | Lock Admin Console | `sessionStorage.removeItem(...)` + `reload()` | Removes session unlock state | ✅ Functional |
| **`AdminOverview`** (`AdminOverview.tsx`) | Refresh Data Button | `fetchLiveMetrics()` → `GET /api/admin/metrics` | Refreshes telemetry, metrics, recent drafts | ✅ Functional (Real-time polling & Postgres channel) |
| **`AdminOverview`** (`AdminOverview.tsx`) | "View Workspaces →" Link | `onSelectWorkspaceTab()` | Switches tab to `workspaces` | ✅ Functional |
| **`AdminOverview`** (`AdminOverview.tsx`) | Quick Nav Buttons (Workspaces / AI Config) | `onSelectWorkspaceTab()`, `onSelectAiConfigTab()` | Switches active tab | ✅ Functional |
| **`AdminWorkspaces`** (`AdminWorkspaces.tsx`) | Search & Plan Filter | `setSearch()`, `setFilterPlan()` | Client-side filter | ✅ Functional |
| **`AdminWorkspaces`** (`AdminWorkspaces.tsx`) | Quick Quota Boost (`+500`) | `handleQuickBoost` → `PATCH /api/admin/workspaces` | Updates `teams.monthly_draft_limit` in Supabase | ✅ Functional with live database mutation |
| **`AdminWorkspaces`** (`AdminWorkspaces.tsx`) | Override Limit Modal Trigger | `handleOpenOverride(ws)` | Opens modal with quota & plan form | ✅ Functional |
| **`AdminWorkspaces`** (`AdminWorkspaces.tsx`) | Save Changes in Override Modal | `handleSaveOverride` → `PATCH /api/admin/workspaces` | Mutates `teams.plan` & `teams.monthly_draft_limit` | ✅ Functional |
| **`AdminBillingAnalytics`** (`AdminBillingAnalytics.tsx`) | Refresh Revenue Button | `fetchBillingData()` → `GET /api/admin/billing` | Recalculates MRR, ARR, ARPA, conversion | ✅ Functional |
| **`AdminBillingAnalytics`** (`AdminBillingAnalytics.tsx`) | Plan Filter & Search | `setPlanFilter()`, `setSearch()` | Client-side filter | ✅ Functional |
| **`AdminBillingAnalytics`** (`AdminBillingAnalytics.tsx`) | Modify Plan Button & Modal | `openPlanModal(ws)`, `handleUpdatePlan` → `PATCH /api/admin/billing` | Mutates `teams.plan` & `monthly_draft_limit` | ✅ Functional |
| **`AdminFeatureFlags`** (`AdminFeatureFlags.tsx`) | Feature Flag Toggles (6 flags) | `handleToggle(id)` | **Local React state only (`flags`)** | ❌ **NON-FUNCTIONAL**: Does NOT persist to backend/DB. |
| **`AdminFeatureFlags`** (`AdminFeatureFlags.tsx`) | Sync with Edge CDN Button | `setToast(...)` | Mock Toast only | ❌ **NON-FUNCTIONAL**: No network call. |
| **`AdminGlobalMacros`** (`AdminGlobalMacros.tsx`) | Broadcast to All Customer Workspaces | `handlePushAll` → `supabase.from('macros').insert(...)` | Direct client-side insert into Supabase | ❌ **BROKEN**: Fails under Supabase RLS policies; creates duplicates. |
| **`AdminGlobalMacros`** (`AdminGlobalMacros.tsx`) | Create / Edit / Delete Macro | None (Missing from UI) | N/A | ❌ **MISSING**: No CRUD controls present in component. |
| **`AdminAIConfig`** (`AdminAIConfig.tsx`) | AI Provider Cards (OpenRouter, OpenAI, Offline) | `setProvider(p.id)` | Syncs to `localStorage` + `platform_settings` | ✅ Functional |
| **`AdminAIConfig`** (`AdminAIConfig.tsx`) | API Key Inputs & Show/Hide | `handleOpenRouterKeyChange`, `setOpenaiKey` | Syncs to `localStorage` | ✅ Functional |
| **`AdminAIConfig`** (`AdminAIConfig.tsx`) | Verify Key Button | `handleVerifyKey` | Tests key via OpenRouter/OpenAI REST API | ✅ Functional |
| **`AdminAIConfig`** (`AdminAIConfig.tsx`) | Model Selector & Custom Slug | `setOpenrouterModel`, `setCustomOpenrouterModel` | LocalStorage + `platform_settings` | ✅ Functional |
| **`AdminAIConfig`** (`AdminAIConfig.tsx`) | Sliders (Temperature, Max Tokens) | `setTemperature`, `setMaxTokens` | LocalStorage + `platform_settings` | ✅ Functional |
| **`AdminAIConfig`** (`AdminAIConfig.tsx`) | System Prompt Textarea | `setSystemPrompt` | LocalStorage + `platform_settings` | ✅ Functional |
| **`AdminAIConfig`** (`AdminAIConfig.tsx`) | Live Playground Generate Button | `handleTestDraft` | Live OpenRouter API dispatch with fallback | ✅ Functional |
| **`AdminAIConfig`** (`AdminAIConfig.tsx`) | Deploy Configuration Button | `handleSaveConfig` → `POST /api/admin/ai-config` | Upserts `platform_settings` in Supabase | ⚠️ Functional with Bearer token; fails if passkey-only due to missing header. |

---

## 3. Detailed Breakdown of Identified Bugs & Remediation Strategies

### Issue 1: `AdminGuard.tsx` Passkey-Only Unlock Deadlock
- **Severity**: P0 (High)
- **File & Lines**: `packages/web/src/components/admin/AdminGuard.tsx:38-44, 57-67, 147, 280, 324`
- **Observed Behavior**:
  When a user visits `/admin` and enters the Master Passkey (`draftpilot-root-2026`) in the Login Gateway without logging into a Supabase user account:
  1. `handleAdminLogin` sets `isAdminUnlocked = true` and `sessionStorage('draftpilot_admin_unlocked', 'true')`.
  2. Because `user` is `null`, line 147 `if (!user)` triggers on re-render and continuously re-renders the Login Gateway.
  3. On page reload, `isUnlocked === 'true' && isEmailAdmin` is evaluated; because `isEmailAdmin` is false, `isAdminUnlocked` remains false.
- **Remediation Strategy**:
  Allow `isAdminUnlocked === true` to bypass the unauthenticated visitor block or establish a simulated root admin session, allowing administrators with the master key to access the command console directly.

---

### Issue 2: `admin-auth.ts` Uncaught Error on Missing `SUPABASE_SERVICE_ROLE_KEY`
- **Severity**: P1 (High)
- **File & Lines**: `packages/web/src/lib/admin-auth.ts:4-8`
- **Observed Behavior**:
  `createClient(supabaseUrl, serviceRoleKey)` is called at top-level module load time. If `SUPABASE_SERVICE_ROLE_KEY` is undefined/empty string, `@supabase/supabase-js` throws `Error: supabaseKey is required.` immediately upon importing the module, crashing all dependent API routes.
- **Remediation Strategy**:
  Fall back to `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'service-role-fallback'` so that module importation remains robust during builds, offline runs, and automated testing.

---

### Issue 3: `AdminFeatureFlags.tsx` Ephemeral Mock State
- **Severity**: P1 (High)
- **File & Lines**: `packages/web/src/components/admin/AdminFeatureFlags.tsx:15-83, 95-102`
- **Observed Behavior**:
  - Feature flags are stored in a static hardcoded array `INITIAL_FLAGS` in React state.
  - Toggling flags updates only local state; on reload, values revert.
  - There is no API route `/api/admin/feature-flags` and no database table in Supabase.
  - "Sync with Edge CDN 🔄" executes a dummy timeout toast without network dispatch.
- **Remediation Strategy**:
  1. Add a `feature_flags` table or persist flags within `platform_settings` JSONB.
  2. Implement `GET` and `PATCH` handlers in `/api/admin/feature-flags/route.ts` with `verifySuperAdmin`.
  3. Connect `AdminFeatureFlags.tsx` to fetch flags on mount and persist toggles on change.

---

### Issue 4: `AdminGlobalMacros.tsx` Missing CRUD & Broken Broadcast Due to RLS
- **Severity**: P1 (High)
- **File & Lines**: `packages/web/src/components/admin/AdminGlobalMacros.tsx:16-86`
- **Observed Behavior**:
  1. **Missing CRUD**: No UI exists to create new global macros, modify existing ones, or delete them.
  2. **RLS Violation**: `handlePushAll` calls `supabase.from('macros').insert(inserts)` from the client browser. Since Supabase RLS restricts `macros` table mutations to the user's own `team_id`, inserting into other teams fails with an RLS policy violation.
  3. **No Deduplication**: `handlePushAll` performs blind inserts without checking for existing macro names.
- **Remediation Strategy**:
  1. Add Create Macro, Edit Macro, and Delete Macro modals/buttons with interactive state.
  2. Create a secure server-side endpoint `/api/admin/macros/broadcast/route.ts` using `supabaseAdmin` to distribute macros across all customer workspaces idempotently.

---

### Issue 5: Missing `x-admin-passkey` in `AdminAIConfig.tsx`
- **Severity**: P2 (Medium)
- **File & Lines**: `packages/web/src/components/admin/AdminAIConfig.tsx:90-93, 264-273`
- **Observed Behavior**:
  Unlike `AdminOverview`, `AdminWorkspaces`, and `AdminBillingAnalytics`, `AdminAIConfig` only sends `Authorization: Bearer ${token}` to `/api/admin/ai-config`. If the admin is authenticated via root passkey or token is expired, the request is rejected with 401. The fallback to client-side `supabase.from('platform_settings')` then fails because RLS restricts `platform_settings` to `service_role`.
- **Remediation Strategy**:
  Add `'x-admin-passkey': 'draftpilot-root-2026'` to the headers in `AdminAIConfig.tsx` fetch requests.

---

### Issue 6: TypeScript TS5097 Error in `admin-auth.test.ts`
- **Severity**: P2 (Medium)
- **File & Lines**: `packages/web/src/lib/__tests__/admin-auth.test.ts:3`
- **Observed Behavior**:
  `import { verifySuperAdmin } from '../admin-auth.ts';` causes `error TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled.` during TypeScript compilation.
- **Remediation Strategy**:
  Remove the `.ts` extension from the import path (`from '../admin-auth'`).

---

### Issue 7: UI Inconsistencies & Unused State
- **Severity**: P3 (Low)
- **File & Lines**:
  - `packages/web/src/app/admin/page.tsx:16` (`searchQuery` not connected to sub-tabs).
  - `packages/web/src/components/admin/AdminOverview.tsx:16, 206-218` (Dead `overrideSuccess` state).
  - `packages/web/src/app/admin/page.tsx:71` (Security tab renders client component `GmailSyncManager` instead of admin audit logs).
- **Remediation Strategy**:
  Connect sidebar search to workspace and macro filtering; clean up dead state; enhance security tab with admin-specific audit logs.

---

## 4. Cross-System Data Synchronization Verification (R3 Cross-Match)

1. **Workspace Plan & Quota Updates**:
   - When modified in `AdminWorkspaces` or `AdminBillingAnalytics`, `teams` is updated in Supabase.
   - The user dashboard (`AuthProvider.tsx:254-283`) listens to Postgres changes on `teams` (`id=eq.${dbUser.team_id}`), instantly reflecting quota and plan upgrades without requiring a page refresh.
2. **AI Settings & Model Routing**:
   - When deployed from `AdminAIConfig`, `platform_settings` is updated.
   - `packages/api/src/drafts/ai-provider.service.ts` and `packages/web/src/app/api/drafts/generate/route.ts` read `platform_settings` to dynamically choose model, temperature, max tokens, and system prompts for all customer reply generations.
3. **Telemetry & Event Counts**:
   - `AdminOverview` and `AdminWorkspaces` subscribe to `draft_history` and `teams` real-time events. As users generate drafts via the extension or web interface, counters update in real-time.
