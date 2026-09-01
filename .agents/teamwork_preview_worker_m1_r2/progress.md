# Progress: Milestone 1 Security Hardening

Last visited: 2026-09-02T03:13:50Z

## Status: COMPLETE

### Completed Steps:
- [x] Task 1: Hardcoded Passkey Elimination & Constant-Time Auth
  - Removed all hardcoded passkey strings (`draftpilot-root-2026`, `admin2026`, `root`) from `admin-auth.ts`, `AdminGuard.tsx`, `admin/login/page.tsx`, and admin UI components.
  - Implemented `crypto.timingSafeEqual` in `admin-auth.ts` for constant-time evaluation against `process.env.ADMIN_PASSKEY || process.env.SUPERADMIN_PASSKEY`.
  - Fixed passkey omission bypass in `AdminLoginPage` and `AdminGuard`.
  - Cleaned all admin UI components to use session tokens and verified session passkeys.
- [x] Task 2: Stripe Webhook Signature Verification
  - Updated `packages/api/src/billing/billing.controller.ts` to inspect `stripe-signature` header and `req.rawBody`.
  - Added `constructWebhookEvent` in `packages/api/src/billing/billing.service.ts` using `stripe.webhooks.constructEvent`.
  - Rejection of unauthenticated webhooks in production when secret/signature is missing.
- [x] Task 3: Monthly Draft Quota & Usage Enforcement
  - Enforced monthly draft limit checks in `packages/web/src/app/api/drafts/generate/route.ts` against `teams` and `usage` tables.
  - Incremented draft generation count in `usage` table for current ISO month.
  - Added stale cache eviction to in-memory sliding-window rate limiter.
- [x] Task 4: HTTP Security Headers, CSP & Helmet
  - Strengthened Content-Security-Policy in `packages/web/next.config.js` (removed `unsafe-eval`, added `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'`).
  - Added `Strict-Transport-Security`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`.
  - Enabled `rawBody: true`, Helmet security headers middleware, and pinned CORS configuration in `packages/api/src/main.ts`.
- [x] Task 5: Verification & Tests
  - Updated existing tests in `admin-auth.test.ts`, `ai-pipeline.test.ts`, `challenger-interactive.test.ts`.
  - Added comprehensive test suites: `milestone1-security-hardening.test.ts` (Next.js) and `billing.controller.spec.ts` (NestJS).
  - Verified 100% test pass rate (79 web unit tests, 3 api unit tests, 7 extension unit tests) and successful builds across `@draftpilot/web`, `@draftpilot/api`, `@draftpilot/extension`.
