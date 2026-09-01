# Milestone 1 Investigation Report: OpenRouter Real-Time Key Quota & Balance Telemetry

## 1. Observation
1. **Target Component**: `packages/web/src/components/admin/AdminAIConfig.tsx` (Lines 185–245)
   - Currently, `handleVerifyKey` executes a `GET` request to `https://openrouter.ai/api/v1/auth/key` with `Authorization: Bearer ${trimmed}`.
   - Lines 201–208 currently inspect only `res.ok` and `json?.data`, setting `keyVerifyMessage` with `json.data.label ? \` (\${json.data.label})\` : ''`.
   - **Verbatim Current Implementation (`AdminAIConfig.tsx:198-212`)**:
     ```typescript
     const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
       headers: { Authorization: `Bearer ${trimmed}` },
     });
     const json = await res.json().catch(() => null);
     if (res.ok && json?.data) {
       setKeyStatus('valid');
       const label = json.data.label ? ` (${json.data.label})` : '';
       setKeyVerifyMessage(`Verified & Active${label}`);
       if (typeof window !== 'undefined') {
         localStorage.setItem('draftpilot_openrouter_key', trimmed);
       }
     } else {
       setKeyStatus('invalid');
       setKeyVerifyMessage(json?.error?.message || 'Invalid OpenRouter Key');
     }
     ```
2. **OpenRouter `/api/v1/auth/key` Upstream Payload Schema**:
   - The live OpenRouter authentication endpoint returns:
     ```json
     {
       "data": {
         "label": "My Key Label",
         "usage": 0.004512,
         "limit": 10.0,
         "is_free_tier": false,
         "rate_limit": {
           "requests": 200,
           "interval": "10s"
         }
       }
     }
     ```
   - When accounts have no credit balance ($0 balance), OpenRouter flags `"is_free_tier": true` with daily rate caps of 50 requests/day.
   - When `"limit"` is `null`, the account has unlimited credit balance ceiling.
3. **Current State Deficiency in UI**:
   - `AdminAIConfig.tsx` lacks a React state variable `keyTelemetry` (`OpenRouterKeyTelemetry | null`).
   - Section 2 (API Key Configuration, lines 526–587) only renders an inline text tag (`✓ Verified & Active`), discarding rich account insights (usage spend, limit remaining, free tier cap vs paid tier, and rate limit bandwidth).

---

## 2. Logic Chain
1. **State Definition & Ingestion**:
   - By creating an explicit TypeScript interface `OpenRouterKeyTelemetry` and state `const [keyTelemetry, setKeyTelemetry] = useState<OpenRouterKeyTelemetry | null>(null);`, the component can preserve the structured upstream telemetry across re-renders.
2. **Payload Normalization**:
   - In `handleVerifyKey`, when `res.ok && json?.data`, the data is normalized:
     - `label`: `json.data.label || null`
     - `usage`: `typeof json.data.usage === 'number' ? json.data.usage : 0`
     - `limit`: `typeof json.data.limit === 'number' ? json.data.limit : null`
     - `limit_remaining`: `typeof json.data.limit_remaining === 'number' ? json.data.limit_remaining : (json.data.limit !== null ? Math.max(0, json.data.limit - json.data.usage) : null)`
     - `is_free_tier`: `Boolean(json.data.is_free_tier)`
     - `rate_limit`: `{ requests: json.data.rate_limit?.requests ?? 20, interval: json.data.rate_limit?.interval ?? '10s' }`
3. **Metric Formatting Rules**:
   - **Key Label**: `keyTelemetry.label || 'Default / Primary Key'`
   - **Usage Spend**: `$${keyTelemetry.usage < 0.01 && keyTelemetry.usage > 0 ? keyTelemetry.usage.toFixed(4) : keyTelemetry.usage.toFixed(2)}` (safeguards micro-cent usage like `$0.0045` from rounding to `$0.00`).
   - **Remaining Limit**: `keyTelemetry.limit !== null ? '$' + (keyTelemetry.limit - keyTelemetry.usage).toFixed(2) + ' remaining' : 'Unlimited'`
   - **Free Tier / Paid Tier Badge**:
     - `is_free_tier === true`: Amber badge `Free Tier ($0 Balance · 50 req/day cap)`
     - `is_free_tier === false`: Emerald badge `Paid Tier (1,000+ req/day)`
   - **Rate Limit Interval**: `${keyTelemetry.rate_limit.requests} req / ${keyTelemetry.rate_limit.interval}`
