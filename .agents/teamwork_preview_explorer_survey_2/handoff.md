# Survey Report: AdminAIConfig, Key Verification Telemetry, OpenRouter Upstream Response & Playground Diagnostics

## 1. Observation

Direct observations from codebase inspection across `packages/web/src/components/admin/AdminAIConfig.tsx`, `packages/web/src/app/api/drafts/generate/route.ts`, `packages/api/src/drafts/ai-provider.service.ts`, and `packages/web/next.config.js`:

### A. Location & Current Implementation of `AdminAIConfig.tsx` and `handleVerifyKey`
- **File Path**: `/home/md-roni-ahamed/Test project/packages/web/src/components/admin/AdminAIConfig.tsx` (794 lines).
- **Current `handleVerifyKey` implementation** (lines 187–245):
  - Validates key prefix (`sk-or-` for OpenRouter, `sk-` for OpenAI).
  - Sends GET request to `https://openrouter.ai/api/v1/auth/key` with `Authorization: Bearer ${trimmed}`.
  - Parses `json?.data` and only extracts `json.data.label` (`const label = json.data.label ? \` (\${json.data.label})\` : '';`).
  - Sets `keyStatus` to `'valid'` and `keyVerifyMessage` to `\Verified & Active\${label}\`.
  - Discards all balance and quota telemetry (`usage`, `limit`, `is_free_tier`, `rate_limit.requests`, `rate_limit.interval`).

### B. Current State Management in `AdminAIConfig.tsx`
- **Existing States**:
  - `provider`: `'openrouter' | 'openai' | 'offline'` (line 46)
  - `openrouterKey`: `string` (line 49)
  - `openrouterModel`: `string` (line 50, default `'google/gemma-4-26b-a4b-it:free'`)
  - `customOpenrouterModel`: `string` (line 51)
  - `showKey`: `boolean` (line 66)
  - `keyStatus`: `'untested' | 'testing' | 'valid' | 'invalid'` (line 67)
  - `keyVerifyMessage`: `string | null` (line 185)
  - `testThread`: `string` (line 71)
  - `testResponse`: `string | null` (line 72)
  - `isTesting`: `boolean` (line 73)
  - `testMetrics`: `{ tokens: number, latency: number }` (line 74)
  - `rateLimitWarning`: `string | null` (line 75)
- **Missing States**:
  - No state for key telemetry metadata (`telemetry`: `{ label: string, usage: number, limit: number | null, is_free_tier: boolean, rate_limit: { requests: number, interval: string } } | null`).
  - No state for structured upstream error diagnostics (`upstreamError`: `{ status: number, code?: string, message: string, category: 'daily_cap' | 'rate_limit' | 'congestion' | 'auth_error' | 'credits_exhausted' | 'general' } | null`).

### C. OpenRouter `/api/v1/auth/key` Response Schema
- **Endpoint**: `GET https://openrouter.ai/api/v1/auth/key`
- **HTTP 200 OK Schema**:
  ```json
  {
    "data": {
      "label": "My Key Label",
      "usage": 0.00,
      "limit": null,
      "is_free_tier": true,
      "rate_limit": {
        "requests": 20,
        "interval": "10s"
      }
    }
  }
  ```
- **Field Definitions**:
  - `label`: `string` — User-assigned key label in OpenRouter console.
  - `usage`: `number` — Cumulative key usage in USD (e.g. `0.0125`).
  - `limit`: `number | null` — Spending limit cap in USD (`null` represents unlimited).
  - `is_free_tier`: `boolean` — `true` if account has $0 balance (subject to 50 req/day cap), `false` if credits exist.
  - `rate_limit`: `{ requests: number, interval: string }` — Burst rate limit (e.g. `20` requests per `"10s"` or `"1m"`).

### D. Playground UI, Rate-Limit Banners & Fallback Preview
- **Current Behavior in `handleTestDraft`** (lines 460–474):
  - When OpenRouter fails, checks `if (errMsg.includes('Rate limit') || errMsg.includes('credits') || response.status === 429)`.
  - Sets `rateLimitWarning(errMsg)` and generates offline smart draft via `generateSmartSupportReply(testThread)`.
- **Current Banner in JSX** (lines 746–759):
  - Hardcodes header to `"⚠️ OpenRouter Free-Tier Daily Limit Reached (50 reqs/day on $0 balance)"`.
  - Hardcodes body to `"OpenRouter limits accounts with $0 credit balance to 50 requests/day across all free models..."`.
  - Does NOT display the verbatim upstream error message from OpenRouter.
  - Does NOT differentiate between:
    1. Daily 50 req/day account cap.
    2. Short-term concurrency/burst rate limit (20 req/min).
    3. Model queue congestion / upstream 503 provider busy.
    4. Invalid / unauthenticated API keys (401).

