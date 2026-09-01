# Full-Stack Security Audit & Hardening Report: Requirement R1

**Audit Target**: Requirement R1 — Authentication, Authorization & Admin Endpoint Hardening across DraftPilot
**Scope**: Next.js (`packages/web`), NestJS API (`packages/api`), Chrome Extension (`packages/extension`), Supabase DB access layers.
**Investigator**: Explorer Subagent (Security Auditor)

---

## Executive Summary

A comprehensive, full-stack security investigation was conducted across the DraftPilot codebase targeting administrative authorization, passkey/session token validation, rate limiting, CORS configuration, Content Security Policy (CSP), and HTTP security headers. 

A total of **10 actionable vulnerabilities** were identified across 3 audit dimensions:
- **3 Critical Severity (P0)**: Hardcoded plaintext master passkeys baked into client-side bundles and server auth guards; unauthenticated Stripe webhook endpoint without signature verification; and complete bypass of monthly draft quotas in Next.js `/api/drafts/generate`.
- **3 High Severity (P1)**: Admin login gate passkey omission bypass; unvalidated admin configuration payload ingestion; and permissive CSP containing `unsafe-eval` and `unsafe-inline`.
- **4 Medium Severity (P2)**: Overly permissive CORS regex accepting any Chrome extension; missing NestJS Helmet headers; unauthenticated Swagger UI in production; and memory leak / missing eviction in in-memory sliding-window rate limiters.

---

## 1. Observation

### Dimension 1: Super Admin Routes, Passkey & Session Token Authorization

#### Observation 1.1: Hardcoded Master Passkey Backdoors in Client & Server
- **File**: `packages/web/src/lib/admin-auth.ts`, lines 33–44
```typescript
  // 1. Check direct admin passkey header
  const passkey = req.headers.get('x-admin-passkey')?.trim();
  const configuredPasskey = process.env.NEXT_PUBLIC_ADMIN_PASSKEY?.trim();
  if (
    passkey &&
    (passkey === 'draftpilot-root-2026' ||
      passkey === 'admin2026' ||
      passkey === 'root' ||
      (configuredPasskey && passkey === configuredPasskey))
  ) {
    return { authorized: true };
  }
```
- **File**: `packages/web/src/components/admin/AdminGuard.tsx`, lines 16–17, 58–66, 123–127
```typescript
const ADMIN_MASTER_PASSKEY = process.env.NEXT_PUBLIC_ADMIN_PASSKEY || 'draftpilot-root-2026';
...
if (
  passkeyClean &&
  (passkeyClean === ADMIN_MASTER_PASSKEY ||
    passkeyClean === 'draftpilot-root-2026' ||
    passkeyClean === 'admin2026' ||
    passkeyClean === 'root')
) {
  sessionStorage.setItem('draftpilot_admin_unlocked', 'true');
  setIsAdminUnlocked(true);
  return;
}
```
- **File**: `packages/web/src/app/admin/login/page.tsx`, lines 14, 40
```typescript
const ADMIN_MASTER_PASSKEY = process.env.NEXT_PUBLIC_ADMIN_PASSKEY || 'draftpilot-root-2026';
...
if (passkey && passkey.trim() !== ADMIN_MASTER_PASSKEY && passkey.trim() !== 'admin2026') {
  throw new Error('Invalid Superadmin Master Passkey.');
}
```
- **Files**: All admin UI components hardcode the passkey in network requests:
  - `packages/web/src/components/admin/AdminAIConfig.tsx` (lines 129, 316)
  - `packages/web/src/components/admin/AdminBillingAnalytics.tsx` (lines 64, 196)
  - `packages/web/src/components/admin/AdminFeatureFlags.tsx` (line 91)
  - `packages/web/src/components/admin/AdminGlobalMacros.tsx` (line 79)
  - `packages/web/src/components/admin/AdminOverview.tsx` (line 39)
  - `packages/web/src/components/admin/AdminWorkspaces.tsx` (lines 40, 151, 191)
