# Investigation Report: Requirements R4 & R5 (Super Admin AI Suite & Build Verification Baseline)

**Date**: 2026-08-31  
**Investigator**: `explorer_survey_admin`  
**Project**: DraftPilot AI Monorepo  

---

## Executive Summary

This investigation analyzed and diagnosed **Requirement R4** (Super Admin AI Configuration, Persistence, Dynamic Routing, and Live Playground Testing) and **Requirement R5** (Non-Destructive Integrity, Monorepo Package Scripts, Test Runners, and Production Builds).

### Core Findings
1. **R4 (Admin AI Config Suite & Routing)**: Fully architected and operational.
   - UI component: `packages/web/src/components/admin/AdminAIConfig.tsx` (736 lines), integrated at `/admin` (AI Config tab).
   - Multi-tier persistence: LocalStorage client cache + `POST /api/admin/ai-config` -> Supabase singleton table `platform_settings`.
   - Security: Service-role only RLS (Migration `005_secure_platform_settings.sql`) prevents key exfiltration; API routes guarded by `verifySuperAdmin` (`x-admin-passkey` and Bearer token).
   - Dynamic routing: Draft generation in Next.js (`/api/drafts/generate`) and NestJS (`AiProviderService`) dynamically reads `platform_settings` at runtime, providing instant effect across Web and Chrome Extension without client rebuilds.
   - Interactive Playground: Supports custom inputs, live OpenRouter generation, automated model fallback (`google/gemma-4-26b-a4b-it:free` <-> `google/gemma-4-31b-it:free`), domain synthesizer fallback upon 429 rate limits, reasoning artifact sanitization, and latency/token telemetry.

2. **R5 (Build Baseline & Test Runner Diagnosis)**:
   - Production Builds:
     - `pnpm build:web`: Next.js production build succeeds with **0 errors** (16 routes compiled).
     - `pnpm build:api`: NestJS build succeeds with **0 errors** (`dist/` generated).
     - `pnpm build:ext`: Vite extension build succeeds with **0 errors** (`dist/` generated with manifest and icons).
   - Test Runner & Script Gaps:
     - Root `package.json` specifies `"test": "pnpm -r test"`.
     - `@draftpilot/api` defines `"test": "jest --passWithNoTests"` (exits 0).
     - `@draftpilot/web` has **no `"test"` script** in `package.json`, skipping 3 test suites (30 passing tests in `src/lib/__tests__/`).
     - `@draftpilot/extension` has **no `"test"` script** in `package.json`, skipping `src/utils/__tests__/pii-scrubber.test.ts` (7 tests).
     - In `packages/extension/src/utils/__tests__/pii-scrubber.test.ts`, the import `from '../pii-scrubber'` lacks `.ts` extension required for native Node ESM type-stripping resolution.
     - Root defines `"lint": "pnpm -r lint"`, but no subpackage has a `"lint"` script, causing `pnpm lint` to error.

---

## Deep Dive: Requirement R4 (Super Admin AI Playground & Dynamic Routing)

### 1. Architectural Map & File Locations

| Layer | File Path | Role / Functionality |
|---|---|---|
| **Admin UI** | `packages/web/src/components/admin/AdminAIConfig.tsx` | Full AI config suite: Provider select, Model picker, Custom slug, Sliders, System prompt, Key validator, and Live Playground. |
| **Admin Route** | `packages/web/src/app/admin/page.tsx` | Main `/admin` dashboard layout mounting `AdminAIConfig` on tab `ai-config`. |
| **Admin Guard** | `packages/web/src/components/admin/AdminGuard.tsx` | Front-end authentication guard checking passkeys (`draftpilot-root-2026`, etc.) or superadmin session. |
| **Admin API Route** | `packages/web/src/app/api/admin/ai-config/route.ts` | GET/POST route for loading and updating `platform_settings`. |
| **Admin Auth Guard** | `packages/web/src/lib/admin-auth.ts` | `verifySuperAdmin` validates `x-admin-passkey` or Bearer token with Supabase superadmin role / whitelist. |
| **Database Schema** | `packages/api/supabase/migrations/004_platform_settings.sql` | `platform_settings` table schema (singleton AI config row). |
| **Database RLS** | `packages/api/supabase/migrations/005_secure_platform_settings.sql` | Restricts `platform_settings` to `service_role` only. |
| **Web Draft Route** | `packages/web/src/app/api/drafts/generate/route.ts` | Next.js dynamic AI generation route reading `platform_settings`. |
| **NestJS AI Service** | `packages/api/src/drafts/ai-provider.service.ts` | Backend AI provider handling OpenRouter, OpenAI, and local smart synthesizer. |
| **Extension Client** | `packages/extension/src/utils/api-client.ts` | Chrome extension client routing draft generation to `/api/drafts/generate`. |

