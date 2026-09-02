# BRIEFING — 2026-09-02T21:18:00Z

## Mission
Implement Milestone 1: Super Admin User Deletion & Permission Registry (`banned_emails`), including database migration, admin users API, rich UI with confirmation modal & banned registry, auth and generation route guards, NestJS guard integration, extension error handling, and comprehensive unit/integration tests.

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa, specialist
- Working directory: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m1
- Original parent: a250ca04-2f7f-46da-a411-eefa65bc0a47
- Milestone: Milestone 1: Super Admin User Deletion & Permission Registry (banned_emails)

## 🔒 Key Constraints
- DO NOT CHEAT: No hardcoded test results, dummy implementations, or fake mocks. Genuine logic only.
- Follow minimal change principle and existing codebase architecture.
- Full verification with `pnpm test`, `pnpm build:web`, `pnpm build:api`, `pnpm build:ext`.
- Write handoff report to `.agents/teamwork_preview_worker_m1/handoff.md`.

## Current Parent
- Conversation ID: a250ca04-2f7f-46da-a411-eefa65bc0a47
- Updated: 2026-09-02T21:18:00Z

## Task Summary
- **What to build**:
  1. Supabase migration `007_banned_emails_registry.sql`
  2. Route `packages/web/src/app/api/admin/users/route.ts` (GET, POST ban/delete, DELETE/POST unban)
  3. UI Component `packages/web/src/components/admin/AdminUsers.tsx`
  4. Sidebar update `packages/web/src/components/admin/AdminSidebar.tsx`
  5. Admin page update `packages/web/src/app/admin/page.tsx`
  6. Guard intercept `packages/web/src/app/api/auth/me/route.ts`
  7. Guard intercept `packages/web/src/app/api/drafts/generate/route.ts`
  8. NestJS AuthGuard check `packages/api/src/auth/auth.guard.ts`
  9. Extension client intercept `packages/extension/src/utils/api-client.ts`
  10. Automated tests `packages/web/src/lib/__tests__/admin-users-ban.test.ts`
- **Success criteria**: All builds (`build:web`, `build:api`, `build:ext`) pass without errors. All 217 unit and integration tests pass.
- **Interface contracts**: PROJECT.md & handoff from survey explorer.
- **Code layout**: Monorepo with `packages/api`, `packages/web`, `packages/extension`.

## Key Decisions Made
- Implemented case-insensitive email normalization (`LOWER(email)` and `.trim().toLowerCase()`) across all endpoints and database migration to guarantee consistent access control regardless of casing.
- Implemented direct 403 Forbidden interception in extension API client (`api-client.ts`) with custom error tagging (`err.banned = true`) to prevent masking server deactivations with offline template synthesis.
- Implemented rich Super Admin UI (`AdminUsers.tsx`) featuring real-time statistics cards, active user table with deactivation modals, banned email registry table, custom email banning drawer, and 1-click permission restoration.

## Artifact Index
- `.agents/teamwork_preview_worker_m1/DISPATCH.md` — Assignment instructions
- `.agents/teamwork_preview_worker_m1/progress.md` — Progress tracker
- `.agents/teamwork_preview_worker_m1/BRIEFING.md` — Working memory and context
- `.agents/teamwork_preview_worker_m1/handoff.md` — Comprehensive handoff report

## Change Tracker
- **Files modified/created**:
  - `packages/api/supabase/migrations/007_banned_emails_registry.sql`: Created `banned_emails` table with lowercase unique index and service_role RLS.
  - `packages/web/src/app/api/admin/users/route.ts`: Created GET, POST, DELETE handlers for user management and ban registry.
  - `packages/web/src/components/admin/AdminUsers.tsx`: Created Super Admin user management and ban registry component.
  - `packages/web/src/components/admin/AdminSidebar.tsx`: Added `users` tab to `AdminTab` union and sidebar nav.
  - `packages/web/src/app/admin/page.tsx`: Integrated `AdminUsers` view into admin dashboard router.
  - `packages/web/src/app/api/auth/me/route.ts`: Added banned email check returning 403 Forbidden with `{ banned: true }`.
  - `packages/web/src/app/api/drafts/generate/route.ts`: Added banned email check returning 403 Forbidden before draft generation.
  - `packages/api/src/auth/auth.guard.ts`: Added banned email query throwing `ForbiddenException`.
  - `packages/extension/src/utils/api-client.ts`: Intercepted 403 Forbidden with banned flag without offline fallback.
  - `packages/web/src/lib/__tests__/admin-users-ban.test.ts`: Created comprehensive test suite.
- **Build status**: All builds (`build:web`, `build:api`, `build:ext`) passing.
- **Pending issues**: None.

## Quality Status
- **Build/test result**: All 217 tests pass (195 web + 13 api + 9 ext).
- **Lint status**: Clean.
- **Tests added/modified**: `packages/web/src/lib/__tests__/admin-users-ban.test.ts` (covers normalization, route auth, CRUD, gateway interception, extension client handling).

## Loaded Skills
- None specified.