```typescript
const headers: Record<string, string> = {
  'x-admin-passkey': 'draftpilot-root-2026',
};
```

#### Observation 1.2: Passkey Omission Bypass on Admin Login Page
- **File**: `packages/web/src/app/admin/login/page.tsx`, lines 40–42
```typescript
if (passkey && passkey.trim() !== ADMIN_MASTER_PASSKEY && passkey.trim() !== 'admin2026') {
  throw new Error('Invalid Superadmin Master Passkey.');
}
```
If `passkey` is an empty string (`""`), `if (passkey && ...)` evaluates to `false`. Any user credentials matching `DEFAULT_ADMIN_EMAILS` logs in without entering a passkey.

#### Observation 1.3: Hardcoded Superadmin Email Lists in Source Code
- **File**: `packages/web/src/lib/admin-auth.ts`, lines 82–85
```typescript
const superadminEmails = (process.env.SUPERADMIN_EMAILS || 'mdronykhan4633@gmail.com,mdronykhan4632@gmail.com,admin@draftpilot.app,admin@draftpilot.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
```

#### Observation 1.4: Unauthenticated Stripe Webhook in NestJS API
- **File**: `packages/api/src/billing/billing.controller.ts`, lines 41–44
- **File**: `packages/api/src/billing/billing.service.ts`, lines 107–152
```typescript
@Post('webhook')
async handleWebhook(@Body() body: any) {
  return await this.billingService.handleWebhook(body);
}
```
`handleWebhook` parses raw untrusted JSON without verifying Stripe's cryptographic webhook signature (`stripe.webhooks.constructEvent(rawBody, signature, endpointSecret)`).

#### Observation 1.5: Unsanitized Admin Upsert Payloads
- **File**: `packages/web/src/app/api/admin/ai-config/route.ts`, lines 36–41
```typescript
const body = await req.json();
const { data, error } = await supabaseAdmin
  .from('platform_settings')
  .upsert({ ...body, updated_at: new Date().toISOString() })
  .select()
  .single();
```
No validation schema (Zod/Yup) checks incoming JSON properties before upserting directly into `platform_settings`.

---

### Dimension 2: Rate Limiting & Quota Enforcement

#### Observation 2.1: Missing Plan Quota Enforcement in Next.js `/api/drafts/generate`
- **File**: `packages/web/src/app/api/drafts/generate/route.ts`, lines 193–388
Compare with:
- **File**: `packages/api/src/drafts/drafts.service.ts`, lines 51–54, 135:
```typescript
// NestJS enforces monthly limits and increments usage:
const isWithinLimit = await this.billing.checkLimit(teamId);
if (!isWithinLimit) throw new HttpException('Usage limit exceeded...', HttpStatus.TOO_MANY_REQUESTS);
...
await this.billing.incrementUsage(teamId);
```
In contrast, `packages/web/src/app/api/drafts/generate/route.ts` NEVER checks `checkLimit(teamId)` and NEVER increments monthly draft counters in the `usage` table.

#### Observation 2.2: Memory Leak in Next.js In-Memory Sliding-Window Limiter
- **File**: `packages/web/src/app/api/drafts/generate/route.ts`, line 191:
```typescript
const userRequestTimestamps = new Map<string, number[]>();
```
The Map keys (`user.id`) are never evicted or garbage-collected for inactive users.

#### Observation 2.3: Absence of Fine-Grained Rate Limits on Auth Endpoints
- **File**: `packages/api/src/app.module.ts`, lines 16–21:
```typescript
ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }])
```
All routes share a generic 20 req/min bucket. Sensitive endpoints (`/auth/login`, `/auth/register`, `/auth/provision`) do not enforce stricter per-IP brute-force limits.

---

### Dimension 3: CORS, CSP, Helmet & Security Headers

