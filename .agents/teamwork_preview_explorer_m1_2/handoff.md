# Handoff Report: Verbatim Upstream Error Diagnostics, Multi-Category Classification & Playground Advisory Banner

## 1. Observation

Direct examination of `packages/web/src/components/admin/AdminAIConfig.tsx` and related AI testing services revealed the following exact current implementation points:

1. **Error Evaluation & Fallback Trigger in `handleTestDraft` (lines 460–474)**:
   ```typescript
   } else {
     const errMsg = data?.error?.message || '';
     if (errMsg.includes('Rate limit') || errMsg.includes('credits') || response.status === 429) {
       setRateLimitWarning(errMsg);
       const smartReply = generateSmartSupportReply(testThread);
       setTestResponse(smartReply);
       setTestMetrics({
         tokens: 135,
         latency: latency,
       });
     } else {
       setRateLimitWarning(null);
       setTestResponse(errMsg || JSON.stringify(data, null, 2));
     }
   }
   ```
2. **Existing Advisory Banner Rendering (lines 746–759)**:
   ```tsx
   {rateLimitWarning && (
     <div className="mt-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[11px] space-y-2">
       <div className="flex items-center justify-between text-amber-400 font-bold text-[10px]">
         <span>⚠️ OpenRouter Free-Tier Daily Limit Reached</span>
         <span className="font-mono">50 reqs/day on $0 balance</span>
       </div>
       <p className="text-text-muted leading-relaxed">
         OpenRouter limits accounts with <strong className="text-text">$0 credit balance</strong> to 50 requests/day across all free models. Add $10 credits at <a href="https://openrouter.ai/credits" target="_blank" rel="noreferrer" className="text-accent-light underline font-bold">openrouter.ai/credits</a> to unlock <strong>1,000 free requests/day</strong>.
       </p>
       <p className="text-[10px] text-emerald-400 font-mono font-semibold">
         ⚡ Auto-Generated Grounded Support Draft Previewed Below:
       </p>
     </div>
   )}
   ```
3. **Missing Telemetry & Error Detail Extraction**:
   - `rateLimitWarning` is a simple `string | null` state.
   - When non-429 errors occur (401 Unauthorized, 402 Payment Required, 503 Service Unavailable, 529 Site Overloaded), the system either dumps raw JSON into `testResponse` or misdiagnoses non-daily rate limits as "Free-Tier Daily Limit Reached (50 reqs/day on $0 balance)".
   - The verbatim error string received from OpenRouter (`data?.error?.message`) is not rendered as a code block in the banner.
   - Grounded fallback reply does not indicate its mode badge (`[⚡ Grounded Offline Synthesizer Fallback Active]`).
4. **Primary vs Secondary Fallback Model Flow (lines 337–388)**:
   - When primary model fails, the system attempts `fallbackModel`.
   - If both fail, the error details from the last failed attempt must be captured and classified accurately.

---

## 2. Logic Chain

1. **Problem Analysis (Ref: Obs 1, 2)**:
   - Users and admins testing AI replies in the admin playground experience several distinct upstream OpenRouter error modes:
     1. **`daily_cap`**: 429 status where OpenRouter daily quota on $0 balance is exceeded (50 reqs/day).
     2. **`rate_limit`**: 429 status for short-term per-minute burst concurrency (e.g. 20 reqs/min).
     3. **`congestion`**: 503 / 529 / 504 / 500 where the upstream model or host provider is overloaded or queue is busy.
     4. **`credits_exhausted`**: 402 status or insufficient credit balance on paid/non-free models.
     5. **`auth_error`**: 401 status or invalid/revoked API key.
     6. **`general`**: Network failures, client aborts, or unrecognized 4xx/5xx status codes.
   - Conflating all these errors into a single hardcoded "50 reqs/day" banner creates confusion when an admin simply entered an invalid key, hit a per-minute burst limit, or the upstream provider is experiencing traffic spikes.

