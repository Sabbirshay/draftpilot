# Original User Request

## 2026-09-01T05:50:29Z

Validate why OpenRouter rate-limit / daily limit alerts are triggered, verify the live upstream OpenRouter API responses (`/api/v1/chat/completions`), enhance the Admin AI Config key verification to query `/api/v1/auth/key` for real-time balance and usage statistics, and ensure transparent upstream error reporting in the admin playground.

Working directory: /home/md-roni-ahamed/Test project
Integrity mode: development

## Requirements

### R1. Live OpenRouter Upstream Response Validation & Diagnosis
Audit the exact upstream HTTP response returned by OpenRouter during live test draft generations. Differentiate between:
1. Free-tier daily account caps (50 requests/day on $0 balance)
2. Per-minute concurrency limits (20 requests/minute)
3. Model-specific queue congestion (busy free models)
4. Invalid or unauthenticated keys

### R2. Real-Time Key Quota & Balance Telemetry
Upgrade the `handleVerifyKey` method in `AdminAIConfig.tsx` to query `https://openrouter.ai/api/v1/auth/key` and display live account telemetry (key label, usage amount, remaining credit limit, rate limit interval, and free-tier status).

### R3. Verbatim Error & Advisory UI
Update the playground rate-limit banner in `AdminAIConfig.tsx` to show the verbatim upstream error message from OpenRouter, along with actionable instructions to resolve it (e.g. adding credits or switching free models) and immediate fallback preview.

### R4. Build & Test Verification
Run full monorepo test suites (`pnpm test`) and production builds (`pnpm build:web`, `pnpm build:api`, `pnpm build:ext`) to guarantee zero regressions.

## Acceptance Criteria

### Diagnostics & UI Telemetry
- [ ] Admin AI Config displays live key usage, credit limits, and rate limits directly from OpenRouter when clicking "Verify Key".
- [ ] The playground banner shows the verbatim upstream error from OpenRouter and clearly explains the exact reason (daily limit vs concurrency vs congestion).

### Build Verification
- [ ] `pnpm test`, `pnpm build:web`, `pnpm build:api`, and `pnpm build:ext` all succeed with zero errors.