---

### 2. UI Controls & Tuning Parameter Breakdown (`AdminAIConfig.tsx`)

1. **AI Provider Switching**:
   - Supported Providers:
     - `openrouter` ("OpenRouter (Free Models)")
     - `openai` ("OpenAI Direct")
     - `offline` ("Offline Smart Synthesizer")
   - Instant local storage mirror: `localStorage.setItem('draftpilot_ai_provider', p.id)` on selection.

2. **Model Selection & Custom Model Slugs**:
   - Built-in Free Models:
     - `google/gemma-4-26b-a4b-it:free` (Google DeepMind, MoE Architecture)
     - `google/gemma-4-31b-it:free` (Google DeepMind, High Reasoning)
   - Custom Model Input (`customOpenrouterModel`): Text input allowing any OpenRouter slug (e.g. `meta-llama/llama-3.3-70b-instruct:free`, `nvidia/nemotron-3.5-lightning:free`).

3. **Hyperparameter Tuning**:
   - **Temperature**: Range `0.0` to `1.0` (step `0.05`, default `0.4`).
   - **Max Response Tokens**: Range `100` to `800` (step `50`, default `300`).

4. **Custom System Prompt**:
   - Editable textarea persisting platform-wide prompt instructions.
   - Default prompt:
     ```text
     You are DraftPilot, an intelligent AI reply assistant for customer support.
     Generate a calm, polite, and concise reply based strictly on the provided thread and matched team macros.
     - Do not make up facts or policies not in the macros.
     - Maintain a warm, human, and professional tone.
     - Output ONLY the reply text, no preamble or meta-commentary.
     ```

5. **API Key Live Verification**:
   - `handleVerifyKey()` executes direct validation:
     - OpenRouter: `GET https://openrouter.ai/api/v1/auth/key`
     - OpenAI: `GET https://api.openai.com/v1/models`
   - Displays real-time status badges: `✓ Saved & Verified`, `Testing...`, or `✗ Invalid Key`.

---

### 3. Persistence Mechanism & Security

```
[AdminAIConfig.tsx]
   │
   ├─► 1. LocalStorage (Synchronous browser fallback)
   │
   └─► 2. POST /api/admin/ai-config (with x-admin-passkey / Bearer token)
            │
            ▼
        [verifySuperAdmin] (packages/web/src/lib/admin-auth.ts)
            │
            ▼
        [supabaseAdmin] (Service Role Client)
            │
            ▼
     ┌────────────────────────────────────────────────────────┐
     │            Supabase platform_settings Table            │
     │  - id: UUID                                            │
     │  - ai_provider: TEXT                                   │
     │  - openrouter_api_key: TEXT                            │
     │  - openrouter_model: TEXT                              │
     │  - selected_model: TEXT                                │
     │  - system_prompt: TEXT                                 │
     │  - temperature: NUMERIC(3,2)                           │
     │  - max_tokens: INTEGER                                 │
     │  - updated_at: TIMESTAMPTZ                             │
     └────────────────────────────────────────────────────────┘
            │                                    │
            ▼                                    ▼
 [Next.js /api/drafts/generate]    [NestJS AiProviderService]
 (Instant fetch on each request)   (60s TTL in-memory cache)
            │                                    │
            └───────────────┬────────────────────┘
                            │
                            ▼
           [Web Dashboard & Chrome Extension]
```

- **Database RLS Policies**:
  - `004_platform_settings.sql` initialized the table with RLS enabled.
  - `005_secure_platform_settings.sql` strictly dropped `FOR SELECT TO authenticated` and enforced `TO service_role` only. This ensures API keys cannot be read from browser clients using anon keys.
- **Client Synchronization on Mount**:
  - `AdminAIConfig.tsx` loads local storage cache first to avoid layout shift/blank inputs.
  - Asynchronously calls `GET /api/admin/ai-config` with header `x-admin-passkey: draftpilot-root-2026` to hydrate active cloud configuration.

---

### 4. Dynamic Routing & Immediate Effect Across Clients