2. **Verbatim Upstream Error Extraction & Parsing**:
   - OpenRouter returns error payloads in standard JSON formats:
     - Nested object: `{ error: { message: "...", code: 429, metadata: { ... } } }`
     - Flat object: `{ error: "...", message: "..." }`
     - Or HTTP status text: `response.statusText` ("Too Many Requests", "Payment Required", etc.)
   - We extract:
     `const verbatimMessage = data?.error?.message || data?.message || (typeof data?.error === 'string' ? data?.error : '') || response.statusText || \`HTTP \${response.status}\`;`
   - This guarantees the exact message returned by OpenRouter is preserved without loss.

3. **Classification Taxonomy & Parser Algorithm**:
   - A pure helper function `parseOpenRouterError(statusCode: number, rawPayload: any, statusText?: string): OpenRouterErrorDiagnostics` evaluates:
     1. `daily_cap`: `(statusCode === 429 || /rate limit/i.test(msg)) && (/daily|per day|free tier limit|free-tier limit|50 req|50 requests|day limit|today/i.test(msg))`
     2. `credits_exhausted`: `statusCode === 402 || /insufficient credit|insufficient balance|credit balance|out of credits|require credits|requires credits|balance is too low|payment required|paid credits/i.test(msg)`
     3. `auth_error`: `statusCode === 401 || /invalid api key|unauthorized|api key not found|invalid auth|key disabled|invalid credentials|user not found/i.test(msg)`
     4. `congestion`: `statusCode === 503 || statusCode === 529 || statusCode === 504 || /congestion|overloaded|busy|high traffic|queue|temporarily unavailable|experiencing high demand|capacity/i.test(msg)`
     5. `rate_limit`: `statusCode === 429 || /rate limit|too many requests|per minute|burst|concurrency|20 req/i.test(msg)`
     6. `general`: Any other error status or unclassified network exception.

4. **UI Banner & Fallback Integration**:
   - `AdminAIConfig.tsx` state update:
     `const [errorDiagnostics, setErrorDiagnostics] = useState<OpenRouterErrorDiagnostics | null>(null);`
   - Banner renders:
     - Category header with color badge (amber for daily_cap/rate_limit, purple for congestion, rose for auth_error/credits_exhausted, indigo for general).
     - Code block formatted with monospace font displaying the verbatim upstream message.
     - Contextual resolution instructions with direct hyperlinks (e.g. `openrouter.ai/credits` or `openrouter.ai/keys`).
     - Grounded Offline Synthesizer indicator badge: `[⚡ Grounded Offline Synthesizer Fallback Active]`.
   - `testResponse` displays the generated domain support draft prefixed with `[⚡ Grounded Offline Synthesizer Fallback Active]\n\n`.

---

## 3. Caveats

1. **Live Network Testing vs Mocking**: In offline development or sandbox environments without live internet access to `openrouter.ai`, unit tests must test `parseOpenRouterError` against representative response fixtures.
2. **OpenRouter Message Phrasing Variations**: Upstream providers may occasionally alter wording. The regex heuristics use broad token matching (`daily`, `50 req`, `per day`, `insufficient credit`, `overloaded`, `busy`, `queue`) to remain resilient across wording variations.
3. **No Caveats on Component Integration**: The recommended changes are self-contained within `AdminAIConfig.tsx` and have zero side effects on other pages or services.

---

## 4. Conclusion & Recommended Implementation

### A. TypeScript Interface Contracts
Add to `packages/web/src/components/admin/AdminAIConfig.tsx` (and mirror in `packages/web/src/lib/__tests__/openrouter-telemetry.test.ts`):

```typescript
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
```

