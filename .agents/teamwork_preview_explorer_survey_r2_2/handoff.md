# Requirement R2: Database Security, Row-Level Security (RLS) & Secret Isolation Security Audit Report

## 1. Observation

### 1.1 Client-Side & Server-Side Supabase Client Initialization & Secret Isolation
- **Client Web Application (`packages/web/src/lib/supabase.ts:1-12`)**:
  - Uses `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - The browser client correctly uses the public anonymous key (`role: "anon"`). `SUPABASE_SERVICE_ROLE_KEY` is not present or referenced in this file.
- **Server-Side Next.js Admin Layer (`packages/web/src/lib/admin-auth.ts:4-17`)**:
  - Initializes `supabaseAdmin` using `process.env.SUPABASE_SERVICE_ROLE_KEY` with fallback to `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` and a fallback token for test environments.
  - `admin-auth.ts` is only imported by server-side Next.js route handlers (`packages/web/src/app/api/...`) and tests.
- **Chrome Extension Client (`packages/extension/src/utils/api-client.ts:3-5`)**:
  - Contains hardcoded `SUPABASE_URL` (`https://amjliubpbysvtiqpbgnh.supabase.co`) and `SUPABASE_ANON_KEY` (JWT payload `role: "anon"`).
  - `SUPABASE_SERVICE_ROLE_KEY` is not included or bundled in the extension.
- **NestJS API Service (`packages/api/src/config/supabase.service.ts:12-21`)**:
  - Initializes the backend client using `this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')` on the server.
- **Client-Side Secret Exposure in Admin UI Components**:
  - `packages/web/src/components/admin/AdminAIConfig.tsx:100-119, 156-173, 195-200`: Plaintext third-party API keys (`openrouter_api_key`, `openai_api_key`) are saved and retrieved from browser `localStorage` (`draftpilot_openrouter_key`, `draftpilot_openai_key`).
  - `packages/web/src/components/admin/AdminAIConfig.tsx:129`: Hardcodes `'x-admin-passkey': 'draftpilot-root-2026'` in client code.
  - `packages/web/src/components/admin/AdminGuard.tsx:17` & `packages/web/src/app/admin/login/page.tsx:14`: Hardcodes `ADMIN_MASTER_PASSKEY = process.env.NEXT_PUBLIC_ADMIN_PASSKEY || 'draftpilot-root-2026'`.

### 1.2 Database Migrations, RLS Policies & Cross-Tenant Isolation
- **Database Schema Migrations Inspected**:
  - `packages/api/supabase/migrations/001_initial_schema.sql` (Tables: `teams`, `users`, `macros`, `knowledge_documents`, `document_chunks`, `usage`, `draft_history`, RPC `match_document_chunks`)
  - `packages/api/supabase/migrations/002_auth_onboarding.sql` (Tables: `team_members`, `onboarding_state`)
  - `packages/api/supabase/migrations/003_strict_rls_security.sql` (Strict non-recursive RLS policies for `users`, `teams`, `macros`, `knowledge_documents`, `document_chunks`, `draft_history`, `onboarding_state`)
  - `packages/api/supabase/migrations/004_platform_settings.sql` (Table: `platform_settings` with initial permissive authenticated SELECT policy)
  - `packages/api/supabase/migrations/005_secure_platform_settings.sql` (Restricts `platform_settings` strictly to `service_role`)
- **Key Database Policy Vulnerabilities Observed**:
  1. **Privilege Escalation & Cross-Tenant Takeover on `users` (`003_strict_rls_security.sql:44-47`)**:
     ```sql
     CREATE POLICY "Users can update own profile" ON users
       FOR UPDATE TO authenticated
       USING (id = auth.uid())
       WITH CHECK (id = auth.uid());
     ```
     Because there are no column restrictions, any authenticated user can run:
     `supabase.from('users').update({ team_id: '<victim_team_uuid>', role: 'owner' }).eq('id', auth.uid())`
     Since all other tenant-scoped policies (`macros`, `document_chunks`, `knowledge_documents`, `draft_history`, `onboarding_state`) evaluate `WHERE team_id IN (SELECT team_id FROM users WHERE id = auth.uid())`, updating `team_id` grants immediate full read/write/delete access to the victim workspace's entire data.
  2. **Unrestricted Plan/Quota Manipulation on `teams` INSERT (`003_strict_rls_security.sql:52-54`)**:
     ```sql
     CREATE POLICY "Users can insert team" ON teams
       FOR INSERT TO authenticated
       WITH CHECK (true);
     ```
     Allows inserting teams with arbitrary `plan` (e.g. `'enterprise'`) and `monthly_draft_limit` (e.g. `1000000`) directly via the Supabase client without paying.
  3. **Unauthenticated Stripe Webhook Endpoint (`packages/api/src/billing/billing.controller.ts:41-44` & `billing.service.ts:107-152`)**:
     ```typescript
     @Post('webhook')
     async handleWebhook(@Body() body: any) {
       return await this.billingService.handleWebhook(body);
     }
     ```
     `handleWebhook` lacks `stripe.webhooks.constructEvent` signature verification. Anyone can POST an unauthenticated fake `checkout.session.completed` payload to elevate any `teamId` to `plan: 'team'` and `monthly_draft_limit: 1000`.
  4. **Admin Endpoint Passkey Bypass (`packages/web/src/lib/admin-auth.ts:34-43`)**:
     ```typescript
     const passkey = req.headers.get('x-admin-passkey')?.trim();
     if (passkey && (passkey === 'draftpilot-root-2026' || passkey === 'admin2026' || passkey === 'root' || ...)) {
       return { authorized: true };
     }
     ```
     Hardcoded static passkeys allow unauthenticated callers to bypass superadmin checks and manipulate all workspaces, billing data, feature flags, and global macros.