1. **Next.js Edge API (`/api/drafts/generate/route.ts`)**:
   - Lines 108–112:
     ```ts
     const { data: settings } = await supabaseAdmin
       .from('platform_settings')
       .select('*')
       .limit(1)
       .single();
     ```
   - Dynamically selects `activeModel = settings.selected_model || settings.openrouter_model`, applies `settings.temperature`, `settings.max_tokens`, and `strictSystemPrompt`.
   - **Zero latency propagation**: Any update deployed in `/admin` takes effect on the very next `/api/drafts/generate` call.

2. **NestJS Backend (`AiProviderService.ts`)**:
   - Lines 25–52: `getSettings()` caches `platform_settings` for 60 seconds (`now - this.cachedAt < 60000`).
   - Dynamically invokes OpenRouter, OpenAI, or local synthesizer based on updated settings.

3. **Chrome Extension (`api-client.ts`)**:
   - Lines 552–572: `generateDraft()` sends customer thread to `https://draftpilot-web.vercel.app/api/drafts/generate`.
   - Because the extension delegates LLM prompt assembly and generation to the web route, extension users automatically receive replies generated by the active model and settings without reloading or reinstalling the extension.

---

### 5. Interactive Playground Analysis (`AdminAIConfig.tsx`)

- **Execution Flow (`handleTestDraft`, lines 294–423)**:
  1. Validates provider is `openrouter` and API key is present.
  2. Sets `activeModel = customOpenrouterModel.trim() || openrouterModel`.
  3. Configures pairing fallback model: `fallbackModel = activeModel.includes('26b') ? 'google/gemma-4-31b-it:free' : 'google/gemma-4-26b-a4b-it:free'`.
  4. Calls `https://openrouter.ai/api/v1/chat/completions`.
  5. **Auto-Fallback**: If primary model returns 4xx/5xx or empty choices, automatically re-attempts with `fallbackModel`.
  6. **429 / Credit Limit Recovery**: If OpenRouter responds with 429 rate limit or 50 reqs/day credit cap, triggers `generateSmartSupportReply(testThread)` and renders an amber advisory banner explaining credit tiers.
  7. **Output Sanitization**: Strips `<think>...</think>`, `Thinking Process:` preambles, `**Analyze User Input:**`, and markdown backtick blocks.
  8. **Metrics Calculation**: Computes real-time latency (`(Date.now() - start) / 1000`) and extracts total tokens used (`data.usage?.total_tokens`).

---

## Deep Dive: Requirement R5 (Build Verification & Test Baselines)

### 1. Monorepo Scripts Matrix

| Package | Path | Scripts in package.json | Build Status | Test Status |
|---|---|---|---|---|
| **Root** | `/` | `dev`, `build`, `start`, `dev:api`, `dev:web`, `dev:ext`, `build:api`, `build:web`, `build:ext`, `test`, `lint` | N/A (Delegates to filters) | Runs `pnpm -r test` |
| **`@draftpilot/web`** | `packages/web` | `dev`, `build`, `start` | **PASS (0 errors, 16 routes)** | ⚠️ **No script in package.json** (30 tests in `src/lib/__tests__/`) |
| **`@draftpilot/api`** | `packages/api` | `dev`, `build`, `start`, `test` | **PASS (0 errors, nest build)** | **PASS (`jest --passWithNoTests`)** |
| **`@draftpilot/extension`** | `packages/extension` | `dev`, `build` | **PASS (0 errors, vite build)** | ⚠️ **No script in package.json** (7 tests in `src/utils/__tests__/`) |

---

### 2. Empirical Verification of Builds

1. **`pnpm build:web`**:
   - Command: `pnpm --filter @draftpilot/web build` (`next build`)
   - Outcome: **Compiled successfully in Next.js 14.2.35**.
   - Output Routes:
     - `○ /` (Static, 5 kB)
     - `○ /_not-found` (Static, 873 B)
     - `○ /admin` (Static, 24.9 kB)
     - `○ /admin/login` (Static, 2.94 kB)
     - `ƒ /api/admin/ai-config` (Dynamic, 0 B)
     - `ƒ /api/admin/billing` (Dynamic, 0 B)
     - `ƒ /api/admin/feature-flags` (Dynamic, 0 B)
     - `ƒ /api/admin/global-macros` (Dynamic, 0 B)
     - `ƒ /api/admin/metrics` (Dynamic, 0 B)
     - `ƒ /api/admin/workspaces` (Dynamic, 0 B)
     - `ƒ /api/auth/me` (Dynamic, 0 B)
     - `ƒ /api/drafts/generate` (Dynamic, 0 B)
     - `○ /auth/callback` (Static, 1.38 kB)
     - `○ /dashboard` (Static, 23.8 kB)
     - `○ /join` (Static, 148 B)
     - `○ /login` (Static, 148 B)

