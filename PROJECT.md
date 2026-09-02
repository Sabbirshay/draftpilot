# Project: DraftPilot Super Admin & Auth Hardening

## Architecture
DraftPilot is a monorepo consisting of:
- **`packages/web` (`@draftpilot/web`)**: Next.js 14 App Router, React 18, Tailwind CSS, Framer Motion, Supabase JS Client.
- **`packages/api` (`@draftpilot/api`)**: NestJS 10 backend, Express, Supabase JS Client, Stripe.
- **`packages/extension` (`@draftpilot/extension`)**: Chrome Manifest V3 extension, Vite 5, TypeScript.
- **`packages/api/supabase/migrations`**: PostgreSQL database migrations with Row Level Security (RLS).

Data Flow & Security:
- Super Admin access is secured via dynamic Root Passkeys (stored in `platform_settings` table, cached in memory with 30s TTL, evaluated with `crypto.timingSafeEqual`) and client `sessionStorage` synchronization.
- User access control is enforced globally via `banned_emails` registry, blocking registration, authentication, dashboard access, and AI draft generation.
- User registration requires mandatory email verification before dashboard entry with an actionable resend mechanism.

## Feature Inventory
| # | Feature | Description | Milestone | Status |
|---|---------|-------------|-----------|--------|
| F1 | `banned_emails` DB Migration | Schema and index for persistent access registry with service_role RLS | M1 | DONE |
| F2 | Admin User Management API | `GET, POST, DELETE /api/admin/users` for listing, banning/deleting, and restoring | M1 | DONE |
| F3 | Gateway Ban Interception | Block banned emails across `/api/auth/me`, `/api/drafts/generate`, NestJS `AuthGuard`, `AuthProvider`, `AuthForm`, and Chrome extension | M1 | DONE |
| F4 | Super Admin User UI & 1-Click Restore | `AdminUsers.tsx` with user list, ban action, banned registry table, and 1-click restore | M1 | DONE |
| F5 | `platform_settings.root_passkey` Migration | Database migration to add `root_passkey` to `platform_settings` singleton | M2 | DONE |
| F6 | Dynamic Root Passkey Engine | Dynamic DB passkey loader with 30s TTL cache, fallback to env, immediate cache invalidation | M2 | DONE |
| F7 | Admin Passkey API | `GET, POST /api/admin/passkey` secured by `verifySuperAdmin` | M2 | DONE |
| F8 | Root Passkey Vault UI Card | `AdminPasskeyVault.tsx` with Show/Hide toggle, copy button, dynamic update, `sessionStorage` sync | M2 | DONE |
| F9 | Mandatory Signup Email Banner | Clear banner on signup `"Check your inbox! Please verify your email before logging in."`, suppress auto-redirect, sign out temporary session | M3 | DONE |
| F10 | Unverified Login Block & Resend Button | Detect `email_confirmed_at === null` / `"Email not confirmed"`, block dashboard redirect, sign out, render "Resend Verification Email" button | M3 | DONE |
| F11 | Dashboard & AuthProvider Verification Guard | Prevent unverified sessions from loading dashboard profile; redirect to login | M3 | DONE |
| F12 | Supabase Auth Settings Documentation | Detailed project settings guide for Confirm Email, SMTP, redirect URLs | M3 | DONE |
| F13 | Full E2E Test Suite (Tiers 1-4) | Comprehensive requirement-driven opaque-box test suite (45 tests) | M4 | DONE |
| F14 | Adversarial Coverage Hardening (Tier 5) | White-box stress tests, edge cases, and attack vectors (14 tests) | M4 | DONE |
| F15 | Multi-Package Build Integrity | Verify `pnpm test`, `pnpm build:web`, `pnpm build:api`, `pnpm build:ext` all exit with 0 errors | M4 | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Super Admin User Deletion & Ban Registry | F1, F2, F3, F4 | none | DONE |
| M2 | Root Passkey Vault & Dynamic Platform Settings | F5, F6, F7, F8 | none | DONE |
| M3 | Mandatory Email Verification Flow | F9, F10, F11, F12 | none | DONE |
| M4 | Final E2E Suite Pass, Adversarial Hardening & Monorepo Build Verification | F13, F14, F15 | M1, M2, M3, TEST_READY | DONE |

## Interface Contracts
### Admin Users API (`/api/admin/users`)
- `GET /api/admin/users`: Header `x-admin-passkey` or Superadmin Bearer token -> Returns `{ success: true, users: Array<{ id, email, full_name, role, team_name, drafts_count, created_at }>, bannedEmails: Array<{ id, email, reason, banned_by, created_at }> }`
- `POST /api/admin/users`: Header `x-admin-passkey` -> Body `{ action: 'ban', email: string, reason?: string, deleteUser?: boolean }` -> Inserts `LOWER(email)` into `banned_emails`, deletes auth user if requested.
- `DELETE /api/admin/users`: Header `x-admin-passkey` -> Query `?email=...` or Body `{ action: 'unban', email: string }` -> Deletes `LOWER(email)` from `banned_emails`.

### Admin Passkey API (`/api/admin/passkey`)
- `GET /api/admin/passkey`: Header `x-admin-passkey` -> Returns `{ success: true, passkey: string }`
- `POST /api/admin/passkey`: Header `x-admin-passkey` -> Body `{ newPasskey: string }` (min length 6) -> Updates `platform_settings.root_passkey`, invalidates memory cache, returns `{ success: true, message: string }`.

### Ban Interception Response Contract
- Any banned user calling `/api/auth/me` or `/api/drafts/generate` -> HTTP 403 Forbidden with JSON `{ error: 'Account deactivated. Please contact support.', banned: true }`.

### Email Verification Contract
- Signup response: If email verification required, `signUpData.session` is invalidated via `supabase.auth.signOut()`, banner displayed.
- Signin response: If `user.email_confirmed_at === null` or error contains `"email not confirmed"`, session invalidated via `supabase.auth.signOut()`, unverified warning displayed with `Resend Verification Email` action.
- Resend action: Calls `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${origin}/auth/callback` } })`.

## Code Layout
- `packages/api/supabase/migrations/`:
  - `007_banned_emails_registry.sql`
  - `008_platform_settings_root_passkey.sql`
- `packages/web/src/`:
  - `lib/admin-auth.ts`: Dynamic passkey cache, verification helpers, constant-time `timingSafeEqual`.
  - `app/api/admin/users/route.ts`: User listing, ban, delete, unban API.
  - `app/api/admin/passkey/route.ts`: Passkey retrieval & update API.
  - `app/api/auth/me/route.ts`: User session validation with ban check.
  - `app/api/drafts/generate/route.ts`: AI draft generation with ban check.
  - `components/admin/AdminUsers.tsx`: User management & ban registry UI.
  - `components/admin/AdminPasskeyVault.tsx`: Passkey vault card with Show/Hide toggle.
  - `components/admin/AdminOverview.tsx`: Integration of passkey vault.
  - `components/admin/AdminSidebar.tsx`: Add Users tab.
  - `app/admin/page.tsx`: Route to Users tab.
  - `components/AuthForm.tsx`: Email verification banner, unverified login block, resend button, ban deactivation message.
  - `components/providers/AuthProvider.tsx`: Guard against unverified / banned sessions.
  - `app/dashboard/page.tsx`: Guard unverified users.
  - `lib/__tests__/`: Unit and integration test suites.
- `packages/api/src/`:
  - `auth/auth.guard.ts`: Ban check in NestJS guard.
- `packages/extension/src/`:
  - `utils/api-client.ts`: Immediate termination on 403 banned response.
