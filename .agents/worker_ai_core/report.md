# AI Core Diagnosis and Enhancement Report

**Date:** 2026-08-31  
**Subagent:** `worker_ai_core`  
**Milestone:** AI Core Implementation & Verification (Requirements R1, R2, R3)  
**Owned Files:**
1. `packages/web/src/app/api/drafts/generate/route.ts`
2. `packages/api/src/drafts/drafts.service.ts`
3. `packages/api/src/drafts/ai-provider.service.ts`
4. `packages/extension/src/utils/api-client.ts`

---

## 1. Overview & Objectives

This enhancement addressed critical defects and resilience gaps in DraftPilot's AI generation pipelines across the Next.js API, NestJS AI backend, and Chrome Extension client:
- **R1: Custom Instruction & Contextual Prompt Compilation**: Ensured agent guidance (`macroHint` / custom instructions), matched macros, knowledge chunks, and platform settings are systematically compiled into the final LLM prompt context without role redundancy.
- **R2: Dual-Model Fallback & Smart Support Synthesizer Resilience**: Implemented a hardened 5-intent domain-aware synthesizer (Refunds/Returns, Order Tracking/Shipping, Account/Login Access, Billing/Invoices, Technical Troubleshooting) with personalized greetings (`Hi ${customerName},`) and `AbortSignal.timeout(8000)` on upstream OpenRouter calls.
- **R3: Output Sanitization & Format Enforcement**: Built an adversarial-grade sanitization pipeline that strips `<think>` tags, multi-paragraph reasoning chains (DeepSeek R1 / Gemma 4), markdown code fences with preambles/postscripts, meta headers (`Subject:`, `Draft:`, `Response:`, etc.), normalizes greetings, and scrubs placeholder sign-offs to "Customer Support Team".

---

## 2. Detailed Technical Changes

### 2.1 Next.js API Route (`packages/web/src/app/api/drafts/generate/route.ts`)
- **Custom Instruction Compilation (R1)**:
  - Extracted and compiled `macroHint` under `### Agent Guidance / Custom Instruction:\n${trimmedHint}\n\n` into `userPrompt`.
  - Dynamically fetched `settings.system_prompt` from `platform_settings` and combined it with strict operational rules into `strictSystemPrompt`.
- **Dual-Model Fallback & 5-Intent Synthesizer (R2)**:
  - Added `signal: AbortSignal.timeout(8000)` to both primary model and fallback model `fetch` calls to OpenRouter.
  - Implemented `synthesizeSmartSupportDraft(threadContent, customerName)` handling 5 specific support domains with personalized greetings (`Hi ${customerName},`) when OpenRouter fails and no macro is matched.
- **Robust Output Sanitization (R3)**:
  - Implemented multi-stage `cleanAiDraft` with:
    - `<think>...</think>` tag stripping.
    - DeepSeek R1 / Gemma 4 multi-paragraph thinking chain extraction via anchor match.
    - Robust code fence extraction with preamble and trailing commentary handling.
    - Iterative meta-header removal (`Subject:[^\n]*`, `Draft reply:`, `Response:`, etc.).
    - Template variables (`{{name}}`, `{{customer_name}}`, `[Customer]`, `[Name]`, `[Customer Name]`, `[Client]`).
    - Sign-off placeholder scrubbing (`[Your Name]`, `[Agent Name]`, `[Company Name]`, `[Support Representative]`, `[Your Title]`, `{{agent_name}}`, `[Support Team]`).
    - Greeting normalization (`Hi ${customerName},`).

### 2.2 NestJS Drafts Service (`packages/api/src/drafts/drafts.service.ts`)
- **Custom Guidance Preservation (R1)**:
  - When `dto.macroHint` is passed, if no macro matches in the database, `dto.macroHint` is preserved as `customGuidance` and inserted into the assembled prompt under `### Agent Guidance / Custom Instruction:\n${customGuidance}`.
- **Role Cleanliness (R1)**:
  - Removed duplicate `systemPrompt` from the user message prompt, letting `AiProviderService` supply `system_prompt` cleanly in `{ role: 'system', content: systemPrompt }`.
- **Customer Personalization**:
  - Extracted `customerName` from `dto.threadContent` using `extractSenderName` and passed `customerName` to `this.ai.generateText(prompt, customerName)`.

### 2.3 NestJS AI Provider Service (`packages/api/src/drafts/ai-provider.service.ts`)
- **Upstream Call Resilience & OpenAI Sanitization (R2, R3)**:
  - Added `signal: AbortSignal.timeout(8000)` to primary and fallback OpenRouter fetch calls.
  - In `generateText`, ensured OpenAI completions execute `this.cleanDraft(content, customerName)` before returning.
- **5-Intent Smart Support Synthesizer (R2)**:
  - Enhanced `synthesizeSmartDraft(prompt, customerName)` to detect and handle all 5 key customer support intents (Refunds, Tracking, Account Access, Billing, Technical Troubleshooting, plus General Default), personalized with `Hi ${name},`.
- **Sanitization Pipeline (R3)**:
  - Updated `cleanDraft` to match the comprehensive adversarial sanitization pipeline with greeting normalization, reasoning chain extraction, code fence stripping, and sign-off scrubbing.

### 2.4 Chrome Extension Client (`packages/extension/src/utils/api-client.ts`)
- **Offline Fallback Resilience (R2)**:
  - Updated client-side offline fallback synthesizer in `generateDraft` to evaluate all 5 domain intents (Refunds, Tracking, Account Access, Billing, Technical Troubleshooting, plus General Support) with personalized greetings (`Hi ${name},`).
- **Sanitization Pipeline (R3)**:
  - Updated extension's `cleanAiDraft` with complete reasoning chain extraction, iterative header stripping, sign-off placeholder scrubbing, and greeting normalization.

---

## 3. Verification and Testing Results

### 3.1 Unit Test Execution
- Added new dedicated test suite `packages/web/src/lib/__tests__/ai-core-enhancements.test.ts`.
- Ran complete test suites across packages using Node test runner (`node --experimental-strip-types --test`):
  - `packages/web/src/lib/__tests__/ai-core-enhancements.test.ts`: **15 passing tests**
  - `packages/web/src/lib/__tests__/ai-pipeline.test.ts`: **19 passing tests**
  - `packages/web/src/lib/__tests__/admin-auth.test.ts`: **8 passing tests**
  - `packages/web/src/lib/__tests__/admin-m3.test.ts`: **3 passing tests**
  - `packages/web/src/lib/__tests__/challenger-interactive.test.ts`: **19 passing tests**
  - `packages/extension/src/utils/__tests__/pii-scrubber.test.ts`: **7 passing tests**
  - **Total: 71 tests passed (0 failures)**.

### 3.2 Monorepo Production Builds
- `pnpm build:web`: Success (`next build`, 10/10 pages statically and dynamically generated with zero errors).
- `pnpm build:api`: Success (`nest build`, clean TypeScript compilation).
- `pnpm build:ext`: Success (`vite build`, sidepanel, service worker, and content scripts bundled cleanly).

---

## 4. Summary

All requirements (R1, R2, and R3) have been genuinely and rigorously implemented across all 4 owned files. The system guarantees end-to-end prompt guidance compilation, multi-tier fallback resilience with a 5-intent domain-aware synthesizer, and clean output formatting free of reasoning artifacts and hallucinated sign-off tokens.
