# Handoff Report: Requirements R1 & R3 Survey & Diagnosis

**Subagent:** `explorer_survey_prompt`  
**Date:** 2026-08-31  
**Working Directory:** `/home/md-roni-ahamed/Test project/.agents/explorer_survey_prompt`  
**Full Investigation Report:** `/home/md-roni-ahamed/Test project/.agents/explorer_survey_prompt/report.md`

---

## 1. Observation

Direct code observations with exact line numbers across the repository:

1. **Next.js API Prompt Assembly (`packages/web/src/app/api/drafts/generate/route.ts`)**:
   - Line 96: `const { threadContent, macroHint, matchedMacro, kbSnippets } = body;`
   - Lines 118–124: Hardcoded `strictSystemPrompt` ignoring `settings.system_prompt` fetched on line 108.
   - Lines 131–137: `knowledgeContext` appends `matchedMacro.content` and `kbSnippets`.
   - Line 139: `const userPrompt = \`Customer Message:\\n\${threadContent}\\n\\n\${knowledgeContext}Write the clean, direct customer email reply now:\`;`
   - **Verbatim finding:** `macroHint` is never referenced after destructuring on line 96; it is absent from `userPrompt` and `strictSystemPrompt`.

2. **Next.js API Sanitization Routine (`packages/web/src/app/api/drafts/generate/route.ts`)**:
   - Line 11: `text = text.replace(/^(?:Here's a thinking process:?|Thinking:?|Here is the thinking process:?)[\s\S]*?\\n\\n/i, '').trim();`
   - Line 12: `text = text.replace(/^\\d+\\.\\s+\\*\\*Analyze User Input:\\*\\*[\\s\\S]*?\\n\\n/i, '').trim();`
   - **Verbatim finding:** Terminating on the first `\n\n` causes multi-paragraph reasoning chains from models like DeepSeek R1 to leak into the user draft.

3. **NestJS Prompt Assembly (`packages/api/src/drafts/drafts.service.ts`)**:
   - Lines 28–35: `if (dto.macroHint) { ... supabase.getClient().from('macros').ilike('name', \`%\${dto.macroHint}%\`)... }`
   - Lines 87–94: If `dto.macroHint` is a custom instruction and does not match a database macro by name, `macroContent` remains empty and `dto.macroHint` is never added to `prompt`.
   - Line 87 & `ai-provider.service.ts` Line 84: `systemPrompt` is prepended to the user prompt string and also passed in the OpenAI/OpenRouter system role message.

4. **NestJS AI Provider Sanitization (`packages/api/src/drafts/ai-provider.service.ts`)**:
   - Lines 146–148: `const content = response.choices[0]?.message?.content?.trim(); if (content) return content;` (OpenAI returns uncleaned raw text without calling `cleanDraft`).
   - Lines 157–183: `cleanDraft` lacks template variable substitution (`{{name}}`, `[Customer]`, `[Name]`) and customer greeting normalization (`Hi [Name],`).

5. **Sign-off Placeholder Gaps Across All Implementations**:
   - None of the sanitization functions in `route.ts`, `ai-provider.service.ts`, `api-client.ts`, or `AdminAIConfig.tsx` scrub placeholder sign-offs such as `[Your Name]`, `[Agent Name]`, `[Company Name]`, or `[Support Representative]`.

---

## 2. Logic Chain

1. **R1 Custom Instruction Failure**:
   - *Observation:* The Chrome extension allows users to type custom instructions into `#macro-hint` and sends it as `macroHint` in the POST body to `/api/drafts/generate`.
   - *Observation:* `packages/web/src/app/api/drafts/generate/route.ts` destructures `macroHint` at line 96, but never includes it in `userPrompt` or `strictSystemPrompt`.
   - *Conclusion:* User guidance and prompt overrides are discarded on the server, failing Requirement R1 acceptance criteria ("Passing custom instructions visibly shapes the generated reply").

