# Handoff Report — Requirement 1: Super Admin User Deletion & Permission Registry

## Executive Summary
This investigation surveys the entire DraftPilot monorepo architecture across database migrations, Next.js web application, NestJS backend API, and Chrome extension to design and specify Requirement 1: **Super Admin User Deletion & Access Control Registry (`banned_emails`)**. It defines the persistent schema, interceptors across all authentication & AI draft generation entry points, Super Admin dashboard user management UI, and 1-click permission restoration mechanism.

---

## 1. Observation

### 1.1 Database Tables & Migrations
- **Location**: `packages/api/supabase/migrations/`
  - `001_initial_schema.sql`: Defines `teams`, `users`, `macros`, `knowledge_documents`, `document_chunks`, `usage`, `draft_history`.
  - `002_auth_onboarding.sql`: Adds `team_members` junction, `onboarding_state`, and profile fields (`full_name`, `avatar_url`) to `users`.
  - `003_strict_rls_security.sql`: Implements strict RLS for multi-tenant isolation and service role full bypass policies.
  - `004_platform_settings.sql` & `005_secure_platform_settings.sql`: Defines singleton `platform_settings` table restricted to `service_role`.
  - `006_harden_user_tenant_rls.sql`: Hardens `users` UPDATE and `teams` INSERT policies against privilege escalation.
- **Current Absence**: No `banned_emails` table or user deactivation registry currently exists in the schema.

### 1.2 User Storage & Authentication Architecture
- **Supabase Auth (`auth.users`)**: Manages identity, passwords, OAuth tokens, and `email_confirmed_at`.
- **Public Schema (`public.users`)**:
  - Schema: `id UUID PRIMARY KEY`, `team_id UUID REFERENCES teams(id) ON DELETE CASCADE`, `email TEXT NOT NULL`, `role TEXT NOT NULL DEFAULT 'owner'`, `full_name TEXT`, `avatar_url TEXT`, `created_at TIMESTAMPTZ`.
  - Foreign key cascades: `team_members.user_id`, `draft_history.user_id` cascade delete on user removal.
- **Client Session Provider (`packages/web/src/components/providers/AuthProvider.tsx`)**:
  - Calls `GET /api/auth/me` on mount and session change (lines 60-84) to fetch user profile, team data, and onboarding state.
  - Falls back to direct client-side Supabase query on `public.users` (lines 94-208).
- **NestJS Auth Guard (`packages/api/src/auth/auth.guard.ts`)**:
  - Intercepts bearer token, resolves user via `client.auth.getUser(token)`, and fetches `users` record (lines 21-38).

### 1.3 AI Draft Generation Endpoints & Interception Points
- **Web App API Route (`packages/web/src/app/api/drafts/generate/route.ts`)**:
  - Line 195-207: Authenticates caller via `supabaseAdmin.auth.getUser(token)`.
  - Line 209-231: Applies in-memory rate limiting.
  - Line 237-244: Fetches `dbUser` and `team_id`.
  - Line 251-283: Enforces workspace monthly quota.
  - Line 311-399: Calls OpenRouter upstream with Gemma fallback.
  - Line 402-417: Degrades to local 5-intent domain synthesizer if OpenRouter fails.
  - Line 422-448: Records event in `draft_history` and increments `usage`.
  - *Current Vulnerability*: Does not check for banned email status; deactivated users could continue generating drafts if tokens remain cached or if they call the endpoint.
- **Backend Service (`packages/api/src/drafts/drafts.service.ts`)**:
  - Protected by `AuthGuard` on `DraftsController.generate()` (`packages/api/src/drafts/drafts.controller.ts:10-18`).
- **Chrome Extension Client (`packages/extension/src/utils/api-client.ts`)**:
  - `generateDraft()` (lines 530-702): Sends request to `https://draftpilot-web.vercel.app/api/drafts/generate`.
  - Fallback logic (lines 603-665): Falls back to local template synthesizer on network error. Needs explicit distinction so HTTP 403 Forbidden with `banned: true` immediately terminates generation and alerts user rather than silently producing a fallback draft.