### 1.3 Support Threads, Drafts Storage & PII Redaction
- **Chrome Extension Scrubber (`packages/extension/src/utils/pii-scrubber.ts:5-40`)**:
  - Implements regex redaction for Credit Cards (`[CARD_REDACTED]`), Emails (`[EMAIL_REDACTED]`), US SSNs (`[SSN_REDACTED]`), Phone numbers (`[PHONE_REDACTED]`), Street Addresses & PO Boxes (`[ADDRESS_REDACTED]`), IPv4 addresses (`[IP_REDACTED]`), API Tokens (`[TOKEN_REDACTED]`), and Passwords (`[SECRET_REDACTED]`).
  - Correctly tested in `packages/extension/src/utils/__tests__/pii-scrubber.test.ts`.
- **Server-Side PII Scrubbing Absent in NestJS API (`packages/api/src/drafts/drafts.service.ts:138-146`)**:
  ```typescript
  await this.supabase.getClient()
    .from('draft_history')
    .insert({
      team_id: teamId,
      user_id: user.id,
      thread_snippet: dto.threadContent.substring(0, 100),
      generated_draft: draft,
      macro_used_id: macroId,
    });
  ```
  Unscrubbed customer support text is stored in `draft_history.thread_snippet` and dispatched to upstream AI models (`ai-provider.service.ts`).
- **Server-Side PII Scrubbing Absent in Next.js Route (`packages/web/src/app/api/drafts/generate/route.ts:275, 368-375`)**:
  ```typescript
  const userPrompt = `Customer Message:\n${threadContent}\n\n${knowledgeContext}${agentGuidanceContext}Write the clean, direct customer email reply now:`;
  ...
  await supabaseAdmin.from('draft_history').insert({
    team_id: teamId,
    user_id: user.id,
    thread_snippet: (threadContent || '').slice(0, 200),
    generated_draft: draftText,
    macro_used_id: matchedMacro?.id || null,
  });
  ```
  Direct API callers or web dashboard requests bypass extension-level scrubbing, storing raw PII in `draft_history` and sending raw PII to OpenRouter.

---

## 2. Logic Chain

1. **Secret Isolation Logic**:
   - `SUPABASE_SERVICE_ROLE_KEY` is kept on server environments (`packages/api` and `packages/web/src/lib/admin-auth.ts`). Client bundles and extension files only possess the `anon` key.
   - However, client-side exposure of third-party AI keys in `localStorage` in `AdminAIConfig.tsx` and hardcoded admin bypass passkeys in `admin-auth.ts` / `AdminGuard.tsx` undermine secrets isolation.
2. **Database Security & RLS Logic**:
   - RLS is enabled on all tables in `001_initial_schema.sql`, `002_auth_onboarding.sql`, `003_strict_rls_security.sql`, and `004_platform_settings.sql`.
   - `005_secure_platform_settings.sql` successfully restricts `platform_settings` to `service_role`.
   - However, the `users` table UPDATE policy allows updating `team_id` and `role`. Because tenant isolation policies in `macros`, `knowledge_documents`, `document_chunks`, `draft_history`, and `onboarding_state` all rely on `users.team_id`, an attacker updating their own `team_id` breaks workspace isolation across the entire database.
   - The unauthenticated webhook endpoint in `BillingController` allows arbitrary manipulation of team plans without cryptographic verification from Stripe.
3. **PII Storage & Logging Logic**:
   - PII scrubbing exists in the extension (`pii-scrubber.ts`), but defense-in-depth requires server-side validation.
   - Both `packages/api/src/drafts/drafts.service.ts` and `packages/web/src/app/api/drafts/generate/route.ts` lack server-side PII scrubbing before storing snippets in `draft_history` and before dispatching prompts to LLM providers.

---

## 3. Caveats

