# Original User Request

## Initial Request — 2026-09-01T05:50:58Z

You are the Project Orchestrator for this task.

Working directory: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_orchestrator_1
Project root: /home/md-roni-ahamed/Test project
Original Request: /home/md-roni-ahamed/Test project/ORIGINAL_REQUEST.md

Task Summary:
Validate why OpenRouter rate-limit / daily limit alerts are triggered, verify the live upstream OpenRouter API responses (/api/v1/chat/completions), enhance the Admin AI Config key verification to query /api/v1/auth/key for real-time balance and usage statistics, and ensure transparent upstream error reporting in the admin playground.

Integrity mode: development

Requirements:
1. Live OpenRouter Upstream Response Validation & Diagnosis: Audit the exact upstream HTTP response returned by OpenRouter during live test draft generations. Differentiate between free-tier daily account caps (50 req/day on $0 balance), per-minute concurrency limits (20 req/min), model-specific queue congestion (busy free models), and invalid/unauthenticated keys.
2. Real-Time Key Quota & Balance Telemetry: Upgrade `handleVerifyKey` in `AdminAIConfig.tsx` to query `https://openrouter.ai/api/v1/auth/key` and display live account telemetry (key label, usage amount, remaining credit limit, rate limit interval, and free-tier status).
3. Verbatim Error & Advisory UI: Update the playground rate-limit banner in `AdminAIConfig.tsx` to show the verbatim upstream error message from OpenRouter, along with actionable instructions to resolve it and immediate fallback preview.
4. Build & Test Verification: Run full monorepo test suites (`pnpm test`) and production builds (`pnpm build:web`, `pnpm build:api`, `pnpm build:ext`) to guarantee zero regressions.

Please maintain your `BRIEFING.md`, `plan.md`, and `progress.md` in your working directory. Coordinate with specialists, ensure high quality implementation and thorough verification. When complete, send a message with your victory claim and completion report.
 
## Follow-up — 2026-09-01T20:57:25Z

Perform a comprehensive full-stack security audit and defensive hardening check across the DraftPilot codebase (Next.js web application, NestJS backend API, Manifest V3 Chrome extension), Supabase database access layers, and API endpoints. Identify and remediate critical security vulnerabilities without disrupting existing workflows.

Working directory: /home/md-roni-ahamed/Test project
Integrity mode: development

## Requirements

### R1. Authentication, Authorization & Admin Endpoint Hardening
Audit all public and administrative API routes (`/api/admin/*`, `/api/drafts/*`, NestJS controllers), verifying that:
1. Super admin routes strictly enforce passkey and session token validation (`verifySuperAdmin`, `AdminGuard`).
2. Public and user endpoints enforce rate limiting to prevent denial-of-service, scraping, and brute-force attacks.
3. CORS policies, Content Security Policy (CSP), and HTTP security headers prevent unauthorized origins and script injection.

### R2. Database Security, Row-Level Security (RLS) & Secret Isolation
Audit Supabase database queries and schemas to guarantee:
1. Client-side code never leaks or utilizes the `SUPABASE_SERVICE_ROLE_KEY`.
2. All tables (`workspaces`, `macros`, `platform_settings`, `feature_flags`, `billing`) enforce strict Row-Level Security (RLS) policies so authenticated/unauthenticated clients cannot access or modify unauthorized records.
3. Sensitive customer support threads and drafts redact PII before database storage or telemetry logging.

### R3. Extension & Client-Side Sandbox Security
Audit the Manifest V3 Chrome Extension (`packages/extension`) for:
1. Least-privilege manifest permissions and secure message passing between content scripts, sidepanels, and service workers.
2. Robust client-side PII scrubbing (emails, phone numbers, SSNs, credit cards) prior to prompt dispatch.
3. Safe DOM insertion preventing XSS when rendering AI replies or macros.

### R4. Non-Destructive Remediation & End-to-End Verification
Apply targeted, defensive fixes for any discovered vulnerabilities without breaking existing features or user experiences. Verify all changes with automated test suites (`pnpm test`) and complete production builds (`pnpm build:web`, `pnpm build:api`, `pnpm build:ext`).

## Acceptance Criteria

### Security Hardening
- [ ] No secret or service-role keys are exposed in client-facing bundles or public repository files.
- [ ] All admin routes and destructive actions strictly enforce authorization and passkey verification.
- [ ] RLS policies and database access patterns prevent cross-tenant data access or unauthorized mutations.
- [ ] PII scrubbing and DOM sanitization prevent data leaks and XSS vulnerabilities.

### System Integrity & Build Verification
- [ ] All existing features (AI draft generation, macro management, admin settings, extension sidepanel) continue functioning seamlessly without regressions.
- [ ] `pnpm test`, `pnpm build:web`, `pnpm build:api`, and `pnpm build:ext` all succeed with zero errors.