4. **Bento Card UI Design**:
   - Designed a 4-card responsive Bento grid using Tailwind dark-theme design tokens (`bg-bg/80`, `border-border/90`, `text-text`, `accent-light`, `emerald-400`, `amber-400`, `font-mono`) animated with Framer Motion `motion.div` to render directly beneath the API key input row when `keyStatus === 'valid'` and `keyTelemetry` is present.
5. **State Lifecycle & Edge Case Hardening**:
   - When the user edits the input field (`handleOpenRouterKeyChange`), `keyTelemetry` is set to `null` to eliminate stale data.
   - When the user switches provider (e.g., to `'openai'` or `'offline'`), `keyTelemetry` is reset to `null`.
   - On verification failure (HTTP 401, 403, network error), `setKeyTelemetry(null)` ensures telemetry cards are cleared and verbatim error is displayed.

---

## 3. Caveats
- OpenRouter rate limits for free tier accounts are 50 reqs/day on $0 balance accounts, but can also encounter 20 reqs/min burst throttling. The telemetry endpoint displays current key configuration; live draft rate limits are handled in Milestone 2.
- The `limit_remaining` property may not always be explicitly returned in the JSON root; calculating `limit !== null ? Math.max(0, limit - usage) : null` guarantees resilience against schema variations.
- Initial mount hydration: If an existing key is loaded from localStorage on mount, `keyTelemetry` remains `null` until `handleVerifyKey` is triggered or auto-hydrated.

---

## 4. Conclusion & Concrete Implementation Recommendations

### Proposed TypeScript Interface & Pure Parser Function
```typescript
export interface OpenRouterKeyTelemetry {
  label: string | null;
  usage: number; // in USD
  limit: number | null; // in USD (null if unlimited)
  limit_remaining?: number | null; // in USD
  is_free_tier: boolean;
  rate_limit: {
    requests: number;
    interval: string; // e.g. "10s", "1m"
  };
}

export function parseOpenRouterKeyTelemetry(raw: any): OpenRouterKeyTelemetry {
  const data = raw?.data || raw || {};
  const usage = typeof data.usage === 'number' ? data.usage : Number(data.usage) || 0;
  const limit = typeof data.limit === 'number' ? data.limit : null;
  
  let limit_remaining: number | null = null;
  if (typeof data.limit_remaining === 'number') {
    limit_remaining = data.limit_remaining;
  } else if (limit !== null) {
    limit_remaining = Math.max(0, limit - usage);
  }

  return {
    label: data.label || null,
    usage,
    limit,
    limit_remaining,
    is_free_tier: Boolean(data.is_free_tier),
    rate_limit: {
      requests: typeof data.rate_limit?.requests === 'number' ? data.rate_limit.requests : 20,
      interval: typeof data.rate_limit?.interval === 'string' ? data.rate_limit.interval : '10s',
    },
  };
}
```

