# Master Orchestration Plan

## Objective
Diagnose OpenRouter rate-limit/daily limit alerts, enhance Admin AI Config key verification to query `/api/v1/auth/key` for real-time telemetry, update the playground rate-limit banner to show verbatim upstream error messages and actionable fallback instructions, and verify full monorepo builds and tests.

## Phase 0: Survey & Scope Mapping (Parallel Explorers)
- **Explorer 1**: Investigate OpenRouter client implementation, API request handlers, rate-limiting detection, error parsing, and `/api/v1/chat/completions` handling across backend/services.
- **Explorer 2**: Investigate `AdminAIConfig.tsx`, `handleVerifyKey`, UI components for key management, quota/balance display, and `/api/v1/auth/key` integration points.
- **Explorer 3**: Investigate test infrastructure, test suites (`pnpm test`), build scripts (`pnpm build:web`, `pnpm build:api`, `pnpm build:ext`), mock setups, and existing error-handling tests.

## Phase 1: Decomposition & Specification
- Synthesize explorer findings into `PROJECT.md` (architecture, feature inventory, milestones, interface contracts, code layout) and `TEST_INFRA.md`.
- Establish milestone boundaries:
  - M1: OpenRouter Upstream Response Parsing, Error Differentiation (daily limit, concurrency, congestion, invalid key) & API Service Layer
  - M2: Key Quota & Balance Telemetry in `AdminAIConfig.tsx` via `/api/v1/auth/key`
  - M3: Verbatim Upstream Error & Advisory UI with Actionable Guidance & Fallback Preview
  - M4: Comprehensive Test Suite & Monorepo Build Verification

## Phase 2: Execution & Verification Loop
- For each milestone:
  1. Explorer (3) recommendations
  2. Worker (1) implementation with integrity warnings
  3. Reviewers (2) code & interface review
  4. Challengers (2) empirical testing
  5. Forensic Auditor (1) integrity forensics
  6. Gate check -> Pass/Fail loop

## Phase 3: Final E2E Suite, Hardening, and Build Verification
- Full test pass (`pnpm test`, `pnpm build:web`, `pnpm build:api`, `pnpm build:ext`)
- Forensic audit clean check

## Phase 4: Final Reporting
- Present complete verification results and victory claim to user/parent.