### B. Pure Diagnostics Parser Implementation
```typescript
export function parseOpenRouterError(
  statusCode: number,
  rawErrorPayload: any,
  statusText?: string
): OpenRouterErrorDiagnostics {
  let verbatimMessage = '';
  if (typeof rawErrorPayload === 'string' && rawErrorPayload.trim()) {
    verbatimMessage = rawErrorPayload.trim();
  } else if (rawErrorPayload && typeof rawErrorPayload === 'object') {
    verbatimMessage =
      rawErrorPayload.error?.message ||
      rawErrorPayload.message ||
      (typeof rawErrorPayload.error === 'string' ? rawErrorPayload.error : '');
    
    if (!verbatimMessage || !verbatimMessage.trim()) {
      verbatimMessage = statusText || (statusCode ? `HTTP ${statusCode}` : 'Upstream service error');
    }
  } else {
    verbatimMessage = statusText || (statusCode ? `HTTP ${statusCode}` : 'Unknown upstream error');
  }

  const lower = verbatimMessage.toLowerCase();

  // 1. Daily Cap (429 with explicit daily limit keywords)
  const isDailyCap =
    (statusCode === 429 || lower.includes('429') || lower.includes('rate limit')) &&
    (lower.includes('daily') ||
      lower.includes('per day') ||
      lower.includes('free tier limit') ||
      lower.includes('free-tier limit') ||
      lower.includes('50 req') ||
      lower.includes('50 requests') ||
      lower.includes('day limit') ||
      lower.includes('today'));

  if (isDailyCap) {
    return {
      category: 'daily_cap',
      statusCode: statusCode || 429,
      verbatimMessage,
      actionableGuidance:
        'OpenRouter limits accounts with $0 credit balance to 50 requests/day across all free models. Add $10 credits at openrouter.ai/credits to unlock 1,000 free requests/day.',
    };
  }

  // 2. Credits Exhausted (402 or explicit balance/credit keywords)
  const isCreditsExhausted =
    statusCode === 402 ||
    lower.includes('insufficient credit') ||
    lower.includes('insufficient balance') ||
    lower.includes('credit balance') ||
    lower.includes('out of credits') ||
    lower.includes('require credits') ||
    lower.includes('requires credits') ||
    lower.includes('balance is too low') ||
    lower.includes('payment required') ||
    lower.includes('paid credits');

  if (isCreditsExhausted) {
    return {
      category: 'credits_exhausted',
      statusCode: statusCode || 402,
      verbatimMessage,
      actionableGuidance:
        'Your OpenRouter account has exhausted its credit balance for non-free models. Add credits at openrouter.ai/credits or select an 100% free model (:free).',
    };
  }

  // 3. Auth Error (401 or invalid key keywords)
  const isAuthError =
    statusCode === 401 ||
    lower.includes('invalid api key') ||
    lower.includes('unauthorized') ||
    lower.includes('api key not found') ||
    lower.includes('invalid auth') ||
    lower.includes('key disabled') ||
    lower.includes('invalid credentials') ||
    lower.includes('user not found');

  if (isAuthError) {
    return {
      category: 'auth_error',
      statusCode: statusCode || 401,
      verbatimMessage,
      actionableGuidance:
        'Your OpenRouter API key is missing, invalid, or revoked. Please verify and re-enter your API key in the configuration settings.',
    };
  }

  // 4. Model Queue Congestion / High Traffic (503, 529, or congestion keywords)
  const isCongestion =
    statusCode === 503 ||
    statusCode === 529 ||
    statusCode === 504 ||
    lower.includes('congestion') ||
    lower.includes('overloaded') ||
    lower.includes('busy') ||
    lower.includes('high traffic') ||
    lower.includes('queue') ||
    lower.includes('temporarily unavailable') ||
    lower.includes('experiencing high demand') ||
    lower.includes('capacity');

  if (isCongestion) {
    return {
      category: 'congestion',
      statusCode: statusCode || 503,
      verbatimMessage,
      actionableGuidance:
        'Upstream AI model provider is experiencing temporary queue congestion or high load. Try switching to an alternative free model or retry in a few moments.',
    };
  }

  // 5. Rate Limit (429 short term / concurrency / burst)
  const isRateLimit =
    statusCode === 429 ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('per minute') ||
    lower.includes('burst') ||
    lower.includes('concurrency') ||
    lower.includes('20 req');

  if (isRateLimit) {
    return {
      category: 'rate_limit',
      statusCode: statusCode || 429,
      verbatimMessage,
      actionableGuidance:
        'Short-term rate limit reached (20 requests/minute burst limit). Please wait a few seconds before retrying.',
    };
  }

  // 6. General Fallback
  return {
    category: 'general',
    statusCode: statusCode || 500,
    verbatimMessage,
    actionableGuidance:
      'An unexpected upstream error occurred during generation. The grounded offline synthesizer fallback has generated an instant draft below.',
  };
}
```

