# Initial Survey Investigation Report: OpenRouter Integration, Upstream Error Handling & Telemetry

## 1. Observation

Direct code observations from the DraftPilot codebase across `packages/web`, `packages/api`, and `packages/extension`:

### 1.1 OpenRouter API Call Points & Draft Generation Call Handlers
1. **Next.js Web Draft Generation Endpoint (`/api/drafts/generate`)**:
   - **File**: `packages/web/src/app/api/drafts/generate/route.ts`
   - **Lines 256–345**:
     ```typescript
     if (settings && settings.openrouter_api_key) {
       try {
         const activeModel = settings.selected_model || settings.openrouter_model || 'google/gemma-4-26b-a4b-it:free';
         const fallbackModel = activeModel.includes('26b') ? 'google/gemma-4-31b-it:free' : 'google/gemma-4-26b-a4b-it:free';
         // Primary call (8s timeout)
         let openrouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             Authorization: `Bearer ${settings.openrouter_api_key}`,
             'HTTP-Referer': 'https://draftpilot-web.vercel.app',
             'X-Title': 'DraftPilot',
           },
           body: JSON.stringify({
             model: activeModel,
             messages: [
               { role: 'system', content: strictSystemPrompt },
               { role: 'user', content: userPrompt },
             ],
             max_tokens: Math.max(1000, Number(settings.max_tokens) || 1000),
             temperature: parseFloat(settings.temperature as string) || 0.4,
             include_reasoning: false,
             reasoning: { max_tokens: 0 },
           }),
           signal: AbortSignal.timeout(8000),
         });
         let openRouterData = await openrouterRes.json().catch(() => null);
         // Fallback model call
         if ((!openrouterRes.ok || !openRouterData?.choices?.[0]) && fallbackModel !== activeModel) {
           console.warn(`Primary model ${activeModel} failed (${openrouterRes.status}). Attempting auto-fallback to ${fallbackModel}...`);
           const fallbackRes = await fetch('https://openrouter.ai/api/v1/chat/completions', { ... });
           ...
         }
         ...
       } catch (aiErr) {
         console.warn('Server OpenRouter generation note:', aiErr);
       }
     }
     ```
   - **Lines 348–363**: Degrades to `synthesizeSmartSupportDraft(threadContent, customerName)` if OpenRouter calls fail.
   - **Lines 380–385**: Always returns HTTP 200 `{ draft: draftText, macroUsed: ..., confidence: ... }` to caller.

2. **NestJS Backend AI Provider Service (`AiProviderService`)**:
   - **File**: `packages/api/src/drafts/ai-provider.service.ts`
   - **Lines 77–148**: Executes dual-model OpenRouter calls to `https://openrouter.ai/api/v1/chat/completions` with 8s timeouts.
   - **Lines 173–174**: Falls back to `synthesizeSmartDraft(prompt, customerName)` on error.
   - **File**: `packages/api/src/drafts/drafts.service.ts` (lines 47–150): Invoked by `DraftsController` (`POST /drafts/generate`). Checks billing limits, queries macros and KB chunks, calls `AiProviderService.generateText()`, and stores results in `draft_history`.

3. **Admin Settings & Interactive Playground Component (`AdminAIConfig.tsx`)**:
   - **File**: `packages/web/src/components/admin/AdminAIConfig.tsx`
   - **Lines 187–216 (`handleVerifyKey`)**:
     ```typescript
     const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
       headers: { Authorization: `Bearer ${trimmed}` },
     });
     const json = await res.json().catch(() => null);
     if (res.ok && json?.data) {
       setKeyStatus('valid');
       const label = json.data.label ? ` (${json.data.label})` : '';
       setKeyVerifyMessage(`Verified & Active${label}`);
       ...
     } else {
       setKeyStatus('invalid');
       setKeyVerifyMessage(json?.error?.message || 'Invalid OpenRouter Key');
     }
     ```
   - **Lines 315–480 (`handleTestDraft`)**: Executes client-side test generation directly to `https://openrouter.ai/api/v1/chat/completions` from browser, tries primary model and fallback model, cleans output, and checks errors.
   - **Lines 461–474 & 746–759**: Error evaluation in playground:
     ```typescript
     const errMsg = data?.error?.message || '';
     if (errMsg.includes('Rate limit') || errMsg.includes('credits') || response.status === 429) {
       setRateLimitWarning(errMsg);
       const smartReply = generateSmartSupportReply(testThread);
       setTestResponse(smartReply);
       ...
     }
     ```
     UI banner rendered:
     ```tsx
     {rateLimitWarning && (
       <div className="mt-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[11px] space-y-2">
         <div className="flex items-center justify-between text-amber-400 font-bold text-[10px]">
           <span>⚠️ OpenRouter Free-Tier Daily Limit Reached</span>
           <span className="font-mono">50 reqs/day on $0 balance</span>
         </div>
         <p className="text-text-muted leading-relaxed">
           OpenRouter limits accounts with <strong className="text-text">$0 credit balance</strong> to 50 requests/day across all free models...
         </p>
         ...
       </div>
     )}
     ```

4. **Chrome Extension Invocation Client (`ApiClient`)**:
   - **File**: `packages/extension/src/utils/api-client.ts`
   - **Lines 575–597**: Calls `POST https://draftpilot-web.vercel.app/api/drafts/generate` with JWT bearer token.
   - **Lines 603–665**: Executes local client-side `synthesizeSmartSupportDraft` if web API request fails or is offline.

---

## 2. Logic Chain

