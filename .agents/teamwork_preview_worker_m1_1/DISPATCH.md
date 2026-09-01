## 2026-09-01T05:59:20Z

You are the Worker for Milestone 1: OpenRouter Live Telemetry, Verbatim Upstream Error Diagnostics, Advisory UI & Test Suite.

Your working directory is: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m1_1
Project root: /home/md-roni-ahamed/Test project
Original Request: /home/md-roni-ahamed/Test project/ORIGINAL_REQUEST.md
Project Spec: /home/md-roni-ahamed/Test project/PROJECT.md
Test Spec: /home/md-roni-ahamed/Test project/TEST_INFRA.md

Explorer Reports:
- Explorer 1 (Telemetry & Bento Grid): /home/md-roni-ahamed/Test project/.agents/teamwork_preview_explorer_m1_1/handoff.md
- Explorer 2 (Error Diagnostics & Advisory Banner): /home/md-roni-ahamed/Test project/.agents/teamwork_preview_explorer_m1_2/handoff.md
- Explorer 3 (Test Suite Specification): /home/md-roni-ahamed/Test project/.agents/teamwork_preview_explorer_m1_3/handoff.md

You own exclusively:
1. `packages/web/src/components/admin/AdminAIConfig.tsx`
2. `packages/web/src/lib/__tests__/openrouter-telemetry.test.ts`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implementation Tasks:
1. In `packages/web/src/components/admin/AdminAIConfig.tsx`:
   - Implement `OpenRouterKeyTelemetry` interface and `parseOpenRouterKeyTelemetry` helper function.
   - Upgrade `handleVerifyKey` to query `https://openrouter.ai/api/v1/auth/key`, parse full telemetry (`label`, `usage`, `limit`, `limit_remaining`, `is_free_tier`, `rate_limit`), and update `keyTelemetry` state.
   - Add state reset logic on key change (`handleOpenRouterKeyChange`) and provider switch.
   - Render the dark-theme 4-card Bento grid UI directly below the API Key row in Section 2 when `provider === 'openrouter'`, `keyStatus === 'valid'`, and `keyTelemetry` is present (displaying Key Label, Usage Spend, Remaining Limit, Rate Limit Bandwidth, and Free/Paid Tier badge).
   - Implement `OpenRouterErrorCategory` type and `parseOpenRouterError` diagnostic parser function differentiating between `daily_cap` (50 req/day on $0 balance), `rate_limit` (20 req/min), `congestion` (503/529/model busy), `credits_exhausted` (402), `auth_error` (401), and `general`.
   - Upgrade `handleTestDraft` to extract verbatim upstream error payloads (`data?.error?.message`), classify them, set `errorDiagnostics`, and generate the grounded offline synthesizer fallback draft with `[⚡ Grounded Offline Synthesizer Fallback Active]` prefix.
   - Replace the static rate limit banner in JSX with the dynamic advisory banner displaying category icon/badge, verbatim upstream error code block, actionable resolution guidance, direct credit top-up links, and grounded fallback indicator.
2. In `packages/web/src/lib/__tests__/openrouter-telemetry.test.ts`:
   - Implement the complete test suite designed by Explorer 3 using `node:test` and `node:assert`.
   - Ensure coverage for:
     * Suite 1: `/api/v1/auth/key` parsing & telemetry extraction (free-tier, paid-tier, unlimited, zero usage, custom intervals, error payloads).
     * Suite 2: Multi-category error classification (429 daily cap vs 429 concurrency vs 503/529 congestion vs 402 credits exhausted vs 401 auth failure vs general).
     * Suite 3: Verbatim error message extraction from nested/flat/string/statusText payloads.
     * Suite 4: Offline fallback draft generation across 6 support intents with strict sanitization.
3. Verification:
   - Run tests:
     ```bash
     export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
     export HOME="/home/md-roni-ahamed/Test project/.tmp_home"
     pnpm test
     ```
   - Run production builds:
     ```bash
     export VERCEL=1
     pnpm build:web && pnpm build:api && pnpm build:ext
     ```
   - Ensure all tests pass and all builds compile with 0 errors.

Write your report in `/home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m1_1/handoff.md` and send a completion message to your parent.
