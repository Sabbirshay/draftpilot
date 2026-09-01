## 2026-09-01T20:58:25Z

Perform a comprehensive full-stack security audit and defensive hardening check across the DraftPilot codebase (Next.js web application, NestJS backend API, Manifest V3 Chrome extension), Supabase database access layers, and API endpoints. Identify and remediate critical security vulnerabilities without disrupting existing workflows.

Requirements:
1. R1. Authentication, Authorization & Admin Endpoint Hardening:
   - Super admin routes strictly enforce passkey and session token validation (`verifySuperAdmin`, `AdminGuard`).
   - Public and user endpoints enforce rate limiting to prevent DoS, scraping, and brute-force attacks.
   - CORS policies, Content Security Policy (CSP), and HTTP security headers prevent unauthorized origins and script injection.
2. R2. Database Security, Row-Level Security (RLS) & Secret Isolation:
   - Client-side code never leaks or utilizes the `SUPABASE_SERVICE_ROLE_KEY`.
   - All tables (`workspaces`, `macros`, `platform_settings`, `feature_flags`, `billing`) enforce strict Row-Level Security (RLS) policies so unauthorized access/modification is blocked.
   - Sensitive customer support threads and drafts redact PII before database storage or telemetry logging.
3. R3. Extension & Client-Side Sandbox Security:
   - Least-privilege manifest permissions and secure message passing between content scripts, sidepanels, and service workers in `packages/extension`.
   - Robust client-side PII scrubbing (emails, phone numbers, SSNs, credit cards) prior to prompt dispatch.
   - Safe DOM insertion preventing XSS when rendering AI replies or macros.
4. R4. Non-Destructive Remediation & End-to-End Verification:
   - Apply targeted, defensive fixes without breaking existing features or user experiences.
   - Run automated test suites (`pnpm test`) and complete production builds (`pnpm build:web`, `pnpm build:api`, `pnpm build:ext`) with zero errors.