#### Observation 3.1: Permissive Content Security Policy (CSP)
- **File**: `packages/web/next.config.js`, lines 33–35:
```javascript
{
  key: 'Content-Security-Policy',
  value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://amjliubpbysvtiqpbgnh.supabase.co wss://amjliubpbysvtiqpbgnh.supabase.co https://openrouter.ai https://api.openrouter.ai https://va.vercel-scripts.com;",
}
```
`script-src` includes `'unsafe-eval'` and `'unsafe-inline'`. Missing `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, and HSTS headers.

#### Observation 3.2: Complete Omission of Helmet in NestJS API
- **File**: `packages/api/src/main.ts`, lines 1–66:
No `helmet()` middleware is imported or registered in the NestJS application.

#### Observation 3.3: Overly Permissive CORS Regex for Chrome Extensions
- **File**: `packages/api/src/main.ts`, line 14:
```typescript
const allowedOrigins: (string | RegExp)[] = [
  'https://draftpilot-web.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  /^chrome-extension:\/\/[a-z]{32}$/,
];
```
Matches any installed 32-character Chrome extension rather than pinning the official extension ID.

#### Observation 3.4: Unauthenticated Public Swagger API Documentation
- **File**: `packages/api/src/main.ts`, lines 54–61:
```typescript
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```
Swagger UI is initialized globally in all environments without production gating or authentication.

---

## 2. Logic Chain

1. **Passkey Exposure & Route Compromise**:
   - Environment variables prefixed with `NEXT_PUBLIC_` are inlined into JavaScript assets during `next build`.
   - `packages/web/src/components/admin/AdminAIConfig.tsx` and 5 other admin components hardcode `'x-admin-passkey': 'draftpilot-root-2026'`.
   - When `verifySuperAdmin` runs, it checks `passkey === 'draftpilot-root-2026' || passkey === 'admin2026' || passkey === 'root'`.
   - **Inference**: Any anonymous user inspecting the client JavaScript or network traffic can extract the passkey and gain full unauthenticated administrative access to `/api/admin/*` routes.

2. **Stripe Webhook Forgery**:
   - `packages/api/src/billing/billing.controller.ts` exposes `@Post('webhook')` without `@UseGuards` or Stripe signature validation.
   - `BillingService.handleWebhook` directly reads `event.type` and `session.client_reference_id` from the parsed body and performs `update({ plan: 'team', monthly_draft_limit: 1000 })`.
   - **Inference**: An attacker can send an unauthenticated HTTP POST with a forged JSON body to elevate any workspace to a paid tier.

3. **Quota Bypass Vulnerability**:
   - The Chrome Extension and Web clients invoke `POST https://draftpilot-web.vercel.app/api/drafts/generate`.
   - `packages/web/src/app/api/drafts/generate/route.ts` generates LLM completions via OpenRouter but lacks quota checking and database usage increments.
   - **Inference**: Free-tier users can execute unbounded draft generations, bypassing monthly plan limits and causing severe financial impact via upstream LLM billing.

4. **XSS & Injection Risks from Weak CSP**:
   - `next.config.js` configures CSP with `'unsafe-eval'` and `'unsafe-inline'`.
   - If an XSS vulnerability exists in rich text or email rendering, the browser will not block script execution or eval payloads.

---

## 3. Caveats

1. **Test Suite Execution**: Unit test suites (`admin-auth.test.ts`, `ai-pipeline.test.ts`, `challenger-interactive.test.ts`) currently expect `'draftpilot-root-2026'` and `'admin2026'` as valid test fixtures. Remediation must update both implementation and test fixtures synchronously to preserve green build states.
2. **Local vs Production Passkeys**: In local development environments where Supabase OAuth credentials are not fully populated, a secure server-side development secret mechanism (e.g. `process.env.ADMIN_SECRET_KEY` evaluated strictly server-side) can be supported, but client-side baking (`NEXT_PUBLIC_`) and hardcoded fallback strings (`'root'`, `'admin2026'`) must be eliminated.
3. **Stripe Webhook Signing Secret**: In development mode with dummy keys, raw body signature verification should handle development bypass when `STRIPE_WEBHOOK_SECRET` is unset, but must strictly verify signatures when configured.

---

## 4. Conclusion & Recommended Code-Level Fixes

### Vulnerability Summary Table

| ID | Finding | Severity | CVSS v3.1 | Affected Component |
|---|---|---|---|---|
| **VULN-01** | Hardcoded Plaintext Master Passkeys in Client Bundles & Server Guard | **CRITICAL** | 9.8 | `admin-auth.ts`, `AdminGuard.tsx`, `Admin*.tsx` |
| **VULN-02** | Unauthenticated Stripe Webhook Handler (Missing Signature Validation) | **CRITICAL** | 9.1 | `billing.controller.ts`, `billing.service.ts` |
| **VULN-03** | Missing Plan Quota Enforcement & Usage Tracking in Next.js Draft Generator | **CRITICAL** | 8.2 | `api/drafts/generate/route.ts` |
| **VULN-04** | Admin Login Page Passkey Omission Bypass | **HIGH** | 7.5 | `admin/login/page.tsx` |
| **VULN-05** | Permissive CSP with `'unsafe-eval'` & `'unsafe-inline'` | **HIGH** | 7.4 | `next.config.js` |
| **VULN-06** | Unvalidated Admin Configuration Ingestion (`platform_settings`) | **HIGH** | 7.2 | `api/admin/ai-config/route.ts` |
| **VULN-07** | Hardcoded Superadmin Email Lists in Client & Server Code | **MEDIUM** | 6.5 | `admin-auth.ts`, `AdminGuard.tsx` |
| **VULN-08** | Missing NestJS Helmet HTTP Security Headers | **MEDIUM** | 5.8 | `packages/api/src/main.ts` |
| **VULN-09** | Overly Permissive Extension CORS Pattern in NestJS API | **MEDIUM** | 5.5 | `packages/api/src/main.ts` |
| **VULN-10** | Unbounded In-Memory Map in Next.js Rate Limiter (Memory Leak) | **LOW** | 4.3 | `api/drafts/generate/route.ts` |

---

### Detailed Code-Level Remediation Recommendations

#### Fix 1: Eliminate Hardcoded Passkeys & Secure Server-Side Passkey Guard (`admin-auth.ts`)
- **Action**: Remove hardcoded string literals (`'draftpilot-root-2026'`, `'admin2026'`, `'root'`). Remove `NEXT_PUBLIC_ADMIN_PASSKEY` from client exposure; use server-side `ADMIN_PASSKEY` or `SUPERADMIN_SECRET` only. Enforce cryptographic constant-time comparison.
- **Proposed Code**:
```typescript
import crypto from 'crypto';

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function verifySuperAdmin(req: Request): Promise<AdminAuthResult> {
  // 1. Check direct server-only admin passkey header (if configured)
  const passkey = req.headers.get('x-admin-passkey')?.trim();
  const configuredPasskey = process.env.ADMIN_PASSKEY || process.env.SUPERADMIN_PASSKEY;
  if (passkey && configuredPasskey && secureCompare(passkey, configuredPasskey)) {
    return { authorized: true };
  }

  // 2. Fall back to standard Supabase JWT Bearer token validation
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      response: Response.json({ error: 'Unauthorized: Missing or invalid Authorization header' }, { status: 401 }),
    };
  }
  ...
}
```

#### Fix 2: Remove Hardcoded Passkey Headers from Client Components
- **Action**: In `AdminAIConfig.tsx`, `AdminWorkspaces.tsx`, `AdminBillingAnalytics.tsx`, `AdminFeatureFlags.tsx`, `AdminGlobalMacros.tsx`, `AdminOverview.tsx`:
- **Change**: Pass `Authorization: Bearer <token>` from active session instead of static `'x-admin-passkey': 'draftpilot-root-2026'`.

#### Fix 3: Implement Stripe Webhook Signature Verification in NestJS
- **Action**: Use `rawBody` and `stripe.webhooks.constructEvent`.
- **Proposed Code**:
```typescript
@Post('webhook')
async handleWebhook(
  @Req() req: RawBodyRequest<Request>,
  @Headers('stripe-signature') signature: string,
) {
  const endpointSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
  let event: Stripe.Event;

  if (endpointSecret && signature && req.rawBody) {
    try {
      event = this.stripe.webhooks.constructEvent(req.rawBody, signature, endpointSecret);
    } catch (err: any) {
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new BadRequestException('Missing webhook signature or secret');
  } else {
    event = req.body;
  }

  return await this.billingService.handleWebhook(event);
}
```

#### Fix 4: Enforce Monthly Quotas in Next.js `/api/drafts/generate`
- **Action**: Add quota limit check and usage incrementing to `packages/web/src/app/api/drafts/generate/route.ts`:
- **Proposed Code**:
```typescript
// Check monthly limit
const month = new Date().toISOString().slice(0, 7) + '-01';
const { data: team } = await supabaseAdmin.from('teams').select('plan, monthly_draft_limit').eq('id', teamId).single();
const { data: usage } = await supabaseAdmin.from('usage').select('draft_count').eq('team_id', teamId).eq('month', month).single();

const used = usage?.draft_count || 0;
const limit = team?.monthly_draft_limit || (team?.plan === 'team' ? 1000 : 50);
if (used >= limit) {
  return NextResponse.json({ error: 'Monthly draft limit reached for this workspace. Please upgrade plan.' }, { status: 429 });
}

// After generation: increment usage
if (usage) {
  await supabaseAdmin.from('usage').update({ draft_count: used + 1 }).eq('id', usage.id);
} else {
  await supabaseAdmin.from('usage').insert({ team_id: teamId, month, draft_count: 1 });
}
```

#### Fix 5: Strengthen Content Security Policy & HTTP Headers in `next.config.js`
- **Proposed Code**:
```javascript
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://openrouter.ai https://api.openrouter.ai https://va.vercel-scripts.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
        },
      ],
    },
  ];
}
```

#### Fix 6: Integrate Helmet and Pin Extension CORS in NestJS `main.ts`
- **Proposed Code**:
```typescript
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  
  app.use(helmet());

  const allowedOrigins: (string | RegExp)[] = [
    'https://draftpilot-web.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  if (process.env.EXTENSION_ID) {
    allowedOrigins.push(`chrome-extension://${process.env.EXTENSION_ID}`);
  }
  ...
}
```

---

## 5. Verification Method

### Test Execution Commands
Run the automated test suites using the project's pnpm runner:
```bash
export HOME="/home/md-roni-ahamed/Test project/.tmp_home"
export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"

# Run all unit tests
pnpm test

# Build production bundles
pnpm --filter @draftpilot/web build
pnpm --filter @draftpilot/api build
pnpm --filter @draftpilot/extension build
```

### Manual Inspection & Invalidation Conditions
1. **Passkey Inspection**: Verify that searching `draftpilot-root-2026`, `admin2026`, or `NEXT_PUBLIC_ADMIN_PASSKEY` returns zero occurrences in `packages/web/src/components/` and production `.next/static` bundles.
2. **Admin API Guard**: Send `curl -i http://localhost:3000/api/admin/metrics` with no headers → Must receive `HTTP 401 Unauthorized`.
3. **Stripe Webhook**: Send `curl -X POST http://localhost:3001/billing/webhook -d '{"type":"checkout.session.completed"}'` without signature header → Must receive `HTTP 400/401 BadRequestException`.
4. **Draft Quota**: Send 51st generation request for free-tier workspace → Must return `HTTP 429 Too Many Requests`.
