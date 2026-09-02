## 2026-09-02T21:07:08Z

You are a teamwork_preview_worker implementing Milestone 2: Root Passkey Vault & Dynamic Platform Settings.
Your working directory is: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m2
The workspace root is: /home/md-roni-ahamed/Test project

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY: Read these files first:
- /home/md-roni-ahamed/Test project/.agents/ORIGINAL_REQUEST.md
- /home/md-roni-ahamed/Test project/PROJECT.md
- /home/md-roni-ahamed/Test project/.agents/teamwork_preview_explorer_survey_2/handoff.md

Your exclusive write ownership:
1. `packages/api/supabase/migrations/008_platform_settings_root_passkey.sql`: Add column `root_passkey TEXT` to `platform_settings` table.
2. `packages/web/src/lib/admin-auth.ts`: Implement dynamic root passkey resolution querying `platform_settings.root_passkey` with in-memory caching (30s TTL) and fallback to environment variables (`ADMIN_PASSKEY` / `SUPERADMIN_PASSKEY`), `timingSafeEqual` comparison, and cache invalidation method `setCachedRootPasskey()`.
3. `packages/web/src/app/api/admin/passkey/route.ts`: Implement GET (returns active passkey if authorized by verifySuperAdmin) and POST (validates passkey length >= 6, updates platform_settings.root_passkey via supabaseAdmin, invalidates cache, returns success).
4. `packages/web/src/components/admin/AdminPasskeyVault.tsx`: Create Vault card with Show/Hide toggle for current passkey, copy button with visual feedback, update input with Show/Hide toggle, save button that persists to `/api/admin/passkey` and syncs `sessionStorage.setItem('draftpilot_admin_passkey', newPasskey)`.
5. `packages/web/src/components/admin/AdminOverview.tsx`: Integrate `<AdminPasskeyVault />` into the Super Admin Overview page.
6. `packages/web/src/lib/__tests__/admin-passkey-vault.test.ts`: Write comprehensive automated tests verifying GET/POST passkey routes, dynamic resolution, cache invalidation, and session authorization.

Run test and build commands to verify:
`pnpm test`
`pnpm build:web`
`pnpm build:api`
`pnpm build:ext`

Write your comprehensive handoff report to: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m2/handoff.md
Send a completion message when done.