2. **R1 Admin System Directives Failure**:
   - *Observation:* Super Admin AI Config allows administrators to set a custom system prompt and saves it to `platform_settings.system_prompt`.
   - *Observation:* `route.ts` line 108 queries `platform_settings`, but lines 118–124 use a static template string for `strictSystemPrompt`.
   - *Conclusion:* Admin AI configuration updates have zero effect on draft generation in Next.js, violating Requirement R1 and R4.

3. **R3 Multi-Paragraph Reasoning Leakage**:
   - *Observation:* `route.ts` line 11 uses a non-greedy regex `[\s\S]*?\n\n` to strip thinking headers.
   - *Observation:* Multi-step reasoning chains contain multiple paragraph breaks (`\n\n`).
   - *Conclusion:* Paragraphs 2 through N of the model's internal thinking process remain intact and are presented to customer support agents, violating Requirement R3.

4. **R3 NestJS Sanitization Gaps**:
   - *Observation:* `ai-provider.service.ts` line 147 returns OpenAI content without running `cleanDraft()`.
   - *Observation:* `cleanDraft()` lacks customer name substitution and greeting personalization.
   - *Conclusion:* Output through the NestJS AI pipeline contains raw markdown code blocks, placeholders, and inconsistent formatting.

---

## 3. Caveats

- **Network-Restricted Test Environment**: Direct execution of `pnpm test` via the package manager binary was prevented by the sandbox offline state (EAI_AGAIN on registry fetch). However, all test suites and compiler builds were executed directly using Node 22 (`--experimental-strip-types`), `vite build`, `nest build`, and `next build`, verifying 100% test pass rate and zero compilation errors.
- **Provider API Keys**: Testing against live upstream OpenRouter endpoints during investigation relies on mocked/synthetic responses or local offline fallbacks when live credentials are not present in the local environment.

---

## 4. Conclusion

- **Requirement R1 Diagnosis**: Confirmed broken in both Next.js and NestJS. Prompt assembly must be updated to inject `macroHint` / custom instructions explicitly under a dedicated guidance header and incorporate `settings.system_prompt`.
- **Requirement R3 Diagnosis**: Confirmed multiple sanitization gaps (multi-paragraph reasoning leakage in Next.js, uncleaned OpenAI responses in NestJS, missing sign-off placeholder scrubbing across all platforms, code fence preamble/postscript edge cases).
- Complete architectural blueprints and unified implementation code have been documented in `/home/md-roni-ahamed/Test project/.agents/explorer_survey_prompt/report.md`.

---

## 5. Verification Method

To independently verify these findings:

1. **Inspect Next.js Prompt Compilation**:
   - Inspect `/home/md-roni-ahamed/Test project/packages/web/src/app/api/drafts/generate/route.ts` lines 96 and 131–140 to verify `macroHint` and `settings.system_prompt` are omitted from `userPrompt`.
2. **Inspect NestJS Prompt Compilation**:
   - Inspect `/home/md-roni-ahamed/Test project/packages/api/src/drafts/drafts.service.ts` lines 28–41 and 87–95 to verify custom non-macro `macroHint` values are dropped.
3. **Inspect Sanitization Pipelines**:
   - Inspect `cleanAiDraft` in `route.ts` (lines 6–30) and `cleanDraft` in `ai-provider.service.ts` (lines 146–183).
4. **Run Unit Tests & Builds**:
   ```bash
   export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
   node --experimental-strip-types "packages/web/src/lib/__tests__/challenger-interactive.test.ts"
   node --experimental-strip-types "packages/web/src/lib/__tests__/admin-auth.test.ts"
   node --experimental-strip-types "packages/web/src/lib/__tests__/admin-m3.test.ts"
   cd packages/extension && ../../node_modules/.bin/vite build
   cd ../api && ../../node_modules/.bin/nest build
   cd ../web && ../../node_modules/.bin/next build
   ```
