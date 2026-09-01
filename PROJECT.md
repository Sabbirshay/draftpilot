# Project: DraftPilot AI System Diagnosis & Enhancement

## Architecture
- Monorepo structure with `packages/web` (Next.js 14), `packages/api` (NestJS 10), and `packages/extension` (Vite / CRXJS Manifest V3).
- Authentication via Supabase Auth + Master Passkey for Super Admin (`verifySuperAdmin`).
- Data Layer: PostgreSQL on Supabase with `platform_settings` table for global AI configuration.
- Real-time synchronization & dynamic routing: Dynamic query of `platform_settings` with cache across Next.js and NestJS.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Custom Instruction Compilation (Next.js) | Include `macroHint` and user prompt overrides in `/api/drafts/generate` prompt assembly. | M1 | Survey (Explorer 1) |
| 2 | Dynamic System Prompt (Next.js) | Load and apply `platform_settings.system_prompt` dynamically in Next.js draft route. | M1 | Survey (Explorer 1) |
| 3 | Custom Instruction Compilation (NestJS) | Preserve and compile custom `macroHint` instructions in `drafts.service.ts` & `ai-provider.service.ts`. | M1 | Survey (Explorer 1) |
| 4 | Multi-Tier Fallback Cascade (Next.js) | Implement 5-intent domain support synthesizer (refunds, tracking, access, billing, troubleshooting) with customer personalization. | M2 | Survey (Explorer 2) |
| 5 | Synthesizer Personalization & Intents (NestJS) | Enhance `AiProviderService.synthesizeSmartDraft` with 5 intents and `Hi ${customerName},` personalization. | M2 | Survey (Explorer 2) |
| 6 | Upstream Request Timeouts | Add 8s request timeout on upstream OpenRouter `fetch` calls across Next.js and NestJS. | M2 | Survey (Explorer 2) |
| 7 | Multi-Paragraph Reasoning Sanitization | Strip multi-paragraph `<think>` blocks, reasoning chains, and analysis headers in `cleanAiDraft` and `cleanDraft`. | M3 | Survey (Explorer 1) |
| 8 | Markdown & Preamble Fence Stripping | Strip markdown code fences (` ```markdown `) and header commentary across all AI outputs. | M3 | Survey (Explorer 1) |
| 9 | Greeting & Sign-off Normalization | Replace placeholder sign-offs (`[Your Name]`, `[Agent Name]`) and normalize `Hi [Name],`. | M3 | Survey (Explorer 1) |
| 10 | Universal NestJS Draft Cleaning | Ensure OpenAI completion responses pass through `cleanDraft()`. | M3 | Survey (Explorer 1) |
| 11 | Admin AI Config Persistence | Validate model selection, temperature/tokens, custom prompt persistence to `platform_settings`. | M4 | Survey (Explorer 3) |
| 12 | Dynamic Routing & Zero Downtime | Verify instant runtime reflection of `platform_settings` in Next.js, NestJS, and Extension. | M4 | Survey (Explorer 3) |
| 13 | Interactive AI Playground | Validate live test draft generation, auto-fallback, 429 recovery, and latency/token telemetry. | M4 | Survey (Explorer 3) |
| 14 | Monorepo Test Scripts & ESM Fixes | Add `"test"` scripts to `packages/web` and `packages/extension`, fix `.ts` import in `pii-scrubber.test.ts`. | M5 | Survey (Explorer 3) |
| 15 | Multi-Package Build Integrity & Verification | Verify 0 TypeScript errors, 100% test pass rate (`pnpm test`), and production builds (`build:web`, `build:api`, `build:ext`). | M5 | Survey (All) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Custom Instruction & Prompt Compilation | R1: `macroHint` integration, `system_prompt` loading, prompt assembly in Next.js & NestJS | none | PLANNED |
| 2 | M2: Dual-Model Fallback & Synthesizer Resilience | R2: 5-intent domain synthesizer, customer name personalization, 8s timeout | M1 | PLANNED |
| 3 | M3: Output Sanitization & Format Enforcement | R3: Multi-paragraph thinking stripping, code fence removal, sign-off placeholders, universal cleaning | M1 | PLANNED |
| 4 | M4: Admin AI Config & Interactive Playground | R4: Super admin model switching, temperature/token tuning, persistence, playground live testing | M1, M2, M3 | PLANNED |
| 5 | M5: Build Integrity, Multi-Package Tests & Verification | R5: `package.json` test scripts, ESM test import fix, unit test suite, builds, challenger & forensic audit | M1, M2, M3, M4 | PLANNED |

## Interface Contracts
### Extension / Client ↔ API (`POST /api/drafts/generate`)
- Request: `{ threadContent: string, macroHint?: string, customPrompt?: string, tone?: string, model?: string, matchedMacro?: { name: string, content: string }, kbSnippets?: string[] }`
- Response: `{ draft: string, tokensUsed: number, provider: string, model: string, fallbackApplied?: boolean }`

### NestJS Drafts API (`POST /drafts/generate`)
- Request: `{ threadContent: string, macroHint?: string, tone?: string, model?: string }`
- Response: `{ draft: string, tokensUsed: number, provider: string, model: string }`

### Admin ↔ Server API (`POST /api/admin/ai-config`)
- Request Headers: `x-admin-passkey` or `Authorization: Bearer <token>`
- Request Body: `{ provider: string, selected_model: string, temperature: number, max_tokens: number, system_prompt: string, openrouter_api_key?: string, openai_api_key?: string }`
- Persistence: Upsert to `platform_settings` table via `supabaseAdmin` service role.

## Code Layout
- `packages/web`: Next.js 14 frontend and admin console
  - `src/app/api/drafts/generate/route.ts`: Next.js draft generation, prompt compilation, fallback cascade, sanitization.
  - `src/app/api/admin/ai-config/route.ts`: Admin AI config persistence.
  - `src/components/admin/AdminAIConfig.tsx`: Admin AI Config UI and interactive playground.
  - `src/lib/admin-auth.ts`: Admin authentication and passkey verification.
  - `src/lib/__tests__/`: Integration and unit test suites.
- `packages/api`: NestJS backend
  - `src/drafts/drafts.service.ts`: Draft prompt assembly, macro resolution, customer extraction.
  - `src/drafts/ai-provider.service.ts`: AI provider execution, OpenRouter/OpenAI fallback cascade, smart support synthesizer, draft cleaning.
- `packages/extension`: Chrome Extension Manifest V3
  - `src/utils/api-client.ts`: Client API caller, offline fallback, PII scrubber.
  - `src/utils/__tests__/`: Extension test suites.
