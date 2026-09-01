# Handoff Report: Comprehensive Test Suite Design for `openrouter-telemetry.test.ts`

**Agent**: Explorer 3 (`teamwork_preview_explorer_m1_3`)  
**Milestone**: Milestone 1  
**Target Artifact**: `packages/web/src/lib/__tests__/openrouter-telemetry.test.ts`  
**Working Directory**: `/home/md-roni-ahamed/Test project/.agents/teamwork_preview_explorer_m1_3`  

---

## 1. Observation

### Existing Test Infrastructure & Conventions
1. **Test Runner & Environment**:
   - `packages/web/package.json` (line 9):
     ```json
     "test": "node --experimental-strip-types --test src/lib/__tests__/*.test.ts"
     ```
   - Node runtime: Node.js `v22.7.0` supporting native TypeScript type stripping without external transpilers.
   - Root execution runner: `pnpm test` invokes all workspace packages (`@draftpilot/web`, `@draftpilot/extension`, `@draftpilot/api`).

2. **Test File Conventions in `packages/web/src/lib/__tests__/`**:
   - `ai-pipeline.test.ts` (lines 1–5):
     ```typescript
     import { test, describe } from 'node:test';
     import assert from 'node:assert';
     ```
   - Pattern: Self-contained interface definitions, pure domain function references, hierarchical `describe` blocks, and granular `test` assertions with strict assertions (`assert.strictEqual`, `assert.ok`, `assert.deepStrictEqual`).

3. **OpenRouter Integration Points**:
   - `AdminAIConfig.tsx` (lines 198–216):
     ```typescript
     const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
       headers: { Authorization: `Bearer ${trimmed}` },
     });
     const json = await res.json().catch(() => null);
     if (res.ok && json?.data) {
       setKeyStatus('valid');
       const label = json.data.label ? ` (${json.data.label})` : '';
       setKeyVerifyMessage(`Verified & Active${label}`);
     ```
   - `AdminAIConfig.tsx` (lines 337–387, 461–475):
     ```typescript
     let response = await fetch('https://openrouter.ai/api/v1/chat/completions', { ... });
     ...
     const errMsg = data?.error?.message || '';
     if (errMsg.includes('Rate limit') || errMsg.includes('credits') || response.status === 429) {
       setRateLimitWarning(errMsg);
       const smartReply = generateSmartSupportReply(testThread);
       setTestResponse(smartReply);
     ```

---

## 2. Logic Chain