### Proposed State & Handler Updates in `AdminAIConfig.tsx`
```typescript
// Add React state:
const [keyTelemetry, setKeyTelemetry] = useState<OpenRouterKeyTelemetry | null>(null);

// Update handleOpenRouterKeyChange:
const handleOpenRouterKeyChange = (val: string) => {
  setOpenrouterKey(val);
  setKeyTelemetry(null); // Invalidate old key telemetry
  if (typeof window !== 'undefined') {
    localStorage.setItem('draftpilot_openrouter_key', val);
  }
  setKeyStatus('untested');
};

// Update handleVerifyKey:
const handleVerifyKey = async () => {
  setKeyVerifyMessage(null);
  if (provider === 'openrouter') {
    const trimmed = openrouterKey.trim();
    if (!trimmed || !trimmed.startsWith('sk-or-')) {
      setKeyStatus('invalid');
      setKeyTelemetry(null);
      setKeyVerifyMessage('Key must start with sk-or-v1-...');
      return;
    }
    setKeyStatus('testing');
    try {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${trimmed}` },
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.data) {
        const telemetry = parseOpenRouterKeyTelemetry(json.data);
        setKeyTelemetry(telemetry);
        setKeyStatus('valid');
        const label = telemetry.label ? ` (${telemetry.label})` : '';
        setKeyVerifyMessage(`Verified & Active${label}`);
        if (typeof window !== 'undefined') {
          localStorage.setItem('draftpilot_openrouter_key', trimmed);
        }
      } else {
        setKeyStatus('invalid');
        setKeyTelemetry(null);
        setKeyVerifyMessage(json?.error?.message || 'Invalid OpenRouter Key');
      }
    } catch (err: any) {
      setKeyStatus('invalid');
      setKeyTelemetry(null);
      setKeyVerifyMessage('Network error connecting to OpenRouter');
    }
  } else if (provider === 'openai') {
    setKeyTelemetry(null);
    // existing OpenAI verification logic...
  }
};
```

### Proposed Bento 4-Card JSX Telemetry Grid
Insert immediately below the API Key row inside Section 2:
```tsx
{provider === 'openrouter' && keyStatus === 'valid' && keyTelemetry && (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25 }}
    className="mt-5 pt-5 border-t border-border/60"
  >
    {/* Telemetry Header & Tier Indicator */}
    <div className="flex items-center justify-between mb-3.5">
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-xs font-bold text-text">Live OpenRouter Account Telemetry</span>
        <span className="text-[10px] text-text-dim font-mono">(/api/v1/auth/key)</span>
      </div>

      {keyTelemetry.is_free_tier ? (
        <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
          Free Tier ($0 Balance · 50 req/day cap)
        </span>
      ) : (
        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
          Paid Tier (1,000+ req/day)
        </span>
      )}
    </div>

    {/* 4-Card Bento Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Card 1: Key Label */}
      <div className="p-4 rounded-2xl bg-bg/80 border border-border/90 hover:border-accent/40 transition-all flex flex-col justify-between">
        <p className="text-[11px] text-text-dim font-medium">Key Label / Identifier</p>
        <div className="mt-2">
          <h4 className="text-sm font-bold text-text font-mono truncate" title={keyTelemetry.label || 'Default / Primary Key'}>
            {keyTelemetry.label || 'Default / Primary Key'}
          </h4>
          <p className="text-[10px] text-accent-light font-mono mt-0.5">
            {keyTelemetry.label ? 'Named API Key' : 'Standard Key'}
          </p>
        </div>
      </div>

      {/* Card 2: Cumulative Spend */}
      <div className="p-4 rounded-2xl bg-bg/80 border border-border/90 hover:border-accent/40 transition-all flex flex-col justify-between">
        <p className="text-[11px] text-text-dim font-medium">Cumulative Spend</p>
        <div className="mt-2">
          <h4 className="text-lg font-extrabold text-text font-mono tracking-tight">
            ${keyTelemetry.usage < 0.01 && keyTelemetry.usage > 0
              ? keyTelemetry.usage.toFixed(4)
              : keyTelemetry.usage.toFixed(2)}
          </h4>
          <p className="text-[10px] text-text-muted font-mono mt-0.5">
            Total usage to date
          </p>
        </div>
      </div>

      {/* Card 3: Credit Limit / Remaining */}
      <div className="p-4 rounded-2xl bg-bg/80 border border-border/90 hover:border-accent/40 transition-all flex flex-col justify-between">
        <p className="text-[11px] text-text-dim font-medium">Credit Limit / Remaining</p>
        <div className="mt-2">
          <h4 className="text-sm font-extrabold font-mono tracking-tight text-emerald-400">
            {keyTelemetry.limit !== null
              ? `$${Math.max(0, keyTelemetry.limit - keyTelemetry.usage).toFixed(2)} rem.`
              : 'Unlimited'}
          </h4>
          <p className="text-[10px] text-text-muted font-mono mt-0.5">
            {keyTelemetry.limit !== null
              ? `Limit: $${keyTelemetry.limit.toFixed(2)}`
              : 'No credit ceiling set'}
          </p>
        </div>
      </div>

      {/* Card 4: Rate Limit Bandwidth */}
      <div className="p-4 rounded-2xl bg-bg/80 border border-border/90 hover:border-accent/40 transition-all flex flex-col justify-between">
        <p className="text-[11px] text-text-dim font-medium">Rate Limit Bandwidth</p>
        <div className="mt-2">
          <h4 className="text-sm font-extrabold text-accent-light font-mono tracking-tight">
            {keyTelemetry.rate_limit.requests} req / {keyTelemetry.rate_limit.interval}
          </h4>
          <p className="text-[10px] text-text-muted font-mono mt-0.5">
            {keyTelemetry.is_free_tier ? '50 req/day daily cap' : 'Burst concurrency quota'}
          </p>
        </div>
      </div>
    </div>
  </motion.div>
)}
```

---

## 5. Verification Method
1. **Unit & Logic Verification**:
   - Inspect `packages/web/src/components/admin/AdminAIConfig.tsx` to verify:
     - `OpenRouterKeyTelemetry` interface is exported.
     - `parseOpenRouterKeyTelemetry` correctly handles edge cases (null limit, missing rate limit, fractional micro-cent usage).
     - State reset logic is present on key change and provider switch.
2. **Automated Test Suite**:
   - Run:
     ```bash
     export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
     export HOME="/home/md-roni-ahamed/Test project/.tmp_home"
     pnpm test
     ```
   - Invalidation condition: Any test failure or build breakage in `pnpm build:web`.
