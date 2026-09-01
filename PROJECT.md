# Project: OpenRouter Upstream Response Validation, Key Telemetry & Verbatim Advisory UI

## Architecture
- **Web Frontend (`packages/web`)**: Next.js 14 App Router, React 18, Tailwind CSS, Lucide icons.
  - `packages/web/src/components/admin/AdminAIConfig.tsx`: Central component for AI Provider configuration, model selection, live API key verification (`/api/v1/auth/key`), telemetry display, and interactive playground test draft generation (`/api/v1/chat/completions`).
- **Backend API (`packages/api`)**: NestJS 10, AI Provider Service (`AiProviderService`), Drafts Service.
- **Chrome Extension (`packages/extension`)**: Manifest V3, Vite 5, Sidebar Draft Assistant.
- **Test Infrastructure (`packages/web/src/lib/__tests__/`)**: Node.js native test runner (`node:test`, `node:assert`), comprehensive unit and integration test harnesses.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Upstream Error Classification & Parsing | Differentiate between 429 Daily Cap (50 req/day on $0 balance), 429 Concurrency (20 req/min), 503/529 Model Congestion, 402 Credits Exhausted, 401 Invalid Key, and general failures | M2 | ORIGINAL_REQUEST §1 |
| 2 | Verbatim Upstream Error Extraction | Extract verbatim `data?.error?.message` or raw error payload from live `/api/v1/chat/completions` responses | M2 | ORIGINAL_REQUEST §1, §3 |
| 3 | `/api/v1/auth/key` Live Telemetry Ingestion | Upgrade `handleVerifyKey` in `AdminAIConfig.tsx` to query OpenRouter auth/key endpoint and parse `label`, `usage`, `limit`, `limit_remaining`, `is_free_tier`, `rate_limit` | M1 | ORIGINAL_REQUEST §2 |
| 4 | Real-Time Key Quota & Balance Telemetry Grid | Render a 4-card telemetry grid below the API key input displaying key label, usage in USD, remaining credit limit, rate limit interval, and free-tier status badge | M1 | ORIGINAL_REQUEST §2 |
| 5 | Verbatim Error & Actionable Advisory UI | Replace hardcoded 50 req/day banner with a dynamic advisory banner showing verbatim upstream error, categorized badge, actionable resolution steps, and direct credit top-up link | M2 | ORIGINAL_REQUEST §3 |
| 6 | Immediate Grounded Fallback Draft Preview | Present the high-fidelity offline synthesizer fallback draft in the playground with clear status badge when upstream OpenRouter calls fail | M2 | ORIGINAL_REQUEST §3 |
| 7 | Comprehensive Telemetry & Error Test Suite | Automated test suite (`openrouter-telemetry.test.ts`) covering all telemetry parsing, 5-category error classification, verbatim extraction, and fallback logic | M3 | ORIGINAL_REQUEST §4 |
| 8 | Full Monorepo Build & Test Suite Verification | Verify all unit/integration tests (`pnpm test`) and production builds (`pnpm build:web`, `pnpm build:api`, `pnpm build:ext`) pass with zero regressions | M3 | ORIGINAL_REQUEST §4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Real-Time Key Quota & Balance Telemetry | Upgrade `handleVerifyKey` in `AdminAIConfig.tsx` to query `/api/v1/auth/key`, capture complete telemetry state, and render the 4-card telemetry UI grid | none | IN_PROGRESS |
| 2 | Verbatim Upstream Error Diagnostics & Playground Advisory UI | Refactor playground draft testing in `AdminAIConfig.tsx` to extract verbatim upstream errors, classify error categories, display actionable guidance banner, and render grounded fallback draft | M1 | PLANNED |
| 3 | E2E Test Suite & Monorepo Build Verification | Implement `openrouter-telemetry.test.ts` test suite, verify full monorepo tests (`pnpm test`), and run all production builds (`build:web`, `build:api`, `build:ext`) | M1, M2 | PLANNED |

## Interface Contracts
### OpenRouter Auth/Key Telemetry Schema
```typescript
export interface OpenRouterKeyTelemetry {
  label: string | null;
  usage: number; // in USD
  limit: number | null; // in USD, null if unlimited
  limit_remaining?: number | null; // in USD
  is_free_tier: boolean;
  rate_limit: {
    requests: number;
    interval: string; // e.g. "10s", "1m"
  };
}
```

### OpenRouter Error Classification Interface
```typescript
export type OpenRouterErrorCategory =
  | 'daily_cap'        // 429 with free tier daily cap (50 reqs/day on $0 balance)
  | 'rate_limit'       // 429 short term burst concurrency (20 reqs/min)
  | 'congestion'       // 503 / 529 / model queue congestion
  | 'credits_exhausted'// 402 insufficient credits / non-free model without balance
  | 'auth_error'       // 401 invalid API key
  | 'general';         // other network/API errors

export interface OpenRouterErrorDiagnostics {
  category: OpenRouterErrorCategory;
  verbatimMessage: string;
  statusCode: number;
  actionableGuidance: string;
}
```

## Code Layout
- `packages/web/src/components/admin/AdminAIConfig.tsx`: UI component for admin settings, telemetry grid, test draft playground, and advisory banners. Owned exclusively by Worker during M1/M2.
- `packages/web/src/lib/__tests__/openrouter-telemetry.test.ts`: Dedicated test suite for OpenRouter telemetry parsing, error classification, and fallback verification. Owned by Worker / Test Writer during M3.
- `packages/web/src/lib/__tests__/ai-pipeline.test.ts`: AI pipeline regression test suite.