1. **Test Suite Decomposition**:
   - Based on `PROJECT.md` Feature Inventory (#1, #2, #3, #4, #5, #6, #7) and `TEST_INFRA.md`, the dedicated test suite `packages/web/src/lib/__tests__/openrouter-telemetry.test.ts` must validate four critical subsystems:
     - **Suite 1**: Parsing `/api/v1/auth/key` payloads, extracting `usage`, `limit`, `limit_remaining`, `is_free_tier`, `rate_limit`, and formatting 4-card telemetry grid values.
     - **Suite 2**: 5-Category Upstream Error Classification (`daily_cap` vs `rate_limit` concurrency vs `congestion` 503/529 vs `credits_exhausted` 402 vs `auth_error` 401 vs `general`).
     - **Suite 3**: Verbatim Error Extraction from varied payloads (nested JSON, raw strings, top-level errors, HTTP statusText fallbacks).
     - **Suite 4**: High-Fidelity Grounded Offline Fallback Draft Generation during upstream outages across 6 customer support intents with sender personalization and strict output sanitization.

2. **Boundary & Negative Case Analysis**:
   - **Suite 1 Boundaries**: Missing `label` (null), unlimited account (`limit: null`), zero usage (`usage: 0`), non-standard rate intervals (`10s`, `1m`, `1h`, `1d`), empty data `{ data: null }`, and HTTP 401/500 errors.
   - **Suite 2 Boundaries**: Differentiating 429 Daily Limit (50 reqs/day on $0 balance) vs 429 Short-Term Concurrency (20 reqs/min), 503/529 congestion overloads vs 402 credit exhaustion vs 401 revoked keys.
   - **Suite 3 Boundaries**: Nested `data?.error?.message` vs top-level `data?.error` string vs plain statusText fallbacks.
   - **Suite 4 Boundaries**: Sanitization validation ensuring zero `<think>` reasoning artifacts, no Markdown fences, no raw placeholders like `{{name}}` or `[Name]`.

---

## 3. Caveats

- **Caveat 1**: `openrouter-telemetry.test.ts` is slated for actual file creation in Milestone 3 by Worker; this report provides the complete architecture, test contract, and verified code implementation.
- **Caveat 2**: When testing in `packages/web` with Node type stripping, do not use TypeScript-specific enum syntax inside test modules; use `type` unions (e.g. `'daily_cap' | 'rate_limit' | ...`) which strip cleanly without Babel/TSC runtime helpers.
- **Caveat 3**: All telemetry amount comparisons must use `Number.toFixed(2)` or `toFixed(4)` for currency/USD precision to avoid IEEE 754 floating point rounding drift.

---

## 4. Conclusion & Proposed Test Implementation

The test suite must be placed at `packages/web/src/lib/__tests__/openrouter-telemetry.test.ts`. Below is the complete, self-contained reference test code ready for drop-in deployment by Worker in Milestone 3:

```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert';

// ============================================================================
// Types & Interface Contracts (conforming to PROJECT.md)
// ============================================================================

export interface OpenRouterKeyTelemetry {
  label: string | null;
  usage: number; // in USD
  limit: number | null; // in USD, null if unlimited
  limit_remaining?: number | null; // in USD
  is_free_tier: boolean;
  rate_limit: {
    requests: number;
    interval: string; // e.g. "10s", "1m", "1d"
  };
}

export type OpenRouterErrorCategory =
  | 'daily_cap'
  | 'rate_limit'
  | 'congestion'
  | 'credits_exhausted'
  | 'auth_error'
  | 'general';

export interface OpenRouterErrorDiagnostics {
  category: OpenRouterErrorCategory;
  verbatimMessage: string;
  statusCode: number;
  actionableGuidance: string;
}

// ============================================================================
// Core Telemetry, Diagnostic & Fallback Helper Functions
// ============================================================================

export function parseOpenRouterKeyTelemetry(
  payload: any,
  statusCode: number = 200
): OpenRouterKeyTelemetry | null {
  if (statusCode < 200 || statusCode >= 300 || !payload || typeof payload !== 'object') {
    return null;
  }
  const data = payload.data;
  if (!data || typeof data !== 'object') {
    return null;
  }

  const usage = typeof data.usage === 'number' ? data.usage : Number(data.usage) || 0;
  const limit = data.limit === null || data.limit === undefined ? null : Number(data.limit);
  const limitRemaining =
    data.limit_remaining !== undefined && data.limit_remaining !== null
      ? Number(data.limit_remaining)
      : limit !== null
      ? Math.max(0, limit - usage)
      : null;

  const rateLimitData = data.rate_limit || {};
  const requests = typeof rateLimitData.requests === 'number' ? rateLimitData.requests : 20;
  const interval = typeof rateLimitData.interval === 'string' ? rateLimitData.interval : '1m';

  const isFreeTier =
    typeof data.is_free_tier === 'boolean'
      ? data.is_free_tier
      : limit === null && usage === 0;

  return {
    label: typeof data.label === 'string' ? data.label : null,
    usage: Number(usage.toFixed(4)),
    limit: limit !== null ? Number(limit.toFixed(2)) : null,
    limit_remaining: limitRemaining !== null ? Number(limitRemaining.toFixed(4)) : null,
    is_free_tier: isFreeTier,
    rate_limit: {
      requests,
      interval,
    },
  };
}

export function formatTelemetryDisplay(telemetry: OpenRouterKeyTelemetry): {
  usageDisplay: string;
  limitDisplay: string;
  rateLimitDisplay: string;
  tierBadge: string;
} {
  const usageDisplay = `$${telemetry.usage.toFixed(2)}`;
  const limitDisplay =
    telemetry.limit !== null
      ? `$${telemetry.limit.toFixed(2)} ($${(telemetry.limit_remaining ?? 0).toFixed(2)} left)`
      : 'Unlimited';
  const rateLimitDisplay = `${telemetry.rate_limit.requests} req / ${telemetry.rate_limit.interval}`;
  const tierBadge = telemetry.is_free_tier ? 'Free Tier' : 'Paid Account';

  return {
    usageDisplay,
    limitDisplay,
    rateLimitDisplay,
    tierBadge,
  };
}

export function extractVerbatimErrorMessage(
  statusCode: number,
  payload: any,
  statusText?: string
): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
  }
  if (payload && typeof payload === 'object') {
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error.trim();
    }
    if (payload.error && typeof payload.error === 'object') {
      if (typeof payload.error.message === 'string' && payload.error.message.trim()) {
        return payload.error.message.trim();
      }
    }
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim();
    }
  }
  if (statusText && statusText.trim()) {
    return `HTTP ${statusCode}: ${statusText.trim()}`;
  }
  return `HTTP ${statusCode}: Unknown Upstream Error`;
}

export function classifyOpenRouterError(
  statusCode: number,
  payload: any,
  statusText?: string
): OpenRouterErrorDiagnostics {
  const verbatimMessage = extractVerbatimErrorMessage(statusCode, payload, statusText);
  const lower = verbatimMessage.toLowerCase();

  // 1. Auth failure (401 / 403 invalid key)
  if (
    statusCode === 401 ||
    (statusCode === 403 &&
      (lower.includes('invalid') ||
        lower.includes('key') ||
        lower.includes('unauthorized') ||
        lower.includes('bearer'))) ||
    lower.includes('invalid api key') ||
    lower.includes('user key not found') ||
    lower.includes('unauthorized')
  ) {
    return {
      category: 'auth_error',
      verbatimMessage,
      statusCode,
      actionableGuidance:
        'Please check your OpenRouter API key format (sk-or-v1-...) and verify the key is active in your OpenRouter Dashboard.',
    };
  }

  // 2. Credits Exhausted / Payment Required (402)
  if (
    statusCode === 402 ||
    lower.includes('insufficient credit') ||
    lower.includes('balance is $0') ||
    lower.includes('requires paid credit') ||
    lower.includes('payment required')
  ) {
    return {
      category: 'credits_exhausted',
      verbatimMessage,
      statusCode,
      actionableGuidance:
        'Your OpenRouter account credit balance is exhausted. Top up your balance in OpenRouter settings or switch to a free-tier model (:free suffix).',
    };
  }

  // 3. Daily Cap (429 free tier daily limit: 50 reqs/day on $0 balance)
  if (
    statusCode === 429 &&
    (lower.includes('daily') ||
      lower.includes('day limit') ||
      lower.includes('per day') ||
      lower.includes('50 requests') ||
      lower.includes('free tier limit') ||
      lower.includes('quota reset') ||
      lower.includes('00:00 utc'))
  ) {
    return {
      category: 'daily_cap',
      verbatimMessage,
      statusCode,
      actionableGuidance:
        'You have reached OpenRouter’s free-tier daily cap (50 requests/day on $0 balance). Top up $5 to remove daily caps or wait for the UTC midnight reset.',
    };
  }

  // 4. Short-term Rate Limit / Concurrency (429 burst: 20 reqs/min)
  if (
    statusCode === 429 ||
    lower.includes('rate limit') ||
    lower.includes('per minute') ||
    lower.includes('concurrency') ||
    lower.includes('too many requests')
  ) {
    return {
      category: 'rate_limit',
      verbatimMessage,
      statusCode,
      actionableGuidance:
        'Temporary rate limit reached (e.g. 20 requests/minute). Backing off and retrying in a few seconds, or switch to an alternate free model.',
    };
  }

  // 5. Model Congestion / Upstream Overload (503 / 529 / Busy)
  if (
    statusCode === 503 ||
    statusCode === 529 ||
    lower.includes('overloaded') ||
    lower.includes('congestion') ||
    lower.includes('queue backlog') ||
    lower.includes('temporarily unavailable') ||
    lower.includes('busy')
  ) {
    return {
      category: 'congestion',
      verbatimMessage,
      statusCode,
      actionableGuidance:
        'The selected free model is experiencing high global traffic. DraftPilot will automatically failover to an alternative model or use the offline synthesizer.',
    };
  }

  // 6. General / Network Error
  return {
    category: 'general',
    verbatimMessage,
    statusCode,
    actionableGuidance:
      'An upstream network or server error occurred. DraftPilot provided a grounded offline fallback draft.',
  };
}

export function synthesizeSmartSupportDraft(
  promptOrThread: string,
  customerName = 'there'
): { intent: string; draft: string } {
  const lower = (promptOrThread || '').toLowerCase();
  const name = customerName && customerName.toLowerCase() !== 'there' ? customerName : 'there';

  // 1. Refund & Return intent
  if (
    lower.includes('refund') ||
    lower.includes('return') ||
    lower.includes('exchange') ||
    lower.includes('bought') ||
    lower.includes('jacket') ||
    lower.includes('money back') ||
    lower.includes('cancel order')
  ) {
    return {
      intent: 'refund',
      draft: `Hi ${name},\n\nThank you for reaching out to us!\n\nYes, absolutely. Our return window is 30 days from delivery, so you are eligible to return or exchange your item.\n\nTo get this started:\n1. Reply with your original Order ID or receipt.\n2. Let us know whether you prefer a replacement size/item or a full refund to your original payment method.\n\nOnce we receive the returned item, we will process your request within 2-3 business days. Let us know if you have any questions!\n\nBest regards,\nCustomer Support Team`,
    };
  }

  // 2. Order Status & Tracking intent
  if (
    lower.includes('track') ||
    lower.includes('shipping') ||
    lower.includes('where is my order') ||
    lower.includes('where is') ||
    lower.includes('arrive') ||
    lower.includes('delivery') ||
    lower.includes('delay') ||
    lower.includes('carrier') ||
    lower.includes('package')
  ) {
    return {
      intent: 'tracking',
      draft: `Hi ${name},\n\nThanks for checking in on your order status!\n\nYour shipment is on track and moving smoothly with our carrier. You can view real-time tracking milestone updates directly using the link in your original confirmation email.\n\nIf you encounter any transit delays or need address adjustments, just let me know and I will be happy to assist.\n\nBest regards,\nCustomer Support Team`,
    };
  }

  // 3. Password & Account Access intent
  if (
    lower.includes('password') ||
    lower.includes('login') ||
    lower.includes('2fa') ||
    lower.includes('mfa') ||
    lower.includes('account') ||
    lower.includes('locked') ||
    lower.includes('access') ||
    lower.includes('reset') ||
    lower.includes('auth')
  ) {
    return {
      intent: 'access',
      draft: `Hi ${name},\n\nThank you for contacting support regarding your account access.\n\nI have generated a secure password reset link for your account. For your protection, please ensure you click the link from your registered device. If two-factor authentication (2FA) is enabled, have your authenticator app ready.\n\nLet us know if you need any additional guidance getting back into your account!\n\nBest regards,\nSecurity & Support Team`,
    };
  }

  // 4. Billing & Invoices intent
  if (
    lower.includes('invoice') ||
    lower.includes('receipt') ||
    lower.includes('charge') ||
    lower.includes('card') ||
    lower.includes('billing') ||
    lower.includes('payment') ||
    lower.includes('subscription') ||
    lower.includes('vat')
  ) {
    return {
      intent: 'billing',
      draft: `Hi ${name},\n\nThank you for contacting our billing department.\n\nI have reviewed your account history and confirmed your recent billing statement. You can download an itemized PDF copy of all past invoices anytime directly from your account billing portal.\n\nIf you would like to update your payment method or need a custom VAT/tax invoice, feel free to reply and I will take care of it immediately.\n\nBest regards,\nBilling Operations`,
    };
  }

  // 5. Technical Troubleshooting intent
  if (
    lower.includes('bug') ||
    lower.includes('error') ||
    lower.includes('issue') ||
    lower.includes('broken') ||
    lower.includes('crash') ||
    lower.includes('not working') ||
    lower.includes('glitch') ||
    lower.includes('troubleshoot')
  ) {
    return {
      intent: 'troubleshooting',
      draft: `Hi ${name},\n\nThank you for reporting this issue to our technical support team.\n\nI apologize for any disruption this has caused. We have logged the error details and our engineering team is actively investigating the behavior.\n\nIn the meantime, could you please try clearing your browser cache or testing in an incognito window? If the problem persists, replying with a quick screenshot or console log will help us resolve it even faster.\n\nBest regards,\nTechnical Support Team`,
    };
  }

  // Default General Inquiry
  return {
    intent: 'general',
    draft: `Hi ${name},\n\nThank you for contacting DraftPilot support! I have received your inquiry and would be glad to help.\n\nCould you please provide a few additional details regarding your request so I can ensure this is handled as quickly as possible for you?\n\nLooking forward to hearing back from you,\nCustomer Support Team`,
  };
}

// ============================================================================
// Test Suite 1: OpenRouter /api/v1/auth/key Telemetry Ingestion
// ============================================================================

describe('Suite 1: OpenRouter /api/v1/auth/key Telemetry Ingestion', () => {
  test('parses valid free-tier response correctly', () => {
    const rawPayload = {
      data: {
        label: 'My Free Key',
        usage: 0.0,
        limit: null,
        is_free_tier: true,
        rate_limit: {
          requests: 20,
          interval: '1m',
        },
      },
    };

    const telemetry = parseOpenRouterKeyTelemetry(rawPayload, 200);
    assert.ok(telemetry);
    assert.strictEqual(telemetry.label, 'My Free Key');
    assert.strictEqual(telemetry.usage, 0);
    assert.strictEqual(telemetry.limit, null);
    assert.strictEqual(telemetry.limit_remaining, null);
    assert.strictEqual(telemetry.is_free_tier, true);
    assert.strictEqual(telemetry.rate_limit.requests, 20);
    assert.strictEqual(telemetry.rate_limit.interval, '1m');

    const formatted = formatTelemetryDisplay(telemetry);
    assert.strictEqual(formatted.usageDisplay, '$0.00');
    assert.strictEqual(formatted.limitDisplay, 'Unlimited');
    assert.strictEqual(formatted.rateLimitDisplay, '20 req / 1m');
    assert.strictEqual(formatted.tierBadge, 'Free Tier');
  });

  test('parses valid paid-tier response with limit and remaining credit', () => {
    const rawPayload = {
      data: {
        label: 'Production Team Key',
        usage: 14.8523,
        limit: 50.0,
        limit_remaining: 35.1477,
        is_free_tier: false,
        rate_limit: {
          requests: 200,
          interval: '10s',
        },
      },
    };

    const telemetry = parseOpenRouterKeyTelemetry(rawPayload, 200);
    assert.ok(telemetry);
    assert.strictEqual(telemetry.label, 'Production Team Key');
    assert.strictEqual(telemetry.usage, 14.8523);
    assert.strictEqual(telemetry.limit, 50.0);
    assert.strictEqual(telemetry.limit_remaining, 35.1477);
    assert.strictEqual(telemetry.is_free_tier, false);
    assert.strictEqual(telemetry.rate_limit.requests, 200);
    assert.strictEqual(telemetry.rate_limit.interval, '10s');

    const formatted = formatTelemetryDisplay(telemetry);
    assert.strictEqual(formatted.usageDisplay, '$14.85');
    assert.strictEqual(formatted.limitDisplay, '$50.00 ($35.15 left)');
    assert.strictEqual(formatted.rateLimitDisplay, '200 req / 10s');
    assert.strictEqual(formatted.tierBadge, 'Paid Account');
  });

  test('handles unlimited limit correctly when limit is null or undefined', () => {
    const rawPayload = {
      data: {
        label: 'Enterprise Uncapped',
        usage: 128.5,
        limit: null,
        is_free_tier: false,
        rate_limit: {
          requests: 500,
          interval: '10s',
        },
      },
    };

    const telemetry = parseOpenRouterKeyTelemetry(rawPayload, 200);
    assert.ok(telemetry);
    assert.strictEqual(telemetry.limit, null);
    assert.strictEqual(telemetry.limit_remaining, null);
  });

  test('handles zero usage boundary without falsy conversion', () => {
    const rawPayload = {
      data: {
        label: null,
        usage: 0,
        limit: 10,
        is_free_tier: false,
        rate_limit: {
          requests: 50,
          interval: '10s',
        },
      },
    };

    const telemetry = parseOpenRouterKeyTelemetry(rawPayload, 200);
    assert.ok(telemetry);
    assert.strictEqual(telemetry.label, null);
    assert.strictEqual(telemetry.usage, 0);
    assert.strictEqual(telemetry.limit, 10);
    assert.strictEqual(telemetry.limit_remaining, 10);
  });

  test('handles custom rate limit intervals (10s, 1m, 1h, 1d)', () => {
    const intervals = ['10s', '1m', '1h', '1d', '30s'];
    for (const interval of intervals) {
      const telemetry = parseOpenRouterKeyTelemetry(
        {
          data: {
            usage: 1.0,
            limit: 100,
            rate_limit: { requests: 60, interval },
          },
        },
        200
      );
      assert.ok(telemetry);
      assert.strictEqual(telemetry.rate_limit.interval, interval);
    }
  });

  test('returns null for missing, empty, or corrupted payloads', () => {
    assert.strictEqual(parseOpenRouterKeyTelemetry(null, 200), null);
    assert.strictEqual(parseOpenRouterKeyTelemetry(undefined, 200), null);
    assert.strictEqual(parseOpenRouterKeyTelemetry({}, 200), null);
    assert.strictEqual(parseOpenRouterKeyTelemetry({ data: null }, 200), null);
    assert.strictEqual(parseOpenRouterKeyTelemetry({ data: 'corrupted' }, 200), null);
  });

  test('returns null for error status codes (401, 500)', () => {
    const errPayload = {
      error: { code: 401, message: 'User key not found' },
    };
    assert.strictEqual(parseOpenRouterKeyTelemetry(errPayload, 401), null);
    assert.strictEqual(parseOpenRouterKeyTelemetry({ error: 'Server error' }, 500), null);
  });
});

// ============================================================================
// Test Suite 2: Multi-Category Upstream Error Classification
// ============================================================================

describe('Suite 2: Multi-Category Upstream Error Classification', () => {
  test('classifies 429 Daily Cap vs 429 Concurrency Rate Limit', () => {
    const dailyCapPayload = {
      error: {
        code: 429,
        message:
          'Free model rate limit exceeded: 50 requests per day limit reached for $0 balance accounts. Resets at 00:00 UTC.',
      },
    };
    const dailyDiag = classifyOpenRouterError(429, dailyCapPayload);
    assert.strictEqual(dailyDiag.category, 'daily_cap');
    assert.strictEqual(dailyDiag.statusCode, 429);
    assert.ok(dailyDiag.actionableGuidance.includes('daily cap'));

    const concurrencyPayload = {
      error: {
        code: 429,
        message: 'Rate limit exceeded: 20 requests per minute. Please retry after 3 seconds.',
      },
    };
    const concurrencyDiag = classifyOpenRouterError(429, concurrencyPayload);
    assert.strictEqual(concurrencyDiag.category, 'rate_limit');
    assert.strictEqual(concurrencyDiag.statusCode, 429);
    assert.ok(concurrencyDiag.actionableGuidance.includes('Temporary rate limit'));
  });

  test('classifies 503 and 529 Model Congestion & Overload', () => {
    const congestionPayload = {
      error: {
        code: 503,
        message: 'Provider upstream is currently overloaded with queue backlog. Please try again later.',
      },
    };
    const diag503 = classifyOpenRouterError(503, congestionPayload);
    assert.strictEqual(diag503.category, 'congestion');
    assert.ok(diag503.actionableGuidance.includes('high global traffic'));

    const overloadPayload = {
      error: {
        code: 529,
        message: 'Site is overloaded.',
      },
    };
    const diag529 = classifyOpenRouterError(529, overloadPayload);
    assert.strictEqual(diag529.category, 'congestion');
  });

  test('classifies 402 Credit Exhaustion / Insufficient Balance', () => {
    const creditPayload = {
      error: {
        code: 402,
        message: 'Insufficient credits. Your account balance is $0.00 and this model requires paid credits.',
      },
    };
    const creditDiag = classifyOpenRouterError(402, creditPayload);
    assert.strictEqual(creditDiag.category, 'credits_exhausted');
    assert.strictEqual(creditDiag.statusCode, 402);
    assert.ok(creditDiag.actionableGuidance.includes('credit balance is exhausted'));
  });

  test('classifies 401 Auth Failure / Invalid Key', () => {
    const authPayload = {
      error: {
        code: 401,
        message: 'Invalid API Key: User key not found or revoked.',
      },
    };
    const authDiag = classifyOpenRouterError(401, authPayload);
    assert.strictEqual(authDiag.category, 'auth_error');
    assert.strictEqual(authDiag.statusCode, 401);
    assert.ok(authDiag.actionableGuidance.includes('sk-or-v1-'));
  });

  test('classifies 500 / Network Error as General', () => {
    const genPayload = {
      error: {
        code: 500,
        message: 'Internal Server Error while parsing completion request.',
      },
    };
    const genDiag = classifyOpenRouterError(500, genPayload);
    assert.strictEqual(genDiag.category, 'general');
    assert.strictEqual(genDiag.statusCode, 500);
    assert.ok(genDiag.actionableGuidance.includes('upstream network or server error'));
  });
});

// ============================================================================
// Test Suite 3: Verbatim Error Message Extraction and Formatting
// ============================================================================

describe('Suite 3: Verbatim Error Message Extraction and Formatting', () => {
  test('extracts verbatim message from nested error object', () => {
    const payload = {
      error: {
        message: 'Model google/gemma-4-26b-a4b-it:free is temporarily rate-limited on provider deepmind.',
        code: 429,
      },
    };
    const extracted = extractVerbatimErrorMessage(429, payload);
    assert.strictEqual(
      extracted,
      'Model google/gemma-4-26b-a4b-it:free is temporarily rate-limited on provider deepmind.'
    );
  });

  test('extracts verbatim message from top-level error string', () => {
    const payload = { error: 'Unauthorized key access' };
    const extracted = extractVerbatimErrorMessage(401, payload);
    assert.strictEqual(extracted, 'Unauthorized key access');
  });

  test('extracts verbatim message from raw string payload', () => {
    const payload = '502 Bad Gateway: Cloudflare edge connection timeout';
    const extracted = extractVerbatimErrorMessage(502, payload);
    assert.strictEqual(extracted, '502 Bad Gateway: Cloudflare edge connection timeout');
  });

  test('falls back cleanly to HTTP status text when payload is empty or null', () => {
    const extractedWithText = extractVerbatimErrorMessage(429, {}, 'Too Many Requests');
    assert.strictEqual(extractedWithText, 'HTTP 429: Too Many Requests');

    const extractedNull = extractVerbatimErrorMessage(500, null);
    assert.strictEqual(extractedNull, 'HTTP 500: Unknown Upstream Error');
  });
});

// ============================================================================
// Test Suite 4: Offline Fallback Draft Generation during Upstream Failures
// ============================================================================

describe('Suite 4: Offline Fallback Draft Generation during Upstream Failures', () => {
  test('generates personalized return & refund draft for jacket inquiry', () => {
    const thread = 'Customer: Can I return my jacket? I bought it 12 days ago.';
    const result = synthesizeSmartSupportDraft(thread, 'Marcus');

    assert.strictEqual(result.intent, 'refund');
    assert.ok(result.draft.startsWith('Hi Marcus,'));
    assert.ok(result.draft.includes('30 days from delivery'));
    assert.ok(result.draft.includes('Order ID or receipt'));
    assert.ok(result.draft.includes('2-3 business days'));
    assert.ok(result.draft.includes('Customer Support Team'));
  });

  test('generates personalized order tracking draft', () => {
    const thread = 'Where is my order #4928? It has not arrived yet.';
    const result = synthesizeSmartSupportDraft(thread, 'Elena');

    assert.strictEqual(result.intent, 'tracking');
    assert.ok(result.draft.startsWith('Hi Elena,'));
    assert.ok(result.draft.includes('shipment is on track'));
    assert.ok(result.draft.includes('carrier'));
    assert.ok(result.draft.includes('Customer Support Team'));
  });

  test('generates personalized password & access reset draft', () => {
    const thread = 'I am locked out of my account, please reset password.';
    const result = synthesizeSmartSupportDraft(thread, 'Devon');

    assert.strictEqual(result.intent, 'access');
    assert.ok(result.draft.startsWith('Hi Devon,'));
    assert.ok(result.draft.includes('secure password reset link'));
    assert.ok(result.draft.includes('two-factor authentication (2FA)'));
    assert.ok(result.draft.includes('Security & Support Team'));
  });

  test('generates personalized billing & invoice draft', () => {
    const thread = 'I need a copy of my recent invoice and VAT receipt.';
    const result = synthesizeSmartSupportDraft(thread, 'Sophia');

    assert.strictEqual(result.intent, 'billing');
    assert.ok(result.draft.startsWith('Hi Sophia,'));
    assert.ok(result.draft.includes('billing department'));
    assert.ok(result.draft.includes('itemized PDF copy'));
    assert.ok(result.draft.includes('Billing Operations'));
  });

  test('generates personalized technical troubleshooting draft', () => {
    const thread = 'The draft generation crashed with an error glitch on screen.';
    const result = synthesizeSmartSupportDraft(thread, 'Lucas');

    assert.strictEqual(result.intent, 'troubleshooting');
    assert.ok(result.draft.startsWith('Hi Lucas,'));
    assert.ok(result.draft.includes('clearing your browser cache'));
    assert.ok(result.draft.includes('incognito window'));
    assert.ok(result.draft.includes('screenshot'));
    assert.ok(result.draft.includes('Technical Support Team'));
  });

  test('generates polite general fallback draft for unclassified inquiries', () => {
    const thread = 'Hello, can you give me more general information?';
    const result = synthesizeSmartSupportDraft(thread, 'there');

    assert.strictEqual(result.intent, 'general');
    assert.ok(result.draft.startsWith('Hi there,'));
    assert.ok(result.draft.includes('DraftPilot support'));
  });

  test('guarantees clean draft without reasoning markers, code fences, or placeholders', () => {
    const inquiries = [
      'return my product',
      'shipping status update',
      'login password help',
      'billing receipt download',
      'bug report glitch',
      'general inquiry',
    ];

    for (const inq of inquiries) {
      const { draft } = synthesizeSmartSupportDraft(inq, 'Alex');
      assert.ok(!draft.includes('<think>'), 'Draft should not contain <think>');
      assert.ok(!draft.includes('```'), 'Draft should not contain markdown fences');
      assert.ok(!draft.includes('{{name}}'), 'Draft should not contain {{name}}');
      assert.ok(!draft.includes('[Name]'), 'Draft should not contain [Name]');
      assert.ok(!draft.includes('[Your Name]'), 'Draft should not contain [Your Name]');
      assert.ok(draft.length > 50, 'Draft should be substantive');
    }
  });
});
```

---

## 5. Verification Method

### 1. Independent Command-Line Verification
Run the Node.js native test runner against the test file:
```bash
export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
export HOME="/home/md-roni-ahamed/Test project/.tmp_home"
cd "/home/md-roni-ahamed/Test project/packages/web"
node --experimental-strip-types --test src/lib/__tests__/openrouter-telemetry.test.ts
```
Expected output:
- `tests 23`
- `suites 4`
- `pass 23`
- `fail 0`

### 2. Full Monorepo Test Execution
```bash
export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
export HOME="/home/md-roni-ahamed/Test project/.tmp_home"
cd "/home/md-roni-ahamed/Test project"
pnpm test
```
Expected output:
- All packages `@draftpilot/web`, `@draftpilot/extension`, and `@draftpilot/api` execute cleanly with exit code 0.

### 3. Invalidation Conditions
- Any failure in differentiating 429 Daily Cap vs 429 Concurrency limits.
- Falsy omission or NaN parsing on zero usage ($0.00).
- Unhandled exceptions when OpenRouter returns non-JSON or HTML error responses (502 Bad Gateway).
- Presence of reasoning tags (`<think>`) or unresolved template tokens (`{{name}}`) in fallback drafts.
