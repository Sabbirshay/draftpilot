## 2026-08-31T17:25:26Z
You are a Worker subagent (worker_ai_core) for the DraftPilot AI system diagnosis and enhancement task.
Working Directory: /home/md-roni-ahamed/Test project/.agents/worker_ai_core
Project Root: /home/md-roni-ahamed/Test project
Original Request: /home/md-roni-ahamed/Test project/.agents/ORIGINAL_REQUEST.md
Survey Reports:
- /home/md-roni-ahamed/Test project/.agents/explorer_survey_prompt/report.md
- /home/md-roni-ahamed/Test project/.agents/explorer_survey_resilience/report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusive Write Ownership:
- `packages/web/src/app/api/drafts/generate/route.ts`
- `packages/api/src/drafts/drafts.service.ts`
- `packages/api/src/drafts/ai-provider.service.ts`
- `packages/extension/src/utils/api-client.ts`

Tasks:
1. R1: Custom Instruction & Contextual Prompt Compilation:
   - Next.js (`packages/web/src/app/api/drafts/generate/route.ts`):
     - In `userPrompt` assembly, include `macroHint` (under `Agent Guidance / Custom Instruction: \n${macroHint}\n\n`) whenever provided.
     - Dynamically use `settings.system_prompt` from `platform_settings` as `strictSystemPrompt` (defaulting to standard customer support directives if empty).
   - NestJS (`packages/api/src/drafts/drafts.service.ts` & `ai-provider.service.ts`):
     - When `dto.macroHint` is passed, if no macro matches by name in DB, preserve `dto.macroHint` as explicit custom guidance in the assembled prompt so it directly shapes LLM generation.
     - Avoid duplicate system prompt roles when passing messages to LLM providers.

2. R2: Dual-Model Fallback & Smart Support Synthesizer Resilience:
   - Next.js (`route.ts`):
     - In fallback flow when OpenRouter primary & fallback fail (e.g. 429 rate limit, missing key, timeout) and no `matchedMacro` is given, execute a 5-intent domain-aware synthesizer (Refunds/Returns, Order Tracking/Shipping, Account/Login Access, Billing/Invoices, Technical Troubleshooting) personalized with `Hi ${customerName},`.
     - Add `AbortSignal.timeout(8000)` to upstream OpenRouter `fetch` calls.
   - NestJS (`ai-provider.service.ts`):
     - Enhance `synthesizeSmartDraft(prompt, customerName)` to support all 5 intents (Refunds, Tracking, Account Access, Billing, Technical Troubleshooting) and personalize with `Hi ${customerName},`.
     - Add `AbortSignal.timeout(8000)` to upstream OpenRouter calls.
   - Extension (`packages/extension/src/utils/api-client.ts`):
     - Ensure client-side offline synthesizer supports all 5 intents and personalized greetings.

3. R3: Output Sanitization & Format Enforcement:
   - Next.js (`route.ts` `cleanAiDraft`) & NestJS (`ai-provider.service.ts` `cleanDraft`):
     - Strip `<think>...</think>` tags and multi-paragraph reasoning chains (DeepSeek R1 / Gemma 4).
     - Strip markdown code fences (```markdown ... ```, ``` ... ```), commentary preambles/postscripts, and "Subject:" / "Draft:" / "Response:" headers.
     - Normalize greetings (`Hi ${customerName},` / `Hi [Name],`).
     - Replace sign-off placeholders (`[Your Name]`, `[Agent Name]`, `[Company Name]`, `[Support Representative]`, `[Your Title]`) with "Customer Support Team".
     - In NestJS `AiProviderService.generateDraft`, ensure OpenAI response calls `this.cleanDraft(content, customerName)` before returning.

Verification:
- Run tests and builds to ensure no syntax/type errors.
- Write full report to `/home/md-roni-ahamed/Test project/.agents/worker_ai_core/report.md`.
- Write handoff to `/home/md-roni-ahamed/Test project/.agents/worker_ai_core/handoff.md`.
- Send completion message to parent.
