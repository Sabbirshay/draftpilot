# Execution Plan: DraftPilot AI System Diagnosis & Enhancement

## Objectives
Execute the end-to-end diagnosis, enhancement, and verification across Next.js API, NestJS backend, Admin AI Config, and Chrome Extension:
1. **R1: Custom Instruction & Contextual Prompt Compilation**
   - Next.js `/api/drafts/generate` & NestJS `AiProviderService`
   - Incorporate `macroHint` / user prompt overrides / knowledge chunks into prompt context.
2. **R2: Dual-Model Fallback & Smart Support Synthesizer Resilience**
   - Harden multi-tier fallback cascade: primary model -> secondary fallback -> local domain-aware smart support synthesizer.
   - Handle rate limits (429), timeouts, missing keys, offline/mock resilience.
3. **R3: Output Sanitization & Format Enforcement**
   - Remove `<think>` blocks, reasoning chains, markdown wrapper blocks (` ```markdown `, ` ``` `), header commentary.
   - Normalize greetings (`Hi [Name],`) and professional sign-offs.
4. **R4: Super Admin AI Playground & Dynamic Routing**
   - Super Admin AI Configuration (`/admin` -> AI Config) with live model switching, temperature/token tuning.
   - `platform_settings` persistence, playground draft test runner.
5. **R5: Non-Destructive Integrity & Build Verification**
   - Ensure all existing tests pass (`pnpm test`) and production builds (`pnpm build:web`, `pnpm build:api`, `pnpm build:ext`) succeed with zero errors.

## Phased Workflow
- **Phase 0: Multi-Perspective Survey Exploration**
  - Explorer 1 (API & Next.js): Analyze `/api/drafts/generate`, prompt compilation, output sanitization, format filters.
  - Explorer 2 (NestJS & Synthesizer): Analyze `AiProviderService`, OpenRouter client, multi-tier fallback, smart support synthesizer.
  - Explorer 3 (Admin & Playground): Analyze `/admin` AI Config, `platform_settings` sync, extension playground testing.
- **Phase 1: Milestone Partition & Implementation**
  - Implement R1 & R3 (Prompt Compilation & Sanitization)
  - Implement R2 (Fallback & Resilience)
  - Implement R4 (Admin AI Config & Playground)
- **Phase 2: Comprehensive Multi-Agent Verification**
  - Reviewers for code quality & interface contracts
  - Challengers for adversarial test cases & offline/fallback stress testing
  - Forensic Auditor for integrity verification
  - Build & test validation across all packages
