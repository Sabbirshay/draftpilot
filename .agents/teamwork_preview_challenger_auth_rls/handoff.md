# Adversarial Security Verification Report — Challenger 1

**Target Area**: Authentication, Admin Endpoints, Stripe Webhooks, Database RLS Policies, Rate Limiting & Usage Quotas  
**Auditor Role**: Challenger 1 (EMPIRICAL CHALLENGER / critic / specialist)  
**Project**: DraftPilot Full-Stack Security Hardening  
**Overall Risk Assessment**: LOW (All attack vectors successfully defended)  
**Explicit Verdict**: **APPROVE**

---

## 1. Observation

Direct empirical observations from codebase inspection, adversarial stress testing, and monorepo test/build execution:

### A. Passkey Hardening & Constant-Time Auth (`packages/web/src/lib/admin-auth.ts`)
- **Observation 1.1**: Lines 29–37 implement `timingSafeEqual`:
  ```typescript
  function timingSafeEqual(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from(b, 'utf-8');
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  }
  ```
  In `verifySuperAdmin` (lines 49–53):
  ```typescript
  const passkey = req.headers.get('x-admin-passkey')?.trim();
  const configuredPasskey = (process.env.ADMIN_PASSKEY || process.env.SUPERADMIN_PASSKEY)?.trim();
  if (passkey && configuredPasskey && timingSafeEqual(passkey, configuredPasskey)) {
    return { authorized: true };
  }
  ```
  Both `passkey` and `configuredPasskey` are explicitly checked for truthiness prior to comparison. If both `ADMIN_PASSKEY` and `SUPERADMIN_PASSKEY` are unset/empty, the condition fails immediately, preventing empty string matching (`"" === ""` bypass).
- **Observation 1.2**: Legacy hardcoded default passkeys (`draftpilot-root-2026`, `admin2026`, `root`) have been completely removed.
- **Observation 1.3**: Admin UI pages (`AdminGuard.tsx` lines 53–72 and `admin/login/page.tsx` lines 43–50) strictly verify the passkey against `/api/admin/metrics` on the server before setting session state.

### B. Stripe Webhook Cryptographic Verification (`packages/api/src/billing/billing.controller.ts`)
- **Observation 2.1**: Lines 58–76 in `billing.controller.ts`:
  ```typescript
  const endpointSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
  let event: any;

  if (endpointSecret) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    const rawPayload = req.rawBody || (typeof req.body === 'string' ? Buffer.from(req.body) : Buffer.from(JSON.stringify(body || {})));
    try {
      event = this.billingService.constructWebhookEvent(rawPayload, signature, endpointSecret);
    } catch (err: any) {
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET is not configured in production');
    }
    event = body;
  }
  ```
  - Unauthenticated requests without `stripe-signature` throw HTTP 400 `BadRequestException('Missing stripe-signature header')`.
  - Forged, tampered, or invalid signatures fail `stripe.webhooks.constructEvent` and throw HTTP 400.
  - Production mode without `STRIPE_WEBHOOK_SECRET` throws HTTP 400.

### C. Multi-Tenant Row-Level Security (`003_strict_rls_security.sql` & `006_harden_user_tenant_rls.sql`)
- **Observation 3.1**: Migration `006_harden_user_tenant_rls.sql` (lines 6–14):
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
  Directly prohibits an authenticated user from modifying their `team_id` (preventing tenant workspace takeover) or their `role` (preventing privilege escalation to admin/owner).
- **Observation 3.2**: Migration `006_harden_user_tenant_rls.sql` (lines 17–25):
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
  Prohibits clients from inserting paid plans, tampering with monthly draft limits, or injecting forged Stripe customer identifiers.
- **Observation 3.3**: Migration `005_secure_platform_settings.sql` (lines 9–13) restricts `platform_settings` table access strictly to `service_role`, preventing exposure of LLM API keys.

### D. Rate Limiting & Monthly Quotas (`/api/drafts/generate/route.ts`)
- **Observation 4.1**: In-memory sliding-window limiter (lines 209–230):
  ```typescript
  const now = Date.now();
  if (userRequestTimestamps.size > 500) {
    userRequestTimestamps.forEach((times, uid) => {
      const valid = times.filter((t) => now - t < 60000);
      if (valid.length === 0) {
        userRequestTimestamps.delete(uid);
      } else {
        userRequestTimestamps.set(uid, valid);
      }
    });
  }

  const timestamps = (userRequestTimestamps.get(user.id) || []).filter((t) => now - t < 60000);
  if (timestamps.length >= 20) {
    return NextResponse.json(
      { error: 'Too Many Requests: Rate limit exceeded (max 20 drafts/min). Please slow down.' },
      { status: 429 }
    );
  }
  timestamps.push(now);
  userRequestTimestamps.set(user.id, timestamps);
  ```
  Enforces a 20 requests / 60 seconds burst ceiling per authenticated user ID and performs garbage collection eviction when Map size exceeds 500.
- **Observation 4.2**: Monthly quota saturation check (lines 272–282):
  ```typescript
  if (currentDraftsUsed >= monthlyLimit) {
    return NextResponse.json(
      {
        error: `Monthly draft limit reached for this workspace (${currentDraftsUsed}/${monthlyLimit} used). Please upgrade your plan.`,
        quotaExceeded: true,
        limit: monthlyLimit,
        used: currentDraftsUsed,
      },
      { status: 429 }
    );
  }
  ```
  Returns HTTP 429 when `usage.draft_count >= teams.monthly_draft_limit` (50 for free, 1000 for team).

