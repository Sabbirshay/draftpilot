## 2026-09-01T05:56:12Z
Task:
Investigate the exact changes needed in `packages/web/src/components/admin/AdminAIConfig.tsx` for real-time key quota & balance telemetry:
1. Review `handleVerifyKey` (around lines 187–245) where `GET https://openrouter.ai/api/v1/auth/key` is queried.
2. Define the exact TypeScript interface for the telemetry state:
   `OpenRouterKeyTelemetry`: `label`, `usage` (number), `limit` (number | null), `limit_remaining` (number | null), `is_free_tier` (boolean), `rate_limit` ({ requests: number, interval: string }).
3. Formulate how `handleVerifyKey` should parse `json?.data` when status is 200, update the React state (`keyTelemetry`), and format each metric:
   - Key Label: `data.label || 'Default / Primary Key'`
   - Usage: `$${data.usage.toFixed(4)}` or `$${data.usage.toFixed(2)}`
   - Remaining Limit: `data.limit !== null ? '$' + (data.limit - data.usage).toFixed(2) + ' remaining' : 'Unlimited'`
   - Free Tier / Tier Badge: Amber badge if `is_free_tier` ("Free Tier ($0 Balance · 50 req/day cap)"), Emerald badge if paid ("Paid Tier (1,000+ req/day)")
   - Rate Limit Interval: `${data.rate_limit.requests} req / ${data.rate_limit.interval}`
4. Design the JSX layout and styling (Tailwind CSS matching DraftPilot dark theme bento design) for the 4-card telemetry grid to render directly below the API Key input row when `keyStatus === 'valid'` and `keyTelemetry` is present.
5. Identify any edge cases (e.g. key reset, switching provider to 'openai', error handling on invalid key).