### C. Refactored `handleTestDraft`
```typescript
  const [errorDiagnostics, setErrorDiagnostics] = useState<OpenRouterErrorDiagnostics | null>(null);

  const handleTestDraft = async () => {
    if (provider !== 'openrouter') {
      alert('Playground currently supports live OpenRouter testing directly from your browser.');
      return;
    }
    if (!openrouterKey.trim()) {
      alert('Please enter your OpenRouter API Key first.');
      return;
    }

    setIsTesting(true);
    setTestResponse(null);
    setErrorDiagnostics(null);
    const start = Date.now();

    try {
      const activeModel = customOpenrouterModel.trim() || openrouterModel || 'google/gemma-4-26b-a4b-it:free';
      const fallbackModel = activeModel.includes('26b') ? 'google/gemma-4-31b-it:free' : 'google/gemma-4-26b-a4b-it:free';

      let usedModel = activeModel;
      let isFallback = false;

      // 1. Try Primary Model
      let response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openrouterKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://draftpilot-web.vercel.app',
          'X-Title': 'DraftPilot Admin Playground',
        },
        body: JSON.stringify({
          model: activeModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: testThread },
          ],
          temperature: temperature,
          max_tokens: maxTokens,
        }),
      });

      let data = await response.json().catch(() => null);

      // 2. Auto-fallback Model if Primary fails
      if ((!response.ok || !data?.choices?.[0]) && fallbackModel !== activeModel) {
        console.warn(`Primary model ${activeModel} returned ${response.status}. Attempting auto-fallback to ${fallbackModel}...`);
        const fallbackRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openrouterKey.trim()}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://draftpilot-web.vercel.app',
            'X-Title': 'DraftPilot Admin Playground',
          },
          body: JSON.stringify({
            model: fallbackModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: testThread },
            ],
            temperature: temperature,
            max_tokens: maxTokens,
          }),
        });

        const fallbackData = await fallbackRes.json().catch(() => null);
        if (fallbackRes.ok && fallbackData?.choices?.[0]) {
          response = fallbackRes;
          data = fallbackData;
          usedModel = fallbackModel;
          isFallback = true;
        } else if (fallbackData?.error?.message) {
          response = fallbackRes;
          data = fallbackData;
        }
      }

      const latency = (Date.now() - start) / 1000;

      if (response.ok && data?.choices && data.choices[0]) {
        setErrorDiagnostics(null);
        const rawContent = data.choices[0].message?.content || '';
        let cleaned = rawContent.trim();
        
        cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        if (
          /^(?:Here(?:'s| is) (?:a |the )?(?:thinking process|thought process|reasoning):?|Thinking Process:?|Thought Process:?|Reasoning:?|\d+\.\s*\*\*Analyze User Input)/i.test(
            cleaned
          )
        ) {
          const emailMatch = cleaned.match(
            /(?:^|\n\s*\n|\n)(?:> )?(Hi\b|Hello\b|Dear\b|Thank you\b|Thanks\b|Good morning\b|Good afternoon\b|Greetings\b)([\s\S]+)$/i
          );
          if (emailMatch) {
            cleaned = (emailMatch[1] + emailMatch[2]).trim();
          } else {
            const splitMatch = cleaned.split(/\*\*(?:Final Response|Reply|Draft|Email):\*\*/i);
            if (splitMatch.length > 1 && splitMatch[1].trim().length > 15) {
              cleaned = splitMatch[1].trim();
            }
          }
        }

        if (
          /^(?:Here(?:'s| is) (?:a |the )?thinking process|\d+\.\s*\*\*Analyze User Input)/i.test(cleaned) ||
          cleaned.startsWith('1.  **Analyze') ||
          cleaned.startsWith('1. **Analyze')
        ) {
          cleaned = '';
        }

        const codeBlockMatch = cleaned.match(/```(?:markdown|text|email)?\s*\n([\s\S]*?)\n```/i);
        if (codeBlockMatch && codeBlockMatch[1].trim().length > 10) {
          cleaned = codeBlockMatch[1].trim();
        } else {
          cleaned = cleaned.replace(/^```(?:markdown|text|email)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
        }

        cleaned = cleaned
          .replace(/^(?:Here is (?:the|a) (?:draft|reply|response|suggested reply):?|Draft reply:?|Response:?|Email:?|Suggested Reply:?)\s*\n+/i, '')
          .trim();

        cleaned = cleaned
          .replace(/{{name}}/gi, 'there')
          .replace(/{{customer_name}}/gi, 'there')
          .replace(/\[Customer(?:\s*Name)?\]/gi, 'there')
          .replace(/\[Name\]/gi, 'there')
          .replace(/\[Client(?:\s*Name)?\]/gi, 'there')
          .replace(/\[Your Name\]/gi, 'Support Team')
          .replace(/\[Agent Name\]/gi, 'Support Team')
          .replace(/\[Representative Name\]/gi, 'Support Team')
          .replace(/\[Company Name\]/gi, 'DraftPilot Support')
          .replace(/\[Support Team\]/gi, 'Support Team')
          .replace(/{{agent_name}}/gi, 'Support Team');

        const prefix = isFallback ? `[⚡ Auto-Fallback Active: Generated with ${usedModel}]\n\n` : '';
        setTestResponse(prefix + (cleaned || rawContent));
        setTestMetrics({
          tokens: data.usage?.total_tokens || 0,
          latency: latency,
        });
      } else {
        const diag = parseOpenRouterError(response.status, data, response.statusText);
        setErrorDiagnostics(diag);

        const smartReply = generateSmartSupportReply(testThread);
        const fallbackDraft = `[⚡ Grounded Offline Synthesizer Fallback Active]\n\n${smartReply}`;
        setTestResponse(fallbackDraft);
        setTestMetrics({
          tokens: 135,
          latency: latency,
        });
      }
    } catch (err: any) {
      const diag = parseOpenRouterError(0, err.message || 'Network connection error');
      setErrorDiagnostics(diag);

      const smartReply = generateSmartSupportReply(testThread);
      const fallbackDraft = `[⚡ Grounded Offline Synthesizer Fallback Active]\n\n${smartReply}`;
      setTestResponse(fallbackDraft);
      setTestMetrics({
        tokens: 135,
        latency: (Date.now() - start) / 1000,
      });
    } finally {
      setIsTesting(false);
    }
  };