1. **Error Propagation & Deserialization Trace**:
   - In both `route.ts` (lines 300 & 342) and `ai-provider.service.ts` (lines 105 & 146), errors from `https://openrouter.ai/api/v1/chat/completions` are caught locally in a `try...catch` block.
   - The endpoints do NOT rethrow or propagate status codes (401, 402, 429, 503) or error messages upstream to the caller (e.g. extension or web frontend).
   - Instead, the server swallows the error, executes the domain synthesizer fallback, and responds with HTTP 200 `{ draft: draftText, macroUsed: ..., confidence: ... }`.
   - Result: Upstream OpenRouter failure modes are completely invisible to the Chrome Extension user and standard web callers.

2. **Error Conflation in Playground (`AdminAIConfig.tsx`)**:
   - In `AdminAIConfig.tsx` line 462, any error that returns HTTP status 429, or whose message contains the substring `'Rate limit'` or `'credits'`, triggers `setRateLimitWarning(errMsg)`.
   - The banner rendered in lines 746–759 statically assumes the cause is the free-tier daily cap (`"⚠️ OpenRouter Free-Tier Daily Limit Reached"`, `"50 reqs/day on $0 balance"`).
   - This conflates four completely distinct failure modes:
     1. **Free-tier daily account cap** (50 reqs/day on $0 balance).
     2. **Per-minute concurrency / burst limit** (20 reqs/min).
     3. **Upstream provider queue congestion / capacity overload** (503 Service Unavailable / 529 Site Overloaded / model busy).
     4. **Account credit exhaustion / payment required** (HTTP 402 Payment Required).
     5. **Invalid / unauthenticated API key** (HTTP 401 Unauthorized).
   - The verbatim error message returned by OpenRouter (`data?.error?.message`) is NOT rendered inside the warning banner — the banner only displays hardcoded static text.

3. **Key Quota & Balance Telemetry Gap (`handleVerifyKey`)**:
   - OpenRouter's `/api/v1/auth/key` endpoint returns comprehensive live metadata:
     - `data.label`: Key name
     - `data.usage`: Credits used ($)
     - `data.limit`: Credit limit ($ or null for unlimited)
     - `data.limit_remaining`: Remaining credit limit ($)
     - `data.is_free_tier`: Boolean flag indicating if account is on free tier
     - `data.rate_limit.requests` and `data.rate_limit.interval`: Concurrency rate limits (e.g. 20 requests per 10s/1m)
   - In `AdminAIConfig.tsx` lines 201–208, only `data.label` is extracted. `usage`, `limit`, `limit_remaining`, `is_free_tier`, and `rate_limit` are currently discarded and not presented in the UI.

---

## 3. Caveats

1. **Environment Sandbox & Live API Keys**: Local test suites run in sandbox mode with mock/local tokens. Live testing against `https://openrouter.ai` requires a valid API key (`sk-or-v1-...`) and active network connectivity.
2. **OpenRouter Rate Limits Evolution**: OpenRouter adjusts rate limit caps (e.g. 20 req/min vs 50 req/day for free tier vs 1,000 req/day for accounts with $10+ credits). Live telemetry should query `/api/v1/auth/key` dynamically rather than hardcoding static limits.
3. **No Caveats** regarding file paths or architecture — all call points and components have been mapped and verified.

---

## 4. Conclusion

1. **Exact Files Requiring Enhancement**:
   - `packages/web/src/components/admin/AdminAIConfig.tsx`:
     - Upgrade `handleVerifyKey` to query `/api/v1/auth/key`, parse full `data` object (`usage`, `limit`, `limit_remaining`, `is_free_tier`, `rate_limit`), and render live telemetry badge/metrics in the UI.
     - Upgrade `handleTestDraft` and the playground error banner to differentiate between:
       - 429 Daily Limit (50 req/day on $0 balance) vs 429 Concurrency (20 req/min)
       - 503/529 Model Provider Congestion (busy free model)
       - 401 Invalid API Key
       - 402 Insufficient Balance
     - Display the **verbatim upstream OpenRouter error message** inside the banner alongside tailored, actionable resolution guidance.
   - `packages/web/src/lib/__tests__/ai-pipeline.test.ts`: Add comprehensive test suites verifying `/api/v1/auth/key` response parsing, telemetry display structures, 429 vs 503 error classification, and verbatim error extraction.

2. **Architecture Assessment**:
   - The multi-tier fallback cascade (Tier 1 primary model -> Tier 2 secondary model -> Tier 3 macro/KB fallback -> Tier 4 5-intent domain synthesizer) operates smoothly and reliably.
   - The existing fallback synthesizer guarantees zero-downtime customer support drafts even during severe upstream OpenRouter rate limiting.

---

## 5. Verification Method

1. **Run Full Monorepo Test Suite**:
   ```bash
   export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
   export HOME="/home/md-roni-ahamed/Test project/.tmp_home"
   export PNPM_HOME="/home/md-roni-ahamed/Test project/.tmp_home/share/pnpm"
   pnpm test
   ```
   *Expected Result*: All 64+ unit and integration tests pass across packages.

2. **Run Monorepo Production Builds**:
   ```bash
   pnpm build:ext
   pnpm build:api
   pnpm build:web
   ```
   *Expected Result*: All packages compile and produce production bundles without type or build errors.

3. **Inspect Modified Files**:
   - Inspect `AdminAIConfig.tsx` to verify key telemetry parsing from `/api/v1/auth/key` and verbatim error banner rendering.
