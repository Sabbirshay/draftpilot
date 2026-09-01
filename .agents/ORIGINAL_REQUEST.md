# Original User Request

## 2026-08-31T17:18:27Z

<USER_REQUEST>
Perform a comprehensive diagnosis and enhancement of the DraftPilot AI system across the Next.js API (`/api/drafts/generate`), NestJS AI backend (`AiProviderService`), Super Admin AI configuration (`AdminAIConfig`), and Chrome Extension client to ensure contextual instructions, model fallback cascades, prompt assembly, output sanitization, and live playground testing operate flawlessly without regressions.

Working directory: /home/md-roni-ahamed/Test project
Integrity mode: development

## Requirements

### R1. Custom Instruction & Contextual Prompt Compilation
Audit and verify that custom AI instructions (`macroHint` / user prompt overrides) and matched macros / knowledge chunks are properly compiled into the final LLM prompt context across both Next.js (`/api/drafts/generate`) and NestJS (`AiProviderService`) AI pipelines, ensuring user guidance directly shapes the output.

### R2. Dual-Model Fallback & Smart Support Synthesizer Resilience
Verify and harden the multi-tier fallback cascade (primary model -> secondary fallback -> local domain-aware smart support synthesizer) so draft generation gracefully recovers during OpenRouter upstream rate limits (429), timeouts, network drops, or missing credentials.

### R3. Output Sanitization & Format Enforcement
Ensure all AI outputs are strictly sanitized to remove reasoning artifacts (such as `<think>` blocks, reasoning chains, analysis headers, and markdown code fences) and normalize customer greetings (`Hi [Name],`) and professional sign-offs.

### R4. Super Admin AI Playground & Dynamic Routing
Validate the Super Admin AI Configuration suite (`/admin` -> AI Config) for live model switching, temperature/token tuning, custom system prompt persistence, and interactive playground draft testing.

### R5. Non-Destructive Integrity & Build Verification
Preserve all existing functionality and ensure complete test suites (`pnpm -r test`) and production builds (`pnpm build:web`, `pnpm build:api`, `pnpm build:ext`) compile cleanly with zero errors.

## Acceptance Criteria

### Prompt Compilation & Quality
- [ ] Passing custom instructions (e.g. "Apologize and offer discount") visibly shapes the generated reply.
- [ ] Output is clean plain text ready for email insertion, with no leftover reasoning tokens or markdown wrapper blocks.

### Fallback Reliability
- [ ] When upstream providers return errors or rate limits, the system seamlessly transitions to fallback models or the domain synthesizer without crashing or stalling.
- [ ] Offline / mock testing produces contextually relevant replies for customer support intents (refunds, tracking, billing, access).

### Admin Controls & Build Health
- [ ] Admin AI configuration updates persist to `platform_settings` and take effect immediately on draft generation requests.
- [ ] `pnpm test`, `pnpm build:web`, `pnpm build:api`, and `pnpm build:ext` all succeed with zero errors.

</USER_REQUEST>
