# Plan: Full-Stack Security Audit and Defensive Hardening

## Overview
Perform a comprehensive full-stack security audit and defensive hardening check across the DraftPilot codebase (Next.js web app, NestJS backend API, Manifest V3 Chrome extension, Supabase DB access layers, and API endpoints).

## Step-by-Step Plan

### Phase 0: Survey & Scope Mapping (Parallel Exploration)
- Spawn Explorer 1 for R1: Next.js & NestJS Auth routes (`/api/admin/*`, `/api/drafts/*`), `verifySuperAdmin`, `AdminGuard`, passkey/session token checks, rate limiting, CORS, CSP, HTTP security headers.
- Spawn Explorer 2 for R2: Supabase schemas/migrations, RLS policies on `workspaces`, `macros`, `platform_settings`, `feature_flags`, `billing`, service role key usage/isolation, backend & DB PII redaction.
- Spawn Explorer 3 for R3: Chrome extension (`packages/extension`), manifest permissions, service worker / sidepanel / content script message passing, client-side PII scrubbing (emails, phones, SSNs, credit cards), DOM XSS prevention.

### Phase 1: Synthesis & PROJECT.md Architecture
- Aggregate Explorer findings into `PROJECT.md`.
- Formulate concrete milestone scopes, interface contracts, and file write ownership boundaries.

### Phase 2: Milestone Iteration Loops (Explorer -> Worker -> Reviewer -> Challenger -> Auditor)
- Milestone 1: Auth & API Hardening (Admin passkey checks, session token validation, rate limiters, CORS & CSP headers).
- Milestone 2: Supabase RLS, Secret Isolation & DB PII Scrubbing.
- Milestone 3: Extension Sandbox Hardening, Secure Message Passing, Client PII Scrubbing & DOM XSS Defense.

### Phase 3: Monorepo Verification & Audit Gate
- Execute `pnpm test`, `pnpm build:web`, `pnpm build:api`, `pnpm build:ext`.
- Independent Reviewers, Challengers, and Forensic Auditor verification.
- Final completion summary to parent.
