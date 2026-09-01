# E2E Test Infra: OpenRouter Live Diagnostics & Telemetry

## Test Philosophy
- Opaque-box and unit/integration verification of OpenRouter API interaction, key telemetry parsing, multi-category error classification, verbatim error extraction, and fallback draft generation.
- Automated testing via Node.js native test runner (`node --experimental-strip-types --test`) in `packages/web` and `packages/extension`, Jest in `packages/api`.

## Feature Inventory Test Mapping
| # | Feature | Source | Tier 1 (Unit) | Tier 2 (Boundary) | Tier 3 (Cross) | Tier 4 (Scenario) |
|---|---------|--------|:-------------:|:-----------------:|:--------------:|:-----------------:|
| 1 | Upstream Error Classification | ORIGINAL_REQUEST §1 | 5 | 5 | ✓ | ✓ |
| 2 | Verbatim Error Extraction | ORIGINAL_REQUEST §1, §3 | 5 | 5 | ✓ | ✓ |
| 3 | `/api/v1/auth/key` Telemetry Ingestion | ORIGINAL_REQUEST §2 | 5 | 5 | ✓ | ✓ |
| 4 | Telemetry Grid Formatting | ORIGINAL_REQUEST §2 | 5 | 5 | ✓ | ✓ |
| 5 | Verbatim Error & Advisory UI | ORIGINAL_REQUEST §3 | 5 | 5 | ✓ | ✓ |
| 6 | Grounded Fallback Draft Preview | ORIGINAL_REQUEST §3 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test runner: `node --experimental-strip-types --test src/lib/__tests__/*.test.ts`
- Environment: `export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"` and `export HOME="/home/md-roni-ahamed/Test project/.tmp_home"`
- Test suite path: `packages/web/src/lib/__tests__/openrouter-telemetry.test.ts`
- Monorepo full runner: `pnpm test`
- Monorepo production build runner: `pnpm build:web && pnpm build:api && pnpm build:ext`

## Coverage Thresholds
- Unit test cases for all 5 error categories (Daily Cap, Concurrency, Congestion, Credits Exhausted, Invalid Key).
- Boundary tests for telemetry schema: missing label, null limit (unlimited), 0 usage, non-free tier, custom rate limit intervals.
- Integration tests simulating live `/api/v1/chat/completions` error responses and verifying fallback draft generation.
