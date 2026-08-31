## 2026-08-31T16:42:01Z
You are Worker M2 (Super Admin Security, Guards & Admin Auth Resilience).
Your working directory is: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m2/
You MUST first read the user request at: /home/md-roni-ahamed/Test project/ORIGINAL_REQUEST.md
Also read the project plan at: /home/md-roni-ahamed/Test project/PROJECT.md and Explorer 2 findings at: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_explorer_survey_admin/analysis.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusive Write Ownership:
- `packages/web/src/components/admin/AdminGuard.tsx`
- `packages/web/src/lib/admin-auth.ts`
- `packages/web/src/components/admin/AdminAIConfig.tsx`
- `packages/web/src/lib/__tests__/admin-auth.test.ts`

Scope & Tasks:
1. Fix `packages/web/src/components/admin/AdminGuard.tsx`:
   - Resolve passkey unlock deadlock. When `isAdminUnlocked` is `true` (unlocked via master security passkey), allow rendering the admin dashboard even if `user` is `null` (or initialize guest admin context), so direct master passkey console access works seamlessly without requiring pre-existing Supabase login.
   - Ensure session persistence in `sessionStorage` correctly restores `isAdminUnlocked = true` on refresh.
2. Fix `packages/web/src/lib/admin-auth.ts`:
   - Make `supabaseAdmin` initialization resilient: if `SUPABASE_SERVICE_ROLE_KEY` is not set or empty, provide a safe fallback client or lazy initialization with clear runtime warning instead of throwing unhandled `Error: supabaseKey is required` at module import time that crashes all importing admin routes.
3. Fix `packages/web/src/components/admin/AdminAIConfig.tsx`:
   - Include `x-admin-passkey` header in API fetch requests to `/api/admin/ai-config` so that passkey-authorized sessions can read and mutate AI configuration and model routing.
4. Fix `packages/web/src/lib/__tests__/admin-auth.test.ts`:
   - Fix `.ts` import specifier (import from `../admin-auth`) resolving TS5097 error.
5. Verification:
   - Run type check `tsc --noEmit -p packages/web/tsconfig.json`
   - Run unit test `node --experimental-strip-types --test packages/web/src/lib/__tests__/admin-auth.test.ts`
   - Run `next build` inside `packages/web`
6. Produce `handoff.md` and `changes.md` in your working directory `/home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m2/`.
Send a message when complete.
