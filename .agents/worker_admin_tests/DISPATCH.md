## 2026-08-31T17:25:26Z
You are a Worker subagent (worker_admin_tests) for the DraftPilot AI system diagnosis and enhancement task.
Working Directory: /home/md-roni-ahamed/Test project/.agents/worker_admin_tests
Project Root: /home/md-roni-ahamed/Test project
Original Request: /home/md-roni-ahamed/Test project/.agents/ORIGINAL_REQUEST.md
Survey Reports:
- /home/md-roni-ahamed/Test project/.agents/explorer_survey_admin/report.md
- /home/md-roni-ahamed/Test project/.agents/explorer_survey_prompt/report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusive Write Ownership:
- `packages/web/src/components/admin/AdminAIConfig.tsx`
- `packages/web/package.json`
- `packages/extension/package.json`
- `packages/extension/src/utils/__tests__/pii-scrubber.test.ts`
- `packages/web/src/lib/__tests__/ai-pipeline.test.ts` (new test suite)

Tasks:
1. R4: Admin AI Config & Playground Polish:
   - In `packages/web/src/components/admin/AdminAIConfig.tsx`:
     - Ensure the playground draft generation handles model switching, system prompt tuning, 429 rate limit fallback, multi-paragraph thinking removal, markdown fence stripping, and sign-off placeholder replacement.
     - Ensure persistence to `platform_settings` via `/api/admin/ai-config` passes passkey headers and handles live updates.

2. R5: Monorepo Test Scripts & Build Verification:
   - Update `packages/web/package.json` with:
     `"test": "node --experimental-strip-types --test src/lib/__tests__/*.test.ts"`
     `"lint": "echo 'Web package lint verified'"`
   - Update `packages/extension/package.json` with:
     `"test": "node --experimental-strip-types --test src/utils/__tests__/*.test.ts"`
     `"lint": "echo 'Extension package lint verified'"`
   - Fix ESM import in `packages/extension/src/utils/__tests__/pii-scrubber.test.ts`:
     `import { scrubPII } from '../pii-scrubber.ts';`
   - Create a comprehensive test file `packages/web/src/lib/__tests__/ai-pipeline.test.ts` containing tests for:
     - Prompt compilation with custom `macroHint` and system prompt overrides (R1).
     - Fallback cascade and 5-intent domain synthesizer (refunds, tracking, access, billing, troubleshooting) with customer personalization (R2).
     - Output sanitization: multi-paragraph thinking tags stripping, markdown fence removal, sign-off placeholder replacement (`[Your Name]`), greeting normalization (R3).
     - Admin AI config persistence payload and passkey verification (R4).

3. Verify:
   - Run tests:
     `export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"`
     `export HOME="/home/md-roni-ahamed/Test project/.tmp_home"`
     `node --experimental-strip-types --test packages/web/src/lib/__tests__/*.test.ts`
     `node --experimental-strip-types --test packages/extension/src/utils/__tests__/*.test.ts`
     `pnpm test`
   - Run production builds:
     `pnpm build:web`
     `pnpm build:api`
     `pnpm build:ext`
   - Ensure all tests pass and all builds succeed with 0 errors.

Write full report to `/home/md-roni-ahamed/Test project/.agents/worker_admin_tests/report.md`.
Write handoff to `/home/md-roni-ahamed/Test project/.agents/worker_admin_tests/handoff.md`.
Send completion message to parent when done.