2. **`pnpm build:api`**:
   - Command: `pnpm --filter @draftpilot/api build` (`nest build`)
   - Outcome: **Compiled successfully into `dist/` with zero TypeScript or NestJS errors**.

3. **`pnpm build:ext`**:
   - Command: `pnpm --filter @draftpilot/extension build` (`vite build && cp manifest.json dist/ && cp -r icons dist/`)
   - Outcome: **Compiled successfully in 149ms**. Generated `dist/sidepanel.js` (26.6 kB), `dist/service-worker.js` (0.97 kB), `dist/gmail-detector.js` (4.11 kB), and copied manifest & icons.

---

### 3. Empirical Verification of Test Suites & Diagnostic Gaps

#### Existing Test Inventory
1. `packages/web/src/lib/__tests__/admin-auth.test.ts`:
   - 8 test cases covering missing header, non-Bearer auth, invalid tokens, `x-admin-passkey` direct auth, alternate passkeys, and client initialization.
   - Result: **8/8 PASS** (37.8ms).

2. `packages/web/src/lib/__tests__/admin-m3.test.ts`:
   - 3 test cases covering feature flag toggling, global macro tag formatting, and quota percentage calculations.
   - Result: **3/3 PASS** (3.3ms).

3. `packages/web/src/lib/__tests__/challenger-interactive.test.ts`:
   - 19 test cases covering `cleanAiDraft` (stripping `<think>`, handling thought-process-only responses, code fences, macro variable replacement, greeting personalization), `extractSenderName` (header formats, sign-offs, blacklist filters), `SlidingWindowRateLimiter`, passkey validation, session reload, and broadcast macro distribution.
   - Result: **19/19 PASS** (10.8ms).

4. `packages/extension/src/utils/__tests__/pii-scrubber.test.ts`:
   - 7 test cases covering redaction of emails, credit cards, SSNs, phone numbers, addresses, API tokens, and preservation of clean support text.
   - Result: **7/7 PASS** when run with node test runner and ESM `.ts` import.

#### Identified Test Execution & Configuration Discrepancies
1. **Missing `"test"` scripts in subpackages**:
   - `packages/web/package.json` lacks `"test"`. Adding `"test": "node --experimental-strip-types --test src/lib/__tests__/*.test.ts"` allows `pnpm -r test` to execute all 30 web test cases.
   - `packages/extension/package.json` lacks `"test"`. Adding `"test": "node --experimental-strip-types --test src/utils/__tests__/*.test.ts"` allows `pnpm -r test` to execute extension tests.
2. **Missing `.ts` extension in `packages/extension/src/utils/__tests__/pii-scrubber.test.ts`**:
   - Line 4 has `import { scrubPII } from '../pii-scrubber';`. Under Node.js native ESM type stripping, relative imports require the explicit file extension (`../pii-scrubber.ts`), identical to the working pattern in `packages/web/src/lib/__tests__/admin-auth.test.ts`.
3. **Missing `"lint"` scripts in subpackages**:
   - Root `package.json` has `"lint": "pnpm -r lint"`. Since no subpackages define `"lint"`, running `pnpm lint` fails with `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`.

---

## Actionable Recommendations for Implementation Phase

1. **Test Suite Unification**:
   - In `packages/web/package.json`, add `"test": "node --experimental-strip-types --test src/lib/__tests__/*.test.ts"`.
   - In `packages/extension/package.json`, add `"test": "node --experimental-strip-types --test src/utils/__tests__/*.test.ts"`.
   - In `packages/extension/src/utils/__tests__/pii-scrubber.test.ts`, update line 4 to `import { scrubPII } from '../pii-scrubber.ts';`.
   - Add `"lint": "tsc --noEmit"` or appropriate lint script across all packages to make `pnpm lint` succeed cleanly.
2. **R4 Dynamic Routing & Fallbacks**:
   - Super Admin AI configuration and Playground are robustly implemented. Ensure R1 (macro compilation) and R2 (model fallback) enhancements remain fully aligned with the `platform_settings` table and `AdminAIConfig.tsx` defaults.

---
