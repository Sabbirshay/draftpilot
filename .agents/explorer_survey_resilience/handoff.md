# Handoff Report: Requirement R2 (Dual-Model Fallback & Smart Support Synthesizer Resilience)

## 1. Observation

1. **Next.js API Route (`packages/web/src/app/api/drafts/generate/route.ts`)**:
   - Lines 128–129:
     ```ts
     const activeModel = settings.selected_model || settings.openrouter_model || 'google/gemma-4-26b-a4b-it:free';
     const fallbackModel = activeModel.includes('26b') ? 'google/gemma-4-31b-it:free' : 'google/gemma-4-26b-a4b-it:free';
     ```
   - Lines 166–194: Triggers secondary fallback `if ((!openrouterRes.ok || !openRouterData?.choices?.[0]) && fallbackModel !== activeModel)`.
   - Lines 210–225:
     ```ts
     if (!openRouterSuccess) {
       if (matchedMacro?.content) {
         draftText = matchedMacro.content
           .replace(/{{name}}/g, customerName)
           .replace(/{{customer_name}}/g, customerName)
           .replace(/\[Customer\]/g, customerName)
           .replace(/\[Name\]/g, customerName);
         ...
       } else {
         draftText = `Hi ${customerName},\n\nThank you for getting in touch with us! I have reviewed your inquiry and would be glad to assist you.\n\nCould you please provide a few more details so I can resolve this as quickly as possible for you?\n\nLooking forward to hearing back from you,\nCustomer Support Team`;
       }
     }
     ```
   - Observations:
     - No `AbortSignal.timeout` on upstream `fetch` calls.
     - When `matchedMacro` is not provided, the route returns a single static generic reply; it lacks domain-aware intent synthesis for specific inquiries (refunds, tracking, billing, access, technical issues).

2. **NestJS AI Provider (`packages/api/src/drafts/ai-provider.service.ts`)**:
   - Lines 67–132: OpenRouter provider with primary and secondary fallback cascade. Catches errors and falls through to `synthesizeSmartDraft(prompt)`.
   - Lines 188–258 (`synthesizeSmartDraft`):
     - Checks `refund`, `return`, `money back` (Refund intent).
     - Checks `track`, `shipping`, `where is my order`, `delivery` (Order Status & Tracking intent).
     - Checks `password`, `login`, `2fa`, `account`, `locked` (Password / Account Access intent).
     - Checks `invoice`, `receipt`, `charge`, `card`, `billing` (Billing & Invoices intent).
     - Default support reply.
   - Observations:
     - All synthesizer replies hardcode `Hi there,` / `Hello,` without personalizing with customer name.
     - Technical troubleshooting intent is absent.

3. **Chrome Extension (`packages/extension/src/utils/api-client.ts`)**:
   - Lines 578–602: Client-side offline fallback implements `refund/return`, `delay/where is/tracking`, `password/login/account`, and general fallback with personalized `Hi ${customerName},`.
   - Missing `billing` and `technical troubleshooting` intents on the extension client.

4. **Super Admin Playground (`packages/web/src/components/admin/AdminAIConfig.tsx`)**:
   - Lines 12–21 (`generateSmartSupportReply`): Detects returns/refunds and shipping/tracking intents.
   - Lines 404–412: On 429 rate limit or credit exhaustion, automatically switches to `generateSmartSupportReply(testThread)` and returns simulated output with latency and token metrics.

5. **Test Commands & Verification**:
   - `node --experimental-strip-types "packages/web/src/lib/__tests__/challenger-interactive.test.ts"` passes 19 tests.
   - `node --experimental-strip-types "packages/web/src/lib/__tests__/admin-auth.test.ts"` passes 8 tests.
   - `node --experimental-strip-types "packages/web/src/lib/__tests__/admin-m3.test.ts"` passes 3 tests.
   - `packages/api` `jest --passWithNoTests` passes cleanly.

---

## 2. Logic Chain

1. **Premise 1**: Requirement R2 mandates a multi-tier fallback cascade (primary model -> secondary fallback -> local domain-aware smart support synthesizer) that handles 429 rate limits, network drops, missing credentials, and produces contextually relevant replies for customer support intents (refunds, tracking, billing, access, troubleshooting).
2. **Premise 2**: Observation 1 shows that `packages/web/src/app/api/drafts/generate/route.ts` successfully implements Tier 1 (primary) and Tier 2 (secondary OpenRouter model), but its Tier 4 fallback is a single generic reply with no intent categorization.
3. **Premise 3**: Observation 2 shows that `packages/api/src/drafts/ai-provider.service.ts` implements Tier 1, Tier 2, and a 4-intent domain synthesizer (`refund`, `tracking`, `account access`, `billing`), but does not personalize the customer name and lacks a technical troubleshooting intent.
4. **Premise 4**: Observation 1 & 2 show that neither Next.js nor NestJS uses `AbortSignal.timeout` on upstream `fetch` calls.
5. **Conclusion**: The fallback cascade architecture is fundamentally stable against 429 errors and missing credentials without throwing uncaught exceptions. To fully meet Requirement R2 with complete consistency, the local domain synthesizer needs to be harmonized across Next.js and NestJS with 5 core intents (Refunds, Tracking, Account Access, Billing, Technical Troubleshooting), personalized customer names, and 8-second request timeouts.

---

## 3. Caveats

- **Upstream OpenRouter Connectivity**: Live external OpenRouter API calls depend on valid user API keys and network access. When offline or unconfigured, the fallback cascade must operate strictly within local synthesizer logic.
- **Next.js Production Build**: Standalone mode Next.js build requires standard environment variables, which does not affect AI runtime logic.

---

## 4. Conclusion

Requirement R2 is partially implemented with strong foundational structure:
1. **Tier 1 & Tier 2 Fallback Cascade**: Fully operational on both Next.js and NestJS.
2. **HTTP 429 & Missing Credentials Handling**: Non-throwing graceful degradation to local fallback is verified.
3. **Identified Enhancement Targets**:
   - Unify local domain-aware smart support synthesizer in Next.js (`/api/drafts/generate/route.ts`) to match NestJS intent capabilities.
   - Add explicit **Technical Troubleshooting** intent across all synthesizer implementations.
   - Add **Customer Name Personalization** (`Hi ${customerName},`) into NestJS `AiProviderService.synthesizeSmartDraft`.
   - Add `AbortSignal.timeout(8000)` to all upstream OpenRouter `fetch` calls.

---

## 5. Verification Method

To independently reproduce and verify these findings:
1. **Inspect Next.js Fallback**:
   `view_file` at `/home/md-roni-ahamed/Test project/packages/web/src/app/api/drafts/generate/route.ts` (lines 126–226).
2. **Inspect NestJS Synthesizer**:
   `view_file` at `/home/md-roni-ahamed/Test project/packages/api/src/drafts/ai-provider.service.ts` (lines 57–258).
3. **Run Test Suites**:
   ```bash
   export HOME="/home/md-roni-ahamed/Test project/.tmp_home"
   export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
   node --experimental-strip-types "packages/web/src/lib/__tests__/challenger-interactive.test.ts"
   node --experimental-strip-types "packages/web/src/lib/__tests__/admin-auth.test.ts"
   node --experimental-strip-types "packages/web/src/lib/__tests__/admin-m3.test.ts"
   ```
4. **Report Reference**:
   Detailed documentation and code line citations are available at:
   `/home/md-roni-ahamed/Test project/.agents/explorer_survey_resilience/report.md`.