### 1.4 Admin Dashboard & Control Surface
- **Admin Page (`packages/web/src/app/admin/page.tsx`)**:
  - Renders tabs: `overview`, `workspaces`, `ai-config`, `global-macros`, `billing`, `security`, `features` (lines 41-48, 60-73).
- **Admin Sidebar (`packages/web/src/components/admin/AdminSidebar.tsx`)**:
  - Type `AdminTab` defines navigation options (lines 7-14).
- **Admin Security Guard (`packages/web/src/components/admin/AdminGuard.tsx`)**:
  - Validates `x-admin-passkey` via `/api/admin/metrics` or session token matching `SUPERADMIN_EMAILS` (lines 48-117).
- **Existing Admin API Routes (`packages/web/src/app/api/admin/*`)**:
  - `workspaces/route.ts`: Manages team plans and monthly draft quotas.
  - `metrics/route.ts`: Aggregates active workspaces, draft counts, MRR, passkey verification.
  - `ai-config/route.ts`, `feature-flags/route.ts`, `global-macros/route.ts`, `billing/route.ts`.

---

## 2. Logic Chain

1. **Persistent Banning Registry**:
   - Because user deletion in Supabase Auth removes the user record, deleting an account alone is insufficient to prevent re-registration or token replay with that same email address.
   - Therefore, a persistent access registry table (`banned_emails`) is necessary to store deactivated/banned email addresses with case-insensitive uniqueness (`LOWER(email)`).

2. **Full-Spectrum Enforcement / Gateway Blocking**:
   - When an email is present in `banned_emails`, access must be blocked at four distinct layers:
     - **Sign-Up Layer** (`AuthForm.tsx`, `packages/api/src/auth/auth.service.ts`): Block creation of new accounts with a banned email.
     - **Sign-In / Auth Provisioning Layer** (`/api/auth/me`, `AuthProvider.tsx`, `AuthGuard.ts`): Block session establishment, revoke tokens, and force logout with a clear deactivation banner.
     - **Dashboard Access Layer** (`/dashboard`, `DashboardPage.tsx`): Block rendering and redirect to sign-in with banner.
     - **AI Draft Generation Layer** (`/api/drafts/generate/route.ts`, `DraftsService.ts`, `api-client.ts`): Immediately reject draft generation requests with HTTP 403 Forbidden (`{ error: '...', banned: true }`) without triggering local offline fallback synthesizer.

3. **Super Admin User Management UI & 1-Click Restoration**:
   - In `AdminSidebar.tsx` and `AdminPage.tsx`, add a dedicated `users` tab ("User Management & Ban Registry").
   - Create `AdminUsers.tsx` component with:
     - Active Users Table: Full name, email, workspace name, role, draft usage, created date, and "Delete & Ban User" action.
     - Banned Users Registry Table: Banned email, reason, timestamp, and 1-click "Restore Permission" button.
     - Confirmation modal before account deletion to prevent accidental deletion.
   - Create `packages/web/src/app/api/admin/users/route.ts` to handle:
     - `GET`: Fetch active users (joined with team data) and all `banned_emails`.
     - `POST` / `DELETE` actions for `ban` (record in `banned_emails`, delete auth user & public user) and `unban` (delete from `banned_emails`).

---

## 3. Caveats & Edge Cases

1. **Email Case Sensitivity**:
   - Users may enter `User@Example.com` during signup or `user@example.com` in admin panels. All checks against `banned_emails` must strictly use `.toLowerCase().trim()` and SQL `LOWER(email) = LOWER($1)` with a functional or lowercase index (`idx_banned_emails_email`).

