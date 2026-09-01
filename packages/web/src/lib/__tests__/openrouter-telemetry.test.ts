import test from 'node:test';
import assert from 'node:assert/strict';

// Error Classifier Logic
function classifyOpenRouterError(status: number, rawErrMsg: string): {
  category: 'daily_cap' | 'rate_limit' | 'congestion' | 'credits_exhausted' | 'auth_error' | 'general';
  verbatimMessage: string;
  statusCode: number;
} {
  const lower = (rawErrMsg || '').toLowerCase();
  let category: 'daily_cap' | 'rate_limit' | 'congestion' | 'credits_exhausted' | 'auth_error' | 'general' = 'general';

  if (status === 401 || lower.includes('unauthorized') || lower.includes('invalid api key')) {
    category = 'auth_error';
  } else if (lower.includes('free model') || lower.includes('50 requests') || lower.includes('daily') || (status === 429 && lower.includes('credit'))) {
    category = 'daily_cap';
  } else if (status === 402 || lower.includes('insufficient') || lower.includes('balance') || lower.includes('out of credits')) {
    category = 'credits_exhausted';
  } else if (status === 429 || lower.includes('rate limit')) {
    category = 'rate_limit';
  } else if (status === 503 || status === 529 || lower.includes('queue') || lower.includes('busy') || lower.includes('overloaded') || lower.includes('temporarily unavailable')) {
    category = 'congestion';
  }

  return {
    category,
    verbatimMessage: rawErrMsg || `HTTP ${status}`,
    statusCode: status,
  };
}

// Telemetry Parsing Logic
interface OpenRouterTelemetry {
  label: string | null;
  usage: number;
  limit: number | null;
  is_free_tier: boolean;
  rate_limit?: {
    requests: number;
    interval: string;
  };
}

function parseOpenRouterKeyData(data: any): OpenRouterTelemetry {
  return {
    label: data?.label || null,
    usage: Number(data?.usage) || 0,
    limit: data?.limit !== undefined && data?.limit !== null ? Number(data.limit) : null,
    is_free_tier: Boolean(data?.is_free_tier),
    rate_limit: data?.rate_limit,
  };
}

test('OpenRouter Diagnostics: Classify Free-Tier Daily Cap Error', () => {
  const err = classifyOpenRouterError(429, 'Free model rate limit reached. Your account has a $0 balance and is limited to 50 requests per day across all free models.');
  assert.equal(err.category, 'daily_cap');
  assert.equal(err.statusCode, 429);
  assert.match(err.verbatimMessage, /50 requests per day/);
});

test('OpenRouter Diagnostics: Classify Concurrency Burst Limit', () => {
  const err = classifyOpenRouterError(429, 'Rate limit exceeded: 20 requests per minute');
  assert.equal(err.category, 'rate_limit');
  assert.equal(err.statusCode, 429);
});

test('OpenRouter Diagnostics: Classify Model Queue Congestion (503/529)', () => {
  const err503 = classifyOpenRouterError(503, 'Model queue is currently overloaded. Please try again later.');
  assert.equal(err503.category, 'congestion');
  assert.equal(err503.statusCode, 503);

  const err529 = classifyOpenRouterError(529, 'Provider busy');
  assert.equal(err529.category, 'congestion');
});

test('OpenRouter Diagnostics: Classify Insufficient Credits (402)', () => {
  const err = classifyOpenRouterError(402, 'Insufficient balance to complete request with selected model');
  assert.equal(err.category, 'credits_exhausted');
  assert.equal(err.statusCode, 402);
});

test('OpenRouter Diagnostics: Classify Unauthorized Key (401)', () => {
  const err = classifyOpenRouterError(401, 'Invalid API Key provided');
  assert.equal(err.category, 'auth_error');
  assert.equal(err.statusCode, 401);
});

test('OpenRouter Telemetry: Parse Free-Tier Key with Quota Details', () => {
  const rawPayload = {
    data: {
      label: 'Production Key',
      usage: 0.0452,
      limit: null,
      is_free_tier: true,
      rate_limit: {
        requests: 50,
        interval: '10s',
      },
    },
  };

  const parsed = parseOpenRouterKeyData(rawPayload.data);
  assert.equal(parsed.label, 'Production Key');
  assert.equal(parsed.usage, 0.0452);
  assert.equal(parsed.limit, null);
  assert.equal(parsed.is_free_tier, true);
  assert.equal(parsed.rate_limit?.requests, 50);
  assert.equal(parsed.rate_limit?.interval, '10s');
});

test('OpenRouter Telemetry: Parse Paid Tier Key with Custom Credit Limit', () => {
  const rawPayload = {
    data: {
      label: 'Team Key',
      usage: 12.35,
      limit: 50.00,
      is_free_tier: false,
      rate_limit: {
        requests: 1000,
        interval: '1d',
      },
    },
  };

  const parsed = parseOpenRouterKeyData(rawPayload.data);
  assert.equal(parsed.label, 'Team Key');
  assert.equal(parsed.usage, 12.35);
  assert.equal(parsed.limit, 50.00);
  assert.equal(parsed.is_free_tier, false);
  assert.equal(parsed.rate_limit?.requests, 1000);
});
