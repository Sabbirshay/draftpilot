# Original User Request

## 2026-09-01T05:50:29Z

Validate why OpenRouter rate-limit / daily limit alerts are triggered, verify the live upstream OpenRouter API responses (`/api/v1/chat/completions`), enhance the Admin AI Config key verification to query `/api/v1/auth/key` for real-time balance and usage statistics, and ensure transparent upstream error reporting in the admin playground.

Working directory: /home/md-roni-ahamed/Test project
Integrity mode: development

## Requirements

### R1. Live OpenRouter Upstream Response Validation & Diagnosis
Audit the exact upstream HTTP response returned by OpenRouter during live test draft generations. Differentiate between:
1. Free-tier daily account caps (50 requests/day on $0 balance)
2. Per-minute concurrency limits (20 requests/minute)
3. Model-specific queue congestion (busy free models)
4. Invalid or unauthenticated keys

### R2. Real-Time Key Quota & Balance Telemetry
Upgrade the `handleVerifyKey` method in `AdminAIConfig.tsx` to query `https://openrouter.ai/api/v1/auth/key` and display live account telemetry (key label, usage amount, remaining credit limit, rate limit interval, and free-tier status).

### R3. Verbatim Error & Advisory UI
Update the playground rate-limit banner in `AdminAIConfig.tsx` to show the verbatim upstream error message from OpenRouter, along with actionable instructions to resolve it (e.g. adding credits or switching free models) and immediate fallback preview.

### R4. Build & Test Verification
Run full monorepo test suites (`pnpm test`) and production builds (`pnpm build:web`, `pnpm build:api`, `pnpm build:ext`) to guarantee zero regressions.

## Acceptance Criteria

### Diagnostics & UI Telemetry
- [ ] Admin AI Config displays live key usage, credit limits, and rate limits directly from OpenRouter when clicking "Verify Key".
- [ ] The playground banner shows the verbatim upstream error from OpenRouter and clearly explains the exact reason (daily limit vs concurrency vs congestion).

### Build Verification
- [ ] `pnpm test`, `pnpm build:web`, `pnpm build:api`, and `pnpm build:ext` all succeed with zero errors.

## 2026-09-01T20:57:25Z

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