```

### D. JSX Advisory Banner Specification
```tsx
{errorDiagnostics && (
  <div
    className={`mt-3 p-3.5 rounded-2xl border text-[11px] space-y-2.5 ${
      errorDiagnostics.category === 'daily_cap'
        ? 'bg-amber-500/10 border-amber-500/30'
        : errorDiagnostics.category === 'rate_limit'
        ? 'bg-orange-500/10 border-orange-500/30'
        : errorDiagnostics.category === 'congestion'
        ? 'bg-purple-500/10 border-purple-500/30'
        : errorDiagnostics.category === 'credits_exhausted' || errorDiagnostics.category === 'auth_error'
        ? 'bg-rose-500/10 border-rose-500/30'
        : 'bg-indigo-500/10 border-indigo-500/30'
    }`}
  >
    {/* Header */}
    <div className="flex items-center justify-between">
      <div
        className={`flex items-center gap-1.5 font-bold text-[11px] ${
          errorDiagnostics.category === 'daily_cap'
            ? 'text-amber-400'
            : errorDiagnostics.category === 'rate_limit'
            ? 'text-orange-400'
            : errorDiagnostics.category === 'congestion'
            ? 'text-purple-400'
            : errorDiagnostics.category === 'credits_exhausted' || errorDiagnostics.category === 'auth_error'
            ? 'text-rose-400'
            : 'text-indigo-400'
        }`}
      >
        <span>
          {errorDiagnostics.category === 'daily_cap'
            ? '⚠️'
            : errorDiagnostics.category === 'rate_limit'
            ? '⏱️'
            : errorDiagnostics.category === 'congestion'
            ? '🚦'
            : errorDiagnostics.category === 'credits_exhausted'
            ? '💳'
            : errorDiagnostics.category === 'auth_error'
            ? '🔒'
            : '⚡'}
        </span>
        <span>
          {errorDiagnostics.category === 'daily_cap'
            ? 'OpenRouter Free-Tier Daily Limit Reached'
            : errorDiagnostics.category === 'rate_limit'
            ? 'OpenRouter Per-Minute Rate Limit Exceeded'
            : errorDiagnostics.category === 'congestion'
            ? 'Upstream Model Queue Congestion'
            : errorDiagnostics.category === 'credits_exhausted'
            ? 'OpenRouter Account Credits Exhausted'
            : errorDiagnostics.category === 'auth_error'
            ? 'OpenRouter Authentication Error'
            : 'Upstream Service Advisory'}
        </span>
      </div>
      <span
        className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-semibold ${
          errorDiagnostics.category === 'daily_cap'
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            : errorDiagnostics.category === 'rate_limit'
            ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
            : errorDiagnostics.category === 'congestion'
            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
            : errorDiagnostics.category === 'credits_exhausted' || errorDiagnostics.category === 'auth_error'
            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
        }`}
      >
        {errorDiagnostics.category === 'daily_cap'
          ? '50 reqs/day ($0 balance)'
          : errorDiagnostics.category === 'rate_limit'
          ? '20 reqs/min burst cap'
          : errorDiagnostics.category === 'congestion'
          ? '503 / 529 High Load'
          : errorDiagnostics.category === 'credits_exhausted'
          ? '402 Payment Required'
          : errorDiagnostics.category === 'auth_error'
          ? '401 Invalid Key'
          : 'Grounded Fallback'}
      </span>
    </div>

    {/* Verbatim Upstream Message */}
    <div className="space-y-1">
      <div className="text-[10px] text-text-dim uppercase tracking-wider font-semibold">
        Verbatim Upstream OpenRouter Error:
      </div>
      <div className="p-2 rounded-lg bg-bg/90 border border-border/70 font-mono text-[10.5px] text-text break-words leading-relaxed">
        {errorDiagnostics.verbatimMessage}
      </div>
    </div>

    {/* Actionable Guidance */}
    <div className="text-text-muted text-[11px] leading-relaxed">
      {errorDiagnostics.actionableGuidance}{' '}
      {(errorDiagnostics.category === 'daily_cap' || errorDiagnostics.category === 'credits_exhausted') && (
        <span>
          Add credits at{' '}
          <a
            href="https://openrouter.ai/credits"
            target="_blank"
            rel="noreferrer"
            className="text-accent-light underline font-bold hover:text-white"
          >
            openrouter.ai/credits
          </a>{' '}
          to unlock higher quotas.
        </span>
      )}
      {errorDiagnostics.category === 'auth_error' && (
        <span>
          Manage keys at{' '}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer"
            className="text-accent-light underline font-bold hover:text-white"
          >
            openrouter.ai/keys
          </a>.
        </span>
      )}
    </div>

    {/* Grounded Offline Synthesizer Fallback Indicator */}
    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10.5px]">
      <span className="text-emerald-400 font-mono font-semibold flex items-center gap-1">
        <span>⚡</span>
        <span>[Grounded Offline Synthesizer Fallback Active]</span>
      </span>
      <span className="text-[10px] text-text-dim">100% Policy Grounded</span>
    </div>
  </div>
)}
```

---

## 5. Verification Method

To verify these findings and ensure zero regressions:

1. **Unit Test Verification**:
   Execute the test suite using the workspace Node runtime:
   ```bash
   export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
   node --experimental-strip-types --test packages/web/src/lib/__tests__/*.test.ts
   ```
2. **Telemetry Test Suite (`openrouter-telemetry.test.ts`)**:
   In Milestone 3, verify that unit tests cover all 6 error categories:
   - `daily_cap` (429 with 50 reqs/day message)
   - `rate_limit` (429 with 20 reqs/min message)
   - `congestion` (503 / 529 queue overload)
   - `credits_exhausted` (402 insufficient balance)
   - `auth_error` (401 invalid key)
   - `general` (500 or network failure)
   - Verbatim error extraction from all payload structures
3. **UI Inspection in Browser**:
   Ensure that when errors trigger in the admin playground, the advisory banner renders with the correct category styling and code block, and the preview text includes `[⚡ Grounded Offline Synthesizer Fallback Active]`.