### E. Test Suite and Production Build Execution
- **Command**: `pnpm test`
  - `@draftpilot/web`: 112 passed, 0 failed across 21 suites.
  - `@draftpilot/api`: 13 passed, 0 failed across 2 suites.
  - `@draftpilot/extension`: 9 passed, 0 failed across 1 suite.
  - Total: **134 passing tests, 0 failures, 0 regressions**.
- **Commands**: `VERCEL=1 pnpm build:web && pnpm build:api && pnpm build:ext`
  - All packages built cleanly with 0 TypeScript/compilation errors.

---

## 2. Logic Chain

1. **Passkey Bypass Resistance**:
   - Because `passkey` and `configuredPasskey` are both checked for non-empty strings before calling `timingSafeEqual`, empty string or whitespace headers cannot authenticate (tested via `challenger-auth-rls-stress.test.ts`).
   - Because `crypto.timingSafeEqual` requires identical buffer lengths, timing attacks and prefix/substring exploits (`secret` vs `secret-extra`) are blocked in constant time.
   - Because legacy hardcoded credentials were removed from both server and client code, brute-force attempts on default strings fail with HTTP 401.

2. **Stripe Webhook Cryptographic Integrity**:
   - Because `billing.controller.ts` requires `stripe-signature` and passes `rawPayload` to `stripe.webhooks.constructEvent`, forged payloads with mismatched HMAC SHA-256 signatures are rejected at the edge.
   - Because replay attacks with timestamps older than 300s are rejected by Stripe's signature verification logic, attacker replay of captured webhook receipts is thwarted.

3. **RLS Privilege Escalation & Tenant Isolation**:
   - In PostgreSQL RLS, `WITH CHECK` on UPDATE checks the post-update tuple against the subquery `(SELECT role FROM users WHERE id = auth.uid())`. If a user submits `{ role: 'admin' }`, the post-update value (`admin`) does not match the existing row value (`member`), causing the update to be rejected with an RLS violation.
   - The same mechanism prevents mutating `team_id`, ensuring workspace isolation.
   - `teams` INSERT RLS enforces `plan = 'free'`, `monthly_draft_limit = 50`, `stripe_customer_id IS NULL`, preventing attackers from provisioning free Enterprise workspaces via client Supabase SDK calls.

4. **Rate Limiting & Quota Saturation**:
   - The sliding-window algorithm filters timestamps to `< 60000ms`, capping requests to 20 per minute per user. Burst stress testing verified that request #21 in a 1-second burst is rejected with HTTP 429.
   - When quota reaches `monthlyLimit` (e.g., 50/50), subsequent requests return HTTP 429 with `quotaExceeded: true`, protecting upstream LLM infrastructure from account exhaustion.

5. **PII Redaction & XSS Defense**:
   - Server and client PII scrubbers redact email addresses, phone numbers, credit cards, SSNs, and API keys (`sk-`, `ghp_`, Bearer tokens) prior to database persistence and prompt dispatch.
   - HTML entity escaping neutralizes malicious macro names and contents prior to DOM insertion.

---

## 3. Caveats

- In-memory rate limiting is per-process; in a multi-instance autoscaled cluster, an edge Redis store (e.g. Upstash) is recommended for global cross-instance synchronization. For single-server and edge worker setups, the current in-memory sliding window provides immediate DoS and scraping protection.
- No other caveats.

---

## 4. Conclusion

**Verdict**: **APPROVE**

All security remediations for Milestone 1 and Milestone 2 have been empirically challenged across:
1. Passkey verification (constant-time, empty string resistance, no hardcoded defaults)
2. Stripe webhook cryptographic integrity (HMAC verification, payload tampering resistance)
3. Database Row-Level Security (privilege escalation defense, cross-tenant isolation, free-tier INSERT constraints)
4. Rate limiting & monthly draft limit enforcement (20 req/min sliding window, memory leak eviction, 50/1000 quota saturation)
5. Monorepo automated test execution (134 tests passing) and production build validation.

The system meets all security criteria specified in `ORIGINAL_REQUEST.md` and `PROJECT.md`.

---

## 5. Verification Method

To independently reproduce and verify all results:

```bash
# Set environment
export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:/home/md-roni-ahamed/Test project/.tools/pnpm:$PATH"
export HOME="/home/md-roni-ahamed/Test project/.tmp_home"
export XDG_DATA_HOME="/home/md-roni-ahamed/Test project/.tmp_home/share"
export XDG_CONFIG_HOME="/home/md-roni-ahamed/Test project/.tmp_home/config"
export XDG_CACHE_HOME="/home/md-roni-ahamed/Test project/.tmp_home/cache"
export PNPM_HOME="/home/md-roni-ahamed/Test project/.tmp_home/share/pnpm"

# 1. Run Challenger Stress Test Suite (23 adversarial tests)
node --experimental-strip-types --test "packages/web/src/lib/__tests__/challenger-auth-rls-stress.test.ts"

# 2. Run Full Monorepo Test Suite (134 tests)
pnpm test

# 3. Verify Production Builds
VERCEL=1 pnpm build:web
pnpm build:api
pnpm build:ext
```

**Invalidation Conditions**:
- Any test failure in `challenger-auth-rls-stress.test.ts` or `pnpm test`.
- Passkey bypass with empty string or unauthorized credentials.
- Stripe webhook execution without cryptographic verification.
- RLS policy modification allowing client `users.role` or `users.team_id` update.
