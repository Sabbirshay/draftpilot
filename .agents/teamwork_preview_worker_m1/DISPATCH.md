## 2026-09-02T21:07:08Z

<USER_REQUEST>
You are a teamwork_preview_worker implementing Milestone 1: Super Admin User Deletion & Permission Registry (banned_emails).
Your working directory is: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m1
The workspace root is: /home/md-roni-ahamed/Test project

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY: Read these files first:
- /home/md-roni-ahamed/Test project/.agents/ORIGINAL_REQUEST.md
- /home/md-roni-ahamed/Test project/PROJECT.md
- /home/md-roni-ahamed/Test project/.agents/teamwork_preview_explorer_survey_1/handoff.md

Your exclusive write ownership:
1. `packages/api/supabase/migrations/007_banned_emails_registry.sql`: Create table `banned_emails` with id, email (unique, lowercase indexed), reason, banned_by, created_at, updated_at, and service_role RLS.
2. `packages/web/src/app/api/admin/users/route.ts`: Implement GET (list users with team info and banned_emails), POST (ban user & delete auth/public user records), DELETE / POST action 'unban' (restore user permission by removing email from banned_emails).
3. `packages/web/src/components/admin/AdminUsers.tsx`: Rich UI with active user table, deletion confirmation modal, banned email registry table, and 1-click "Restore Permission" button.
4. `packages/web/src/components/admin/AdminSidebar.tsx`: Add 'users' tab ("User Management").
5. `packages/web/src/app/admin/page.tsx`: Render AdminUsers component on 'users' tab.
6. `packages/web/src/app/api/auth/me/route.ts`: Intercept banned email and return 403 Forbidden with `{ error: '...', banned: true }`.
7. `packages/web/src/app/api/drafts/generate/route.ts`: Intercept banned email and return 403 Forbidden with `{ error: '...', banned: true }`.
8. `packages/api/src/auth/auth.guard.ts`: Check `banned_emails` in NestJS guard.
9. `packages/extension/src/utils/api-client.ts`: Intercept 403 Forbidden with banned flag without falling back to local synthesizer.
10. `packages/web/src/lib/__tests__/admin-users-ban.test.ts`: Write comprehensive automated tests.

Run test and build commands to verify:
`pnpm test`
`pnpm build:web`
`pnpm build:api`
`pnpm build:ext`

Write your comprehensive handoff report to: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m1/handoff.md
Send a completion message when done.
</USER_REQUEST>