- In test/mock environments where Supabase is disconnected, routes utilize in-memory fallbacks or resilient stub clients.
- The RPC function `match_document_chunks` executes under `SECURITY INVOKER` by default in Postgres, meaning table-level RLS on `document_chunks` applies; however, adding explicit `team_id` verification inside the RPC function is recommended.
- No other databases (e.g. MongoDB, Redis) are configured; all persistence relies on PostgreSQL via Supabase.

---

## 4. Conclusion

Requirement R2 contains critical security strengths (proper separation of `SUPABASE_SERVICE_ROLE_KEY`, strict RLS on `platform_settings` via migration 005, and client-side PII scrubbing in the extension), but has 5 distinct vulnerabilities that require remediation:

| Vulnerability ID | Description | Severity | Target File(s) |
|---|---|---|---|
| **VULN-R2-01** | `users` table RLS allows authenticated users to update `team_id` and `role`, enabling cross-tenant workspace takeover. | **CRITICAL** | `packages/api/supabase/migrations/003_strict_rls_security.sql` |
| **VULN-R2-02** | Insecure Stripe webhook in `billing.controller.ts` lacks signature verification, allowing unauthorized plan/quota modification. | **CRITICAL** | `packages/api/src/billing/billing.controller.ts`, `billing.service.ts` |
| **VULN-R2-03** | Server-side PII scrubbing missing in `packages/api` and Next.js `generate/route.ts` before `draft_history` database insert and LLM prompt dispatch. | **HIGH** | `packages/api/src/drafts/drafts.service.ts`, `packages/web/src/app/api/drafts/generate/route.ts` |
| **VULN-R2-04** | Plaintext AI API keys stored in browser `localStorage` in `AdminAIConfig.tsx` and hardcoded bypass passkeys in `admin-auth.ts`. | **HIGH** | `packages/web/src/components/admin/AdminAIConfig.tsx`, `packages/web/src/lib/admin-auth.ts` |
| **VULN-R2-05** | `teams` table RLS INSERT policy allows inserting arbitrary plans and limits directly from client. | **MEDIUM** | `packages/api/supabase/migrations/003_strict_rls_security.sql` |

### Recommended Code-Level Fixes:

#### Fix 1: Hardened RLS Policy for `users` and `teams` in Supabase Migration
```sql
-- Migration 006_harden_user_tenant_rls.sql
-- 1. Prevent users from updating team_id or role
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() 
    AND team_id = (SELECT team_id FROM users WHERE id = auth.uid())
    AND role = (SELECT role FROM users WHERE id = auth.uid())
  );

-- 2. Restrict team creation defaults on client insert
DROP POLICY IF EXISTS "Users can insert team" ON teams;
CREATE POLICY "Users can insert team" ON teams
  FOR INSERT TO authenticated
  WITH CHECK (
    plan = 'free' 
    AND monthly_draft_limit = 50 
    AND stripe_customer_id IS NULL 
    AND stripe_subscription_id IS NULL
  );
```

#### Fix 2: Server-Side PII Scrubbing Layer
Share or replicate `scrubPII` in `packages/api/src/utils/pii-scrubber.ts` and `packages/web/src/lib/pii-scrubber.ts`.
In `packages/api/src/drafts/drafts.service.ts`:
```typescript
const scrubbedContent = scrubPII(dto.threadContent || '');
// Use scrubbedContent for prompt building and draft_history:
thread_snippet: scrubbedContent.substring(0, 100),
generated_draft: scrubPII(draft),
```
In `packages/web/src/app/api/drafts/generate/route.ts`:
```typescript
const scrubbedContent = scrubPII(threadContent || '');
// Use scrubbedContent for userPrompt and draft_history:
thread_snippet: scrubbedContent.slice(0, 200),
generated_draft: scrubPII(draftText),
```

#### Fix 3: Stripe Webhook Signature Verification
In `packages/api/src/billing/billing.controller.ts`:
```typescript
@Post('webhook')
async handleWebhook(
  @Headers('stripe-signature') signature: string,
  @Req() request: RawBodyRequest<Request>,
) {
  if (!signature) throw new BadRequestException('Missing stripe-signature header');
  return await this.billingService.handleWebhook(request.rawBody, signature);
}
```

---

## 5. Verification Method

To independently verify all findings and validate fixes:
1. **Run Unit & Integration Test Suites**:
   ```bash
   export HOME="/home/md-roni-ahamed/Test project/.tmp_home"
   export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
   pnpm test
   ```
2. **Verify Client-Side Bundle Secret Cleanliness**:
   ```bash
   grep -rn "SUPABASE_SERVICE_ROLE_KEY" packages/extension/ packages/web/src/components/
   ```
   *Expected: Zero occurrences in extension or client components.*
3. **Verify RLS Migration Policies**:
   Inspect `packages/api/supabase/migrations/003_strict_rls_security.sql` and `005_secure_platform_settings.sql` to confirm table policies.
4. **Verify PII Redaction Suite**:
   ```bash
   node --experimental-strip-types --test packages/extension/src/utils/__tests__/pii-scrubber.test.ts
   ```
