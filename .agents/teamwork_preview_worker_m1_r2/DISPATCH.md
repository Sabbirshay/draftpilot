## 2026-09-02T03:04:28Z
You are a Worker subagent for Milestone 1: Authentication, Authorization, Admin Endpoints & Security Headers Hardening.
Working directory: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m1_r2
Project root: /home/md-roni-ahamed/Test project
Parent orchestrator: 8fabfbde-14a6-45c2-92a6-be1ac01be3c1

Original Request: /home/md-roni-ahamed/Test project/.agents/ORIGINAL_REQUEST.md
PROJECT Plan: /home/md-roni-ahamed/Test project/PROJECT.md
Explorer Handoff: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_explorer_survey_r2_1/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Tasks for Milestone 1:
1. Hardcoded Passkey Elimination & Constant-Time Auth:
   - In `packages/web/src/lib/admin-auth.ts`: Remove hardcoded passkey strings (`draftpilot-root-2026`, `admin2026`, `root`). Validate against `process.env.ADMIN_PASSKEY || process.env.SUPERADMIN_PASSKEY` using cryptographic constant-time comparison (`crypto.timingSafeEqual`). Ensure proper Supabase JWT Bearer authentication validation as fallback.
   - In `packages/web/src/components/admin/AdminGuard.tsx` & `packages/web/src/app/admin/login/page.tsx`: Remove hardcoded fallback passkeys and fix passkey omission bypass.
   - In `packages/web/src/components/admin/Admin*.tsx`: Clean up hardcoded `'x-admin-passkey': 'draftpilot-root-2026'` headers to use standard session token / authorization headers or secure admin auth.
2. Stripe Webhook Signature Verification:
   - In `packages/api/src/billing/billing.controller.ts` & `billing.service.ts`: Verify `stripe-signature` using `stripe.webhooks.constructEvent(req.rawBody, signature, secret)` when secret is present; reject unauthenticated webhook calls in production.
3. Monthly Draft Quota & Usage Enforcement:
   - In `packages/web/src/app/api/drafts/generate/route.ts`: Enforce monthly draft quota checks and increment draft usage count in the `usage` table for the current month.
4. HTTP Security Headers, CSP & Helmet:
   - In `packages/web/next.config.js`: Strengthen Content-Security-Policy (remove `unsafe-eval`, add `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`) and add HSTS, X-Frame-Options, X-Content-Type-Options headers.
   - In `packages/api/src/main.ts`: Enable `helmet()` middleware and configure CORS properly.
5. Verification:
   - Run unit tests (`pnpm test`) and relevant build commands. Update any test fixtures in `admin-auth.test.ts` if needed to match the hardened secure contract.
   - Document all changes and verification command outputs in your handoff report at `/home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m1_r2/handoff.md`.
   - Send a message back when complete.