2. **Cascade Deletion Considerations**:
   - Deleting a user who is the sole `owner` of a workspace could leave orphaned teams or macros unless handled. The admin API route should either clean up the workspace if no other members exist, or reassign ownership if multiple members exist.

3. **Extension Offline Fallback Masking**:
   - The Chrome extension (`packages/extension/src/utils/api-client.ts`) includes a client-side fallback synthesizer for offline resilience. It must be explicitly configured NOT to fall back when the server returns HTTP 403 with `banned: true`.

4. **Service Role Security**:
   - `banned_emails` must have RLS enabled and be restricted to `service_role` to prevent normal authenticated users from reading the ban registry.

---

## 4. Conclusion & Concrete Specification

### 4.1 Required Database Migration: `007_banned_emails_registry.sql`
```sql
-- Migration 007: Persistent Banned Emails & Access Registry
CREATE TABLE IF NOT EXISTS banned_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  reason TEXT DEFAULT 'Banned by Super Admin',
  banned_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_banned_emails_lower_email ON banned_emails (LOWER(email));

ALTER TABLE banned_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service Role Full Access on Banned Emails"
  ON banned_emails
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### 4.2 Required Files to Create or Modify

| File Path | Action | Description |
|-----------|--------|-------------|
| `packages/api/supabase/migrations/007_banned_emails_registry.sql` | Create | Database schema and index for `banned_emails`. |
| `packages/web/src/app/api/admin/users/route.ts` | Create | Admin API endpoint for user listing, banning/deletion, and 1-click restoration. |
| `packages/web/src/components/admin/AdminUsers.tsx` | Create | Super Admin UI for user management, deletion modals, and banned registry table. |
| `packages/web/src/components/admin/AdminSidebar.tsx` | Modify | Add `'users'` tab ("User Management") to `AdminTab` enum and nav items. |
| `packages/web/src/app/admin/page.tsx` | Modify | Integrate `AdminUsers` view into tab router. |
| `packages/web/src/app/api/auth/me/route.ts` | Modify | Intercept banned emails and return 403 Forbidden with `{ banned: true }`. |
| `packages/web/src/app/api/drafts/generate/route.ts` | Modify | Intercept banned user emails before draft generation and return 403 Forbidden. |
| `packages/web/src/components/providers/AuthProvider.tsx` | Modify | Handle 403/banned response on session load, clear tokens, and display warning. |
| `packages/web/src/components/AuthForm.tsx` | Modify | Surface deactivation notice on banned login/signup attempts. |
| `packages/extension/src/utils/api-client.ts` | Modify | Handle 403 Forbidden without falling back to local synthesizer. |
| `packages/api/src/auth/auth.guard.ts` | Modify | Check `banned_emails` in NestJS backend guard. |
| `packages/api/src/auth/auth.service.ts` | Modify | Check `banned_emails` in NestJS `login()`, `register()`, and `provision()`. |
| `packages/web/src/lib/__tests__/admin-users-ban.test.ts` | Create | Comprehensive automated test suite verifying deletion, ban registry, interception, and restoration. |

---

## 5. Verification Method

1. **Automated Unit & Integration Tests**:
   - Run: `pnpm test` (verify all existing 112+ web tests, 13 NestJS tests, 9 extension tests pass, plus new admin ban tests).
   - Test Cases:
     - Verify Super Admin can list all users and banned registry via `GET /api/admin/users`.
     - Verify deleting/banning a user inserts lowercase email into `banned_emails` and deletes auth/public user records.
     - Verify banned user calling `/api/drafts/generate` receives HTTP 403 Forbidden with `{ banned: true }`.
     - Verify banned user calling `/api/auth/me` receives HTTP 403 Forbidden.
     - Verify 1-click restore removes email from `banned_emails` and allows access again.

2. **Full Monorepo Production Builds**:
   - `pnpm build:web` (Next.js production build verification)
   - `pnpm build:api` (NestJS production build verification)
   - `pnpm build:ext` (Vite extension production build verification)
