## 2026-08-31T16:47:42Z
You are Worker M3 (Super Admin Feature Flags, Global Macros CRUD, & Cross-Party Real-Time Sync).
Your working directory is: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m3/
You MUST first read the user request at: /home/md-roni-ahamed/Test project/ORIGINAL_REQUEST.md
Also read the project plan at: /home/md-roni-ahamed/Test project/PROJECT.md and survey findings in:
- /home/md-roni-ahamed/Test project/.agents/teamwork_preview_explorer_survey_admin/analysis.md
- /home/md-roni-ahamed/Test project/.agents/teamwork_preview_explorer_survey_sync_api/analysis.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusive Write Ownership:
- `packages/web/src/app/api/admin/feature-flags/route.ts`
- `packages/web/src/app/api/admin/global-macros/route.ts`
- `packages/web/src/components/admin/AdminFeatureFlags.tsx`
- `packages/web/src/components/admin/AdminGlobalMacros.tsx`
- `packages/web/src/components/dashboard/OverviewBento.tsx`
- `packages/web/src/components/dashboard/MacrosManager.tsx`

Scope & Tasks:
1. Feature Flags API & Persistence:
   - Create `packages/web/src/app/api/admin/feature-flags/route.ts`: Handle GET and POST requests with admin authorization via `verifySuperAdmin` (supporting Bearer token and `x-admin-passkey`). Return and persist feature flag configurations (e.g. into `platform_settings` table under `feature_flags` or storage).
   - Update `packages/web/src/components/admin/AdminFeatureFlags.tsx`: Load flags from `/api/admin/feature-flags` on mount, persist toggle changes and additions via POST to the endpoint, pass `x-admin-passkey` header, and handle CDN export actions.
2. Global Macros API & CRUD Management:
   - Create `packages/web/src/app/api/admin/global-macros/route.ts`:
     - Handle GET (fetch global macros catalog)
     - Handle POST (action: 'create' to add a global template, action: 'broadcast' to distribute a macro across all workspaces/teams in the database using `supabaseAdmin` service role to cleanly bypass client-side RLS)
     - Handle PUT (update a global macro definition)
     - Handle DELETE (delete a global macro)
   - Update `packages/web/src/components/admin/AdminGlobalMacros.tsx`:
     - Add interactive UI controls and modals for: "Create Global Macro", "Edit Macro", "Delete Macro", and "Broadcast Macro to All Workspaces".
     - Hook all actions into `/api/admin/global-macros` with `x-admin-passkey` and auth token headers.
3. Cross-Party Real-Time Synchronization:
   - Update `packages/web/src/components/dashboard/OverviewBento.tsx`:
     - Add Supabase Realtime channel subscription listening to `draft_history` (to automatically increment and refresh live drafts count when user generates drafts from Chrome Extension or web) and `teams` (to live update quota/plan).
     - Dynamically display the monthly free quota limit (e.g., `user?.teams?.monthly_draft_limit || 50`) instead of the static `/ 50 drafts`.
   - Update `packages/web/src/components/dashboard/MacrosManager.tsx`:
     - Add Supabase Realtime channel subscription listening to `postgres_changes` on the `macros` table for the user's `team_id`, so that global macros broadcasted by the admin (or macros created in the extension) immediately appear in the user's macro list in real-time without needing a manual page reload.
4. Verification:
   - Run type check `tsc --noEmit -p packages/web/tsconfig.json`
   - Run `next build` inside `packages/web`
   - Ensure all routes compile cleanly with 0 TypeScript/build errors.
5. Produce `handoff.md` and `changes.md` in your working directory `/home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m3/`.
Send a message when complete.
