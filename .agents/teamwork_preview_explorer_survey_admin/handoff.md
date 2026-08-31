# Super Admin Control Suite Survey — Handoff Report (`handoff.md`)

**Role**: Explorer 2 (Super Admin Control Suite Survey)  
**Milestone**: Investigation & Survey R2  
**Date**: 2026-08-31  
**Artifact Directory**: `/home/md-roni-ahamed/Test project/.agents/teamwork_preview_explorer_survey_admin/`

---

## 1. Observation

Direct code inspections, runtime tests, and type checks revealed the following factual observations:

1. **`AdminGuard.tsx` (Lines 38–44, 57–67, 147, 280, 324)**:
   - When an unauthenticated visitor enters the Master Security Passkey into the Login Gateway form, `handleAdminLogin` sets `sessionStorage.setItem('draftpilot_admin_unlocked', 'true')` and `setIsAdminUnlocked(true)`.
   - On re-render, line 147 `if (!user)` executes before any passkey checks and re-renders the Login Gateway form because `user` is `null`.
   - On page refresh, line 41 `if (isUnlocked === 'true' && isEmailAdmin)` ignores `sessionStorage` because `isEmailAdmin` evaluates to `false` when `user` is null.

2. **`admin-auth.ts` (Lines 4–8)**:
   - `export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });`
   - When `SUPABASE_SERVICE_ROLE_KEY` is not set or is an empty string, `@supabase/supabase-js` throws an unhandled `Error: supabaseKey is required.` at module import time, crashing all API routes that import `supabaseAdmin`.

3. **`AdminFeatureFlags.tsx` (Lines 15–65, 70–82, 95–102)**:
   - Flags are initialized from a local static array `INITIAL_FLAGS`.
   - `handleToggle(id)` only mutates component local state `flags`.
   - No backend API endpoint (`/api/admin/feature-flags`) or database table exists.
   - The "Sync with Edge CDN 🔄" button only invokes `setToast('Exported feature flag schema to edge workers.')`.

4. **`AdminGlobalMacros.tsx` (Lines 16–86)**:
   - Contains 4 hardcoded macro templates in `INITIAL_GLOBAL_MACROS`.
   - Has no controls, buttons, or dialogs for Creating, Editing, or Deleting global macros.
   - `handlePushAll` attempts to execute `supabase.from('macros').insert(...)` directly from the client browser. Because Supabase RLS enforces team-level ownership (`team_id IN (SELECT team_id FROM users WHERE id = auth.uid())`), inserting macros into foreign teams causes an RLS permission rejection.

5. **`AdminAIConfig.tsx` (Lines 90–93, 264–273)**:
   - Calls `/api/admin/ai-config` with `Authorization: Bearer ${token}`, but does not pass `x-admin-passkey`. If the token is missing, the API call returns 401.
   - Client-side fallback `supabase.from('platform_settings').upsert(...)` fails because Migration `005_secure_platform_settings.sql` restricts `platform_settings` table access strictly to `service_role`.

6. **`admin-auth.test.ts` (Line 3)**:
   - `import { verifySuperAdmin } from '../admin-auth.ts';` causes TypeScript compilation error: `TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled.`

7. **Build and Verification**:
   - `packages/web`: `next build` passes when invoked with proper working directory configuration.
   - `packages/api`: `nest build` compiles cleanly without errors.
   - `packages/extension`: `tsc -p tsconfig.json` reports 4 compilation errors (including missing `hint` in `api-client.ts:560`).

---

## 2. Logic Chain

1. **Passkey Deadlock**:
   - *Premise*: `AdminGuard.tsx` intended to provide direct root unlock via master passkey without requiring a pre-existing Supabase user session.
   - *Observation*: `handleAdminLogin` sets `isAdminUnlocked = true`, but the render tree checks `if (!user)` first.
   - *Deduction*: Without an active `user` in `AuthProvider`, the component will never render child routes, locking out passkey-only administrators.

2. **Backend Admin Persistence Health**:
   - *Observation*: `AdminWorkspaces` and `AdminBillingAnalytics` interact with `/api/admin/workspaces` and `/api/admin/billing`, which read and mutate the live `teams` table.
   - *Observation*: `AdminAIConfig` writes to `/api/admin/ai-config`, which mutates the singleton `platform_settings` table. Both `ai-provider.service.ts` and `api/drafts/generate/route.ts` read from `platform_settings`.
   - *Deduction*: Real-time updates for workspace limits, plans, and AI models propagate across the system as expected, except when unauthenticated passkey usage prevents API authorization in `AdminAIConfig`.

3. **Missing Admin Infrastructure**:
   - *Observation*: `AdminFeatureFlags` has no API routes, no table schema, and no state persistence.
   - *Observation*: `AdminGlobalMacros` lacks CRUD operations and attempts cross-tenant client-side writes blocked by RLS.
   - *Deduction*: Feature flags and global macros cannot fulfill platform management requirements without dedicated server endpoints and database tables.

---

## 3. Caveats

1. **Live Supabase Credentials**: The live remote Supabase instance was verified via read queries, but remote schema modifications (e.g. running new SQL migrations) require service role execution in the target database environment.
2. **AI Provider Sandbox**: In the playground of `AdminAIConfig`, test requests depend on a valid OpenRouter or OpenAI key; if keys are absent, the system falls back to the deterministic local support synthesizer.

---

## 4. Conclusion

The Super Admin Control Suite is well-structured and mostly connected to live backend models (`teams`, `users`, `platform_settings`, `draft_history`). However, full operational readiness requires addressing:
1. Passkey unlock deadlock in `AdminGuard.tsx`.
2. Missing service role key fallback in `admin-auth.ts`.
3. Persistent backend implementation for Feature Flags (`AdminFeatureFlags`).
4. Full CRUD operations and server-side broadcast endpoint for Global Macros (`AdminGlobalMacros`).
5. Uniform passkey header passing in `AdminAIConfig.tsx`.
6. TypeScript import syntax fix in `admin-auth.test.ts`.

---

## 5. Verification Method

To independently verify these findings, run:

1. **TypeScript Typecheck**:
   ```bash
   export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
   ./node_modules/.bin/tsc --noEmit -p packages/web/tsconfig.json
   ```
   *Expected result*: Highlights TS5097 error in `packages/web/src/lib/__tests__/admin-auth.test.ts:3`.

2. **Admin Auth Unit Tests**:
   ```bash
   export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
   SUPABASE_SERVICE_ROLE_KEY=test-key node --experimental-strip-types --test packages/web/src/lib/__tests__/admin-auth.test.ts
   ```
   *Expected result*: All 4 test cases pass when service role key is provided, but fails if key is empty without fallback.

3. **Web Production Build**:
   ```bash
   export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
   cd packages/web && ../../node_modules/.bin/next build
   ```
   *Expected result*: Next.js builds `/admin`, `/admin/login`, `/dashboard`, and all admin API routes cleanly.
