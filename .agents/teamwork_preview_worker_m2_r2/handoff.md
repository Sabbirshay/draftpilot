# Milestone 2: Supabase RLS Policies, Secret Isolation & Server-Side PII Scrubbing Handoff Report

## 1. Observation

1. **Supabase RLS Policy Hardening**:
   - `packages/api/supabase/migrations/003_strict_rls_security.sql:44-58`:
     - Updated the `users` table `UPDATE` policy to prevent authenticated users from mutating `team_id` or `role`:
       ```sql
       CREATE POLICY "Users can update own profile" ON users
         FOR UPDATE TO authenticated
         USING (id = auth.uid())
         WITH CHECK (
           id = auth.uid()
           AND team_id = (SELECT team_id FROM users WHERE id = auth.uid())
           AND role = (SELECT role FROM users WHERE id = auth.uid())
         );
       ```
     - Hardened the `teams` table `INSERT` policy to prevent unauthorized tier/limit escalation:
       ```sql
       CREATE POLICY "Users can insert team" ON teams
         FOR INSERT TO authenticated
         WITH CHECK (
           plan = 'free'
           AND monthly_draft_limit = 50
           AND stripe_customer_id IS NULL
           AND stripe_subscription_id IS NULL
         );
       ```
   - `packages/api/supabase/migrations/006_harden_user_tenant_rls.sql:1-26`:
     - Created new standalone migration applying the hardened policies for `users` UPDATE and `teams` INSERT.

2. **Server-Side PII Scrubbing**:
   - Created `packages/api/src/utils/pii-scrubber.ts` and `packages/web/src/lib/pii-scrubber.ts` exporting `scrubPII` with support for all 8 categories:
     - Credit Cards (`[CARD_REDACTED]`)
     - Emails (`[EMAIL_REDACTED]`)
     - API Tokens, JWTs & Auth keys (`[TOKEN_REDACTED]`)
     - Passwords & Secrets (`[SECRET_REDACTED]`)
     - SSNs (`[SSN_REDACTED]`)
     - IPv4 (`[IP_REDACTED]`)
     - Phone numbers (`[PHONE_REDACTED]`)
     - Street Addresses & PO Boxes (`[ADDRESS_REDACTED]`)
   - Applied `scrubPII` in `packages/api/src/drafts/drafts.service.ts`:
     - Applied to `dto.threadContent` before sender name extraction, knowledge retrieval, prompt construction, and AI generation.
     - Applied to `thread_snippet` and `generated_draft` before saving to `draft_history`.
   - Applied `scrubPII` in `packages/web/src/app/api/drafts/generate/route.ts`:
     - Applied to `threadContent` before prompt generation and synthesized fallback.
     - Applied to `thread_snippet` and `generated_draft` before inserting into `draft_history`.

3. **Client-Side Secret Cleanliness in `AdminAIConfig.tsx`**:
   - `packages/web/src/components/admin/AdminAIConfig.tsx`:
     - Removed storage and retrieval of third-party API keys (`draftpilot_openrouter_key`, `draftpilot_openai_key`) from `localStorage`.
     - Added automatic cleanup on startup and save to purge any legacy keys from `localStorage`.
     - Preserved sensitive API keys strictly in React state in memory, securely syncing them via the authenticated `/api/admin/ai-config` server endpoint.

4. **Testing and Build Verification**:
   - Added unit test suite `packages/web/src/lib/__tests__/server-pii-scrubber.test.ts` covering all PII categories and edge cases.
   - Added unit test suite `packages/api/src/utils/pii-scrubber.spec.ts` for Jest.
   - Ran `pnpm test`: All 89 tests in web, 9 in extension, and 13 in api passed.
   - Ran `pnpm build:web`, `pnpm build:api`, and `pnpm build:ext`: All builds succeeded with 0 errors.

---

## 2. Logic Chain

1. **RLS Isolation Logic**:
   - In a multi-tenant Supabase architecture where all resource tables evaluate `WHERE team_id IN (SELECT team_id FROM users WHERE id = auth.uid())`, allowing an authenticated user to UPDATE `team_id` or `role` enables full tenant takeover.
   - Adding `AND team_id = (SELECT team_id FROM users WHERE id = auth.uid()) AND role = (SELECT role FROM users WHERE id = auth.uid())` in the `WITH CHECK` expression prevents users from altering their workspace binding or escalating their role.
   - Restricting `teams` `INSERT` to `plan = 'free'` and `monthly_draft_limit = 50` prevents clients from directly inserting enterprise workspaces without going through verified billing workflows.

2. **Defense-in-Depth PII Redaction Logic**:
   - Client-side scrubbing in the browser extension is necessary but insufficient if attackers or direct API clients invoke backend routes.
   - Integrating server-side PII scrubbing in both `DraftsService` (NestJS) and Next.js `generate/route.ts` guarantees that customer PII (credit cards, emails, tokens, SSNs, addresses, phone numbers, IPs, secrets) is never dispatched to upstream LLMs and never stored in `draft_history`.

3. **Secret Isolation Logic**:
   - Third-party AI provider keys (OpenRouter / OpenAI) must never reside in browser `localStorage` where any XSS attack can steal them.
   - Keys are kept in server-side `platform_settings` protected by `service_role` RLS and exposed only over authenticated admin endpoints.

---

## 3. Caveats

- In production Supabase deployments, migrations `001_initial_schema.sql` through `006_harden_user_tenant_rls.sql` should be executed via `supabase db push` or the Supabase dashboard SQL editor.
- The `scrubPII` function preserves standard non-PII support inquiries and numbers below 7 digits to prevent accidental redaction of legitimate product model numbers or quantities.

---

## 4. Conclusion

All requirements for Milestone 2 have been implemented and verified:
- `users` and `teams` RLS policies hardened in `003_strict_rls_security.sql` and `006_harden_user_tenant_rls.sql`.
- Isomorphic `scrubPII` created in `packages/api/src/utils/pii-scrubber.ts` and `packages/web/src/lib/pii-scrubber.ts`.
- Server-side scrubbing applied in `drafts.service.ts` and `generate/route.ts`.
- API key leaks eliminated in `AdminAIConfig.tsx`.
- All tests and builds pass with 0 errors.

---

## 5. Verification Method

To independently verify the implementation:

1. **Run Unit & Integration Test Suite**:
   ```bash
   export HOME="/home/md-roni-ahamed/Test project/.tmp_home"
   export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
   pnpm test
   ```
   *Expected Result: All test suites in web, api, and extension pass with 0 failures.*

2. **Verify Server-Side PII Tests Specifically**:
   ```bash
   node --experimental-strip-types --test packages/web/src/lib/__tests__/server-pii-scrubber.test.ts
   ```

3. **Verify Build Commands**:
   ```bash
   pnpm build:web
   pnpm build:api
   pnpm build:ext
   ```
   *Expected Result: All builds complete with exit code 0.*

4. **Verify Secret Cleanliness**:
   ```bash
   grep -rn "draftpilot_openrouter_key\|draftpilot_openai_key" packages/web/src/components/
   ```
   *Expected Result: Only removeItem cleanup calls present.*