---

## 2. Logic Chain

1. **Telemetry Capture**:
   - `handleVerifyKey` already contacts `https://openrouter.ai/api/v1/auth/key` (line 198) and parses `json.data`.
   - By capturing the complete `json.data` payload into React state `keyTelemetry`, the UI can immediately display live quota, usage amount, remaining credit limit, rate limit interval, and free-tier status.

2. **Telemetry Formatting & UI Rendering**:
   - **Label**: `data.label || 'Default Key'`
   - **Usage**: `$${data.usage.toFixed(4)}` or `$${data.usage.toFixed(2)}`
   - **Credit Limit & Remaining**:
     - If `data.limit !== null`: `$${data.limit.toFixed(2)} Limit` (Remaining: `$${Math.max(0, data.limit - data.usage).toFixed(2)}`)
     - If `data.limit === null`: `Unlimited`
   - **Free-Tier Status**:
     - If `data.is_free_tier`: Amber badge `Free Tier ($0 Balance · 50 req/day cap)`
     - If `!data.is_free_tier`: Emerald badge `Paid / Active Balance (1,000+ req/day)`
   - **Rate Limit**: `${data.rate_limit.requests} req / ${data.rate_limit.interval}`
   - Render these in a dedicated 4-card telemetry grid directly below the API Key input in `AdminAIConfig.tsx`.

3. **Verbatim Upstream Error Diagnostics & Guidance**:
   - In `handleTestDraft`, when `response.ok` is false or no choices are returned:
     - Extract verbatim upstream error: `data?.error?.message || response.statusText || 'Unknown upstream error'`.
     - Classify error into actionable categories:
       - `daily_cap`: "50 reqs/day limit reached on $0 balance. Top up $10 at openrouter.ai/credits to unlock 1,000 free requests/day."
       - `rate_limit`: "Short-term burst rate limit exceeded. Wait a few seconds before generating another draft."
       - `congestion`: "Upstream model provider is experiencing high traffic or queue delays. Switch to an alternate free model or custom slug."
       - `auth_error`: "Invalid OpenRouter API key. Check key in OpenRouter dashboard."
       - `credits_exhausted`: "Insufficient credits for selected model. Add credits at openrouter.ai/credits."
   - Render a dedicated advisory banner displaying:
     - The **Verbatim Upstream Error Message** in a code-formatted snippet.
     - The **Actionable Resolution Guidance**.
     - The **High-Fidelity Smart Synthesizer Fallback Preview** with clear labeling (`[⚡ Grounded Offline Synthesizer Fallback Active]`).

---

## 3. Caveats

1. **Live External Network Access in Sandbox**: The local build/test sandbox environment restricts live outbound external DNS/HTTP requests (curl returns code 6). Telemetry and OpenRouter calls execute client-side in the user's browser where `connect-src` includes `https://openrouter.ai` and `https://api.openrouter.ai`.
2. **OpenAI Direct Provider**: When `provider === 'openai'`, key verification calls `https://api.openai.com/v1/models` (OpenAI does not provide usage/balance telemetry on standard key headers via that endpoint). The telemetry grid should be conditionally rendered for `provider === 'openrouter'`.
3. **Build Environment Settings**: In monorepo builds, `VERCEL=1` is passed to Next.js build (`VERCEL=1 pnpm build:web`) to avoid standalone directory copy issues.

---

## 4. Conclusion

- Upgrading `handleVerifyKey` requires storing `json.data` in a new React state (`keyTelemetry`) and rendering a 4-metric telemetry grid (Key Label, Usage Amount, Remaining Credit Limit, Rate Limit Interval, Free-Tier Status).
- Upgrading the playground error handling requires capturing the verbatim upstream OpenRouter response, categorizing the failure (daily cap vs rate limit vs congestion vs auth), displaying actionable resolution guidance, and presenting the immediate grounded fallback draft.
- All dependencies, monorepo test suites (`pnpm test`), and production builds (`pnpm build:web`, `pnpm build:api`, `pnpm build:ext`) are fully operational and verified.

---

## 5. Verification Method

1. **Test Suite Execution**:
   ```bash
   export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
   export HOME="/home/md-roni-ahamed/Test project/.tmp_home"
   export PNPM_HOME="/home/md-roni-ahamed/Test project/.tmp_home/share/pnpm"
   pnpm test
   ```
2. **Production Builds**:
   ```bash
   VERCEL=1 pnpm build:web && pnpm build:api && pnpm build:ext
   ```
3. **Code Verification**:
   - Inspect `packages/web/src/components/admin/AdminAIConfig.tsx` to verify `handleVerifyKey` telemetry parsing, telemetry UI bento cards, verbatim upstream error banner, and fallback draft preview.
