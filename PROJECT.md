# Project: DraftPilot Full-Stack Security Audit & Defensive Hardening

## Architecture
- **Web Application (`packages/web`)**: Next.js 14 App Router, React 18, Supabase client/server auth wrappers, Admin panel components, and API routes (`/api/admin/*`, `/api/drafts/*`).
- **Backend API (`packages/api`)**: NestJS 10 REST API, Supabase Database migrations, Billing Module (Stripe Webhook), Drafts Module, Auth Guards, Rate Limiters, Helmet, CORS.
- **Chrome Extension (`packages/extension`)**: Manifest V3 extension, Vite 5, Background Service Worker, Content Scripts (Gmail Detector), Sidepanel UI, and client-side PII scrubber.

## Feature Inventory
| # | Feature / Remediation | Description | Milestone | Source | Status |
|---|------------------------|-------------|-----------|--------|--------|
| 1 | Passkey Hardening & Constant-Time Auth | Remove plaintext passkeys and enforce server-side constant-time comparison in `admin-auth.ts`, `AdminGuard.tsx`, `login/page.tsx` | M1 | R1 | DONE |
| 2 | Stripe Webhook Cryptographic Verification | Verify Stripe webhook signatures via `stripe.webhooks.constructEvent` with `rawBody` in `billing.controller.ts` | M1 | R1, R2 | DONE |
| 3 | HTTP Security Headers & Helmet Hardening | Configure Helmet in NestJS `main.ts`, pin extension CORS origin, and strengthen Next.js CSP in `next.config.js` | M1 | R1 | DONE |
| 4 | Monthly Draft Quota & Usage Rate Limiting | Enforce monthly draft quota checks and usage table increments in Next.js `/api/drafts/generate/route.ts` with memory leak eviction | M1 | R1 | DONE |
| 5 | Cross-Tenant RLS Privilege Escalation Fix | Update `users` table RLS UPDATE policy to prevent modifying `team_id`/`role`; restrict `teams` INSERT policy to free tier | M2 | R2 | DONE |
| 6 | Full-Stack Server-Side PII Scrubbing | Add server-side PII scrubbing in `drafts.service.ts` and `/api/drafts/generate/route.ts` before database storage and prompt dispatch | M2 | R2 | DONE |
| 7 | Client-Side Secret Cleanliness & Sanitization | Remove plaintext API key storage in localStorage in `AdminAIConfig.tsx`; pass standard Bearer token authorization headers | M2 | R2 | DONE |
| 8 | Extension DOM Insertion & Stored XSS Defense | Implement HTML entity escaping in `sidepanel.ts` for macro rendering and in `gmail-detector.ts` for Gmail compose injection | M3 | R3 | DONE |
| 9 | Extension Service Worker Message Sender Verification | Restrict `GET_AUTH_TOKEN` and `SET_AUTH_TOKEN` in `service-worker.ts` to internal extension contexts (`!sender.tab`), blocking untrusted content scripts | M3 | R3 | DONE |
| 10 | Unified Client PII Scrubber & Manifest CSP Hardening | Synchronize PII scrubbing rules (including street addresses, PO boxes, JWTs, and API tokens) in extension and harden manifest CSP to `object-src 'none'` | M3 | R3 | DONE |
| 11 | Full Test Suite & Production Build Verification | Execute `pnpm test`, `pnpm build:web`, `pnpm build:api`, and `pnpm build:ext` with zero errors | M4 | R4 | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Auth, Admin Endpoints, Headers & Rate Limiting | `admin-auth.ts`, `AdminGuard.tsx`, `login/page.tsx`, `billing.controller.ts`, `next.config.js`, NestJS `main.ts`, `/api/drafts/generate/route.ts` | none | DONE |
| 2 | Supabase RLS Policies, Secret Isolation & Server PII | `003_strict_rls_security.sql`, `006_harden_user_tenant_rls.sql`, `drafts.service.ts`, `AdminAIConfig.tsx`, server-side `pii-scrubber` | M1 | DONE |
| 3 | Extension Client Sandbox, Message Passing & XSS Defense | `sidepanel.ts`, `gmail-detector.ts`, `service-worker.ts`, `pii-scrubber.ts`, `manifest.json` | M1 | DONE |
| 4 | Full-Stack Integration Verification & Forensic Audit | Monorepo tests (`pnpm test`), builds (`build:web`, `build:api`, `build:ext`), Reviewer, Challenger & Forensic Auditor gates | M1, M2, M3 | DONE |

## Code Layout
- `packages/web/src/lib/admin-auth.ts`: Server-side superadmin authentication guard.
- `packages/web/src/components/admin/AdminGuard.tsx`: Client-side admin route protection.
- `packages/web/src/app/admin/login/page.tsx`: Admin login page.
- `packages/web/src/app/api/drafts/generate/route.ts`: Next.js draft generation, rate limits & usage tracking.
- `packages/web/next.config.js`: Next.js HTTP security headers and CSP.
- `packages/api/src/main.ts`: NestJS entrypoint with Helmet and CORS origin validation.
- `packages/api/src/billing/billing.controller.ts`: NestJS Stripe webhook handler.
- `packages/api/supabase/migrations/`: Supabase RLS migrations.
- `packages/api/src/drafts/drafts.service.ts`: NestJS draft service & PII scrubber.
- `packages/web/src/components/admin/AdminAIConfig.tsx`: Admin AI config UI.
- `packages/extension/src/sidepanel/sidepanel.ts`: Extension sidepanel UI, macro renderer & XSS escaping.
- `packages/extension/src/content/gmail-detector.ts`: Gmail content script & safe draft insertion.
- `packages/extension/src/background/service-worker.ts`: Background service worker with sender origin checks.
- `packages/extension/src/utils/pii-scrubber.ts`: Extension client PII scrubber.
- `packages/extension/manifest.json`: Manifest V3 configuration & CSP.
