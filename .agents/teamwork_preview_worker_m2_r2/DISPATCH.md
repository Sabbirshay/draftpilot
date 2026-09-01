## 2026-09-01T21:14:31Z
You are a Worker subagent for Milestone 2: Supabase RLS Policies, Secret Isolation & Server-Side PII Scrubbing.
Working directory: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m2_r2
Project root: /home/md-roni-ahamed/Test project
Parent orchestrator: 8fabfbde-14a6-45c2-92a6-be1ac01be3c1

Original Request: /home/md-roni-ahamed/Test project/.agents/ORIGINAL_REQUEST.md
PROJECT Plan: /home/md-roni-ahamed/Test project/PROJECT.md
Explorer Handoff: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_explorer_survey_r2_2/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Tasks for Milestone 2:
1. Supabase RLS Policy Hardening:
   - In `packages/api/supabase/migrations/003_strict_rls_security.sql` (and create `packages/api/supabase/migrations/006_harden_user_tenant_rls.sql`):
     - Update the `users` table RLS UPDATE policy so authenticated users can only update their own profile and CANNOT modify `team_id` or `role` (preventing cross-tenant workspace takeover).
     - Restrict the `teams` table INSERT policy so users cannot insert arbitrary paid plans (`plan = 'free'`, `monthly_draft_limit = 50`, `stripe_customer_id IS NULL`, `stripe_subscription_id IS NULL`).
2. Server-Side PII Scrubbing:
   - Create `packages/api/src/utils/pii-scrubber.ts` and `packages/web/src/lib/pii-scrubber.ts` (exporting `scrubPII`) supporting comprehensive redaction for Credit Cards (`[CARD_REDACTED]`), Emails (`[EMAIL_REDACTED]`), SSNs (`[SSN_REDACTED]`), Phone numbers (`[PHONE_REDACTED]`), Street Addresses / PO Boxes (`[ADDRESS_REDACTED]`), IPv4 (`[IP_REDACTED]`), API tokens (`[TOKEN_REDACTED]`), and Passwords (`[SECRET_REDACTED]`).
   - In `packages/api/src/drafts/drafts.service.ts`: Apply `scrubPII` to `threadContent` before sending prompt to AI provider and before inserting `thread_snippet` and `generated_draft` into `draft_history`.
   - In `packages/web/src/app/api/drafts/generate/route.ts`: Apply `scrubPII` to `threadContent` before building LLM prompt and before inserting `thread_snippet` and `generated_draft` into `draft_history`.
3. Client-Side Secret Cleanliness in `AdminAIConfig.tsx`:
   - In `packages/web/src/components/admin/AdminAIConfig.tsx`: Ensure API keys are handled securely and sensitive keys are not leaked into browser localStorage unnecessarily or expose admin secrets.
4. Verification:
   - Create or update unit tests (e.g. `packages/web/src/lib/__tests__/server-pii-scrubber.test.ts` or similar) verifying server-side PII scrubbing on all categories.
   - Run unit tests (`pnpm test`) and builds (`pnpm build:web`, `pnpm build:api`) to ensure 0 errors.
   - Document all changes and verification outputs in your handoff report at `/home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m2_r2/handoff.md`.
   - Send a message back when complete.
