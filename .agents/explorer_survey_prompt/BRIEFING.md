# BRIEFING — 2026-08-31T17:24:40Z

## Mission
Map and diagnose Requirements R1 (Custom Instruction & Contextual Prompt Compilation) and R3 (Output Sanitization & Format Enforcement) across Next.js API, NestJS backend, and Chrome Extension.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, analyzer, synthesizer
- Working directory: /home/md-roni-ahamed/Test project/.agents/explorer_survey_prompt
- Original parent: 65bc6204-fcb2-4ef6-af13-82c27248c6b0
- Milestone: M1 / Diagnosis Survey

## 🔒 Key Constraints
- Read-only investigation — do NOT modify application source code
- Files for content delivery (`report.md`, `handoff.md`, `progress.md`, `BRIEFING.md`)
- Exact evidence chains with file paths and line numbers
- Send concise summary to parent via send_message when finished

## Current Parent
- Conversation ID: 65bc6204-fcb2-4ef6-af13-82c27248c6b0
- Updated: 2026-08-31T17:24:40Z

## Investigation State
- **Explored paths**:
  - `packages/web/src/app/api/drafts/generate/route.ts`
  - `packages/api/src/drafts/drafts.service.ts`
  - `packages/api/src/drafts/ai-provider.service.ts`
  - `packages/api/src/drafts/dto/generate-draft.dto.ts`
  - `packages/extension/src/utils/api-client.ts`
  - `packages/extension/src/sidepanel/sidepanel.ts`
  - `packages/web/src/components/admin/AdminAIConfig.tsx`
  - `packages/web/src/lib/__tests__/challenger-interactive.test.ts`
- **Key findings**:
  - R1: `macroHint` is completely omitted from prompt compilation in Next.js (`route.ts:139`) and dropped in NestJS (`drafts.service.ts:28-95`) if not matching a DB macro name. Custom instructions are ignored.
  - R1: Admin `system_prompt` from `platform_settings` is ignored by Next.js in favor of a hardcoded string.
  - R3: Multi-paragraph thinking process leakage in Next.js `cleanAiDraft` due to non-greedy `\n\n` regex termination.
  - R3: OpenAI completions in NestJS `AiProviderService` bypass `cleanDraft` entirely.
  - R3: NestJS lacks customer name normalization and greeting personalization.
  - R3: Sign-off placeholders (`[Your Name]`, `[Agent Name]`) are not sanitized in any layer.
- **Unexplored areas**: None for R1 & R3 scope.

## Key Decisions Made
- Authored comprehensive survey report in `report.md` with complete evidence chains, code analysis, and proposed solutions.
- Authored 5-component handoff report in `handoff.md`.

## Artifact Index
- `/home/md-roni-ahamed/Test project/.agents/explorer_survey_prompt/report.md` — Full survey findings & architecture blueprints
- `/home/md-roni-ahamed/Test project/.agents/explorer_survey_prompt/handoff.md` — 5-component handoff report
- `/home/md-roni-ahamed/Test project/.agents/explorer_survey_prompt/progress.md` — Progress tracker
