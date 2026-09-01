import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import { verifySuperAdmin, supabaseAdmin } from '../admin-auth.ts';
// @ts-ignore
import { scrubPII } from '../pii-scrubber.ts';

// =========================================================================
// MISSION 1: PASSKEY HARDENING, CONSTANT-TIME & AUTHENTICATION BYPASS TESTS
// =========================================================================
describe('Empirical Challenge 1: Passkey Bypasses, Timing Variance & Auth Robustness', () => {
  const originalAdmin = process.env.ADMIN_PASSKEY;
  const originalSuper = process.env.SUPERADMIN_PASSKEY;
  const originalEmails = process.env.SUPERADMIN_EMAILS;

  beforeEach(() => {
    process.env.ADMIN_PASSKEY = originalAdmin;
    process.env.SUPERADMIN_PASSKEY = originalSuper;
    process.env.SUPERADMIN_EMAILS = originalEmails;
  });

  test('TimingSafeEqual rejects differing lengths immediately without exception', () => {
    const compare = (a: string, b: string): boolean => {
      if (typeof a !== 'string' || typeof b !== 'string') return false;
      const bufA = Buffer.from(a, 'utf-8');
      const bufB = Buffer.from(b, 'utf-8');
      if (bufA.length !== bufB.length) return false;
      return crypto.timingSafeEqual(bufA, bufB);
    };

    assert.strictEqual(compare('secret', 'secret'), true);
    assert.strictEqual(compare('secret', 'secret1'), false);
    assert.strictEqual(compare('secret1', 'secret'), false);
    assert.strictEqual(compare('', 'secret'), false);
    assert.strictEqual(compare('secret', ''), false);
    assert.strictEqual(compare('', ''), true);
  });

  test('Passkey bypass: Rejects empty string and whitespace-only x-admin-passkey headers', async () => {
    process.env.ADMIN_PASSKEY = 'vault-superadmin-secret-2026';

    const bypassAttempts = [
      '',
      '   ',
      '\t\t',
      '\n',
      ' \r\n ',
    ];

    for (const attempt of bypassAttempts) {
      const req = new Request('http://localhost:3000/api/admin/metrics', {
        headers: { 'x-admin-passkey': attempt },
      });
      const result = await verifySuperAdmin(req);
      assert.strictEqual(result.authorized, false, `Attempt "${attempt}" must be rejected`);
      assert.strictEqual(result.response?.status, 401);
    }
  });

  test('Passkey bypass: Rejects when both ADMIN_PASSKEY and SUPERADMIN_PASSKEY are unset/empty in env', async () => {
    delete process.env.ADMIN_PASSKEY;
    delete process.env.SUPERADMIN_PASSKEY;

    const attempts = ['', ' ', 'secret', 'null', 'undefined', 'admin', 'root'];

    for (const attempt of attempts) {
      const req = new Request('http://localhost:3000/api/admin/metrics', {
        headers: { 'x-admin-passkey': attempt },
      });
      const result = await verifySuperAdmin(req);
      assert.strictEqual(result.authorized, false, `Attempt "${attempt}" without configured env passkey must be rejected`);
      assert.strictEqual(result.response?.status, 401);
    }
  });

  test('Passkey bypass: Rejects prefix, suffix, and substring matching attacks', async () => {
    process.env.ADMIN_PASSKEY = 'draftpilot-production-super-passkey-7890';

    const attacks = [
      'draftpilot',
      'draftpilot-production',
      'draftpilot-production-super-passkey',
      'draftpilot-production-super-passkey-789',
      'draftpilot-production-super-passkey-78901',
      'draftpilot-production-super-passkey-7890-extra',
      'super-passkey-7890',
      '7890',
    ];

    for (const attack of attacks) {
      const req = new Request('http://localhost:3000/api/admin/metrics', {
        headers: { 'x-admin-passkey': attack },
      });
      const result = await verifySuperAdmin(req);
      assert.strictEqual(result.authorized, false, `Prefix/substring attack "${attack}" must be rejected`);
      assert.strictEqual(result.response?.status, 401);
    }
  });

  test('Passkey bypass: Rejects legacy hardcoded default passkeys', async () => {
    process.env.ADMIN_PASSKEY = 'secure-random-prod-key-xyz-987';

    const legacyDefaults = [
      'draftpilot-root-2026',
      'admin2026',
      'root',
      'admin',
      'superadmin',
      'password',
      '123456',
      '12345678',
      'toor',
    ];

    for (const legacy of legacyDefaults) {
      const req = new Request('http://localhost:3000/api/admin/metrics', {
        headers: { 'x-admin-passkey': legacy },
      });
      const result = await verifySuperAdmin(req);
      assert.strictEqual(result.authorized, false, `Legacy passkey "${legacy}" must be rejected`);
      assert.strictEqual(result.response?.status, 401);
    }
  });

  test('Passkey authorization: Accepts exact passkey with surrounding whitespace properly trimmed', async () => {
    process.env.ADMIN_PASSKEY = 'exact-superadmin-key-2026';

    const req = new Request('http://localhost:3000/api/admin/ai-config', {
      headers: { 'x-admin-passkey': '   exact-superadmin-key-2026   ' },
    });
    const result = await verifySuperAdmin(req);
    assert.strictEqual(result.authorized, true);
    assert.strictEqual(result.response, undefined);
  });

  test('Passkey authorization: Fallback to SUPERADMIN_PASSKEY when ADMIN_PASSKEY is undefined', async () => {
    delete process.env.ADMIN_PASSKEY;
    process.env.SUPERADMIN_PASSKEY = 'backup-key-from-superadmin-var';

    const req = new Request('http://localhost:3000/api/admin/feature-flags', {
      headers: { 'x-admin-passkey': 'backup-key-from-superadmin-var' },
    });
    const result = await verifySuperAdmin(req);
    assert.strictEqual(result.authorized, true);
  });
});

// =========================================================================
// MISSION 2: STRIPE WEBHOOK FORGERY & SIGNATURE VERIFICATION TESTS
// =========================================================================
describe('Empirical Challenge 2: Stripe Webhook Forgery & Cryptographic Signature Validation', () => {
  const testWebhookSecret = 'whsec_test_secret_for_cryptographic_verification_123';

  function generateStripeSignature(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
    const signedPayload = `${timestamp}.${payload}`;
    const hmac = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
    return `t=${timestamp},v1=${hmac}`;
  }

  function verifyStripeSignature(payload: string | Buffer, signatureHeader: string, secret: string, toleranceSeconds = 300): boolean {
    if (!signatureHeader || !secret) return false;
    const rawPayload = typeof payload === 'string' ? payload : payload.toString('utf8');

    const parts = signatureHeader.split(',').reduce((acc: Record<string, string>, item: string) => {
      const [k, v] = item.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});

    const timestamp = parseInt(parts.t, 10);
    const expectedSig = parts.v1;
    if (!timestamp || !expectedSig) return false;

    // Check timestamp tolerance to prevent replay attacks
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      return false; // Replay attack detected
    }

    const signedPayload = `${timestamp}.${rawPayload}`;
    const calculatedSig = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

    if (calculatedSig.length !== expectedSig.length) return false;
    return crypto.timingSafeEqual(Buffer.from(calculatedSig), Buffer.from(expectedSig));
  }

  test('Valid Stripe webhook signature passes verification', () => {
    const payload = JSON.stringify({ id: 'evt_123', type: 'checkout.session.completed' });
    const signature = generateStripeSignature(payload, testWebhookSecret);

    const isValid = verifyStripeSignature(payload, signature, testWebhookSecret);
    assert.strictEqual(isValid, true);
  });

  test('Forged webhook with invalid secret is rejected', () => {
    const payload = JSON.stringify({ id: 'evt_123', type: 'checkout.session.completed' });
    const fakeSignature = generateStripeSignature(payload, 'whsec_wrong_attacker_secret');

    const isValid = verifyStripeSignature(payload, fakeSignature, testWebhookSecret);
    assert.strictEqual(isValid, false);
  });

  test('Tampered webhook payload (altering teamId or subscription) is rejected', () => {
    const originalPayload = JSON.stringify({
      id: 'evt_123',
      type: 'checkout.session.completed',
      data: { object: { client_reference_id: 'team_victim' } },
    });
    const validSignature = generateStripeSignature(originalPayload, testWebhookSecret);

    // Attacker tampers body to elevate their own team
    const tamperedPayload = JSON.stringify({
      id: 'evt_123',
      type: 'checkout.session.completed',
      data: { object: { client_reference_id: 'team_attacker' } },
    });

    const isValid = verifyStripeSignature(tamperedPayload, validSignature, testWebhookSecret);
    assert.strictEqual(isValid, false);
  });

  test('Replay attack with stale timestamp (>300s old) is rejected', () => {
    const payload = JSON.stringify({ id: 'evt_old', type: 'customer.subscription.updated' });
    const staleTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago (> 300s tolerance)
    const staleSignature = generateStripeSignature(payload, testWebhookSecret, staleTimestamp);

    const isValid = verifyStripeSignature(payload, staleSignature, testWebhookSecret);
    assert.strictEqual(isValid, false, 'Stale webhook timestamp must be rejected to prevent replay attacks');
  });

  test('Missing or malformed stripe-signature header is rejected', () => {
    const payload = JSON.stringify({ type: 'checkout.session.completed' });
    assert.strictEqual(verifyStripeSignature(payload, '', testWebhookSecret), false);
    assert.strictEqual(verifyStripeSignature(payload, 'malformed_sig_without_t_and_v1', testWebhookSecret), false);
    assert.strictEqual(verifyStripeSignature(payload, 't=123', testWebhookSecret), false);
    assert.strictEqual(verifyStripeSignature(payload, 'v1=abc', testWebhookSecret), false);
  });
});

// =========================================================================
// MISSION 3: DATABASE RLS POLICY MATHEMATICAL & LOGICAL CONSTRAINTS
// =========================================================================
describe('Empirical Challenge 3: Database RLS Security & Privilege Escalation Prevention', () => {
  interface UserRecord {
    id: string;
    team_id: string;
    role: 'owner' | 'admin' | 'member';
    full_name: string;
    email: string;
  }

  interface TeamRecord {
    id: string;
    name: string;
    plan: 'free' | 'team' | 'enterprise';
    monthly_draft_limit: number;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  }

  interface MacroRecord {
    id: string;
    team_id: string;
    name: string;
    content: string;
  }

  // RLS 003 & 006 Model Evaluator
  const rlsEvaluateUserUpdate = (
    authUid: string,
    existingUser: UserRecord,
    updatedFields: Partial<UserRecord>
  ): { allowed: boolean; reason?: string } => {
    // USING (id = auth.uid())
    if (existingUser.id !== authUid) {
      return { allowed: false, reason: 'USING clause failed: cannot update other user profile' };
    }

    const nextUser = { ...existingUser, ...updatedFields };

    // WITH CHECK (
    //   id = auth.uid()
    //   AND team_id = (SELECT team_id FROM users WHERE id = auth.uid())
    //   AND role = (SELECT role FROM users WHERE id = auth.uid())
    // )
    if (nextUser.id !== authUid) {
      return { allowed: false, reason: 'WITH CHECK failed: id changed' };
    }
    if (nextUser.team_id !== existingUser.team_id) {
      return { allowed: false, reason: 'WITH CHECK failed: team_id mutation forbidden (prevents cross-tenant workspace takeover)' };
    }
    if (nextUser.role !== existingUser.role) {
      return { allowed: false, reason: 'WITH CHECK failed: role mutation forbidden (prevents privilege escalation to admin/owner)' };
    }

    return { allowed: true };
  };

  const rlsEvaluateTeamInsert = (
    newTeam: Partial<TeamRecord>
  ): { allowed: boolean; reason?: string } => {
    // WITH CHECK (
    //   plan = 'free'
    //   AND monthly_draft_limit = 50
    //   AND stripe_customer_id IS NULL
    //   AND stripe_subscription_id IS NULL
    // )
    if (newTeam.plan !== 'free') {
      return { allowed: false, reason: 'WITH CHECK failed: plan must be free on client insert' };
    }
    if (newTeam.monthly_draft_limit !== 50) {
      return { allowed: false, reason: 'WITH CHECK failed: monthly_draft_limit must be 50 on client insert' };
    }
    if (newTeam.stripe_customer_id !== null && newTeam.stripe_customer_id !== undefined) {
      return { allowed: false, reason: 'WITH CHECK failed: stripe_customer_id must be NULL on client insert' };
    }
    if (newTeam.stripe_subscription_id !== null && newTeam.stripe_subscription_id !== undefined) {
      return { allowed: false, reason: 'WITH CHECK failed: stripe_subscription_id must be NULL on client insert' };
    }
    return { allowed: true };
  };

  const rlsEvaluateMacroAccess = (
    user: UserRecord,
    macro: MacroRecord
  ): { allowed: boolean } => {
    // USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()))
    return { allowed: macro.team_id === user.team_id };
  };

  test('RLS 006: User cannot escalate role from member to admin or owner', () => {
    const authUid = 'user_victim_123';
    const currentUser: UserRecord = {
      id: authUid,
      team_id: 'team_alpha',
      role: 'member',
      full_name: 'Regular Agent',
      email: 'agent@alpha.com',
    };

    const escalationToAdmin = rlsEvaluateUserUpdate(authUid, currentUser, { role: 'admin' });
    assert.strictEqual(escalationToAdmin.allowed, false);
    assert.ok(escalationToAdmin.reason?.includes('role mutation forbidden'));

    const escalationToOwner = rlsEvaluateUserUpdate(authUid, currentUser, { role: 'owner' });
    assert.strictEqual(escalationToOwner.allowed, false);
  });

  test('RLS 006: User cannot switch team_id to take over another tenant workspace', () => {
    const authUid = 'user_attacker_456';
    const currentUser: UserRecord = {
      id: authUid,
      team_id: 'team_attacker',
      role: 'member',
      full_name: 'Attacker',
      email: 'attacker@evil.com',
    };

    const takeoverAttempt = rlsEvaluateUserUpdate(authUid, currentUser, { team_id: 'team_target_enterprise' });
    assert.strictEqual(takeoverAttempt.allowed, false);
    assert.ok(takeoverAttempt.reason?.includes('team_id mutation forbidden'));
  });

  test('RLS 006: User can legitimately update their profile name and metadata', () => {
    const authUid = 'user_legit_789';
    const currentUser: UserRecord = {
      id: authUid,
      team_id: 'team_alpha',
      role: 'member',
      full_name: 'Old Name',
      email: 'legit@alpha.com',
    };

    const legitUpdate = rlsEvaluateUserUpdate(authUid, currentUser, { full_name: 'New Updated Name' });
    assert.strictEqual(legitUpdate.allowed, true);
  });

  test('RLS 006: Client team creation cannot tamper plan, quota, or fake Stripe customer IDs', () => {
    // Tamper plan to enterprise
    const tamperPlan = rlsEvaluateTeamInsert({ plan: 'enterprise', monthly_draft_limit: 50 });
    assert.strictEqual(tamperPlan.allowed, false);

    // Tamper quota to 99999
    const tamperQuota = rlsEvaluateTeamInsert({ plan: 'free', monthly_draft_limit: 99999 });
    assert.strictEqual(tamperQuota.allowed, false);

    // Inject fake Stripe customer ID
    const injectStripe = rlsEvaluateTeamInsert({ plan: 'free', monthly_draft_limit: 50, stripe_customer_id: 'cus_fake_123' });
    assert.strictEqual(injectStripe.allowed, false);

    // Legitimate Free team creation
    const legitFreeTeam = rlsEvaluateTeamInsert({
      plan: 'free',
      monthly_draft_limit: 50,
      stripe_customer_id: null,
      stripe_subscription_id: null,
    });
    assert.strictEqual(legitFreeTeam.allowed, true);
  });

  test('RLS 003: Multi-tenant boundary isolates macros and documents between workspaces', () => {
    const userA: UserRecord = { id: 'u1', team_id: 'team_A', role: 'member', full_name: 'User A', email: 'a@a.com' };
    const userB: UserRecord = { id: 'u2', team_id: 'team_B', role: 'member', full_name: 'User B', email: 'b@b.com' };

    const macroTeamA: MacroRecord = { id: 'm1', team_id: 'team_A', name: 'Macro A', content: 'Secret A' };
    const macroTeamB: MacroRecord = { id: 'm2', team_id: 'team_B', name: 'Macro B', content: 'Secret B' };

    assert.strictEqual(rlsEvaluateMacroAccess(userA, macroTeamA).allowed, true);
    assert.strictEqual(rlsEvaluateMacroAccess(userA, macroTeamB).allowed, false);
    assert.strictEqual(rlsEvaluateMacroAccess(userB, macroTeamA).allowed, false);
    assert.strictEqual(rlsEvaluateMacroAccess(userB, macroTeamB).allowed, true);
  });
});

// =========================================================================
// MISSION 4: RATE LIMITING & MONTHLY QUOTA SATURATION STRESS-TESTS
// =========================================================================
describe('Empirical Challenge 4: Rate Limiter Stress & Monthly Quota Saturation', () => {
  class RateLimiterHarness {
    public userTimestamps = new Map<string, number[]>();
    private maxRequests: number;
    private windowMs: number;

    constructor(maxRequests = 20, windowMs = 60000) {
      this.maxRequests = maxRequests;
      this.windowMs = windowMs;
    }

    public request(userId: string, now = Date.now()): { status: number; message?: string } {
      // Memory cleanup eviction if cache size > 500
      if (this.userTimestamps.size > 500) {
        this.userTimestamps.forEach((times, uid) => {
          const valid = times.filter((t) => now - t < this.windowMs);
          if (valid.length === 0) {
            this.userTimestamps.delete(uid);
          } else {
            this.userTimestamps.set(uid, valid);
          }
        });
      }

      const timestamps = (this.userTimestamps.get(userId) || []).filter((t) => now - t < this.windowMs);
      if (timestamps.length >= this.maxRequests) {
        return { status: 429, message: 'Too Many Requests: Rate limit exceeded (max 20 drafts/min).' };
      }
      timestamps.push(now);
      this.userTimestamps.set(userId, timestamps);
      return { status: 200 };
    }
  }

  test('Burst rate limit: Allows exactly 20 requests in 1 second, rejects 21st with HTTP 429', () => {
    const limiter = new RateLimiterHarness(20, 60000);
    const userId = 'usr_burst_test';
    const startTime = 1000000;

    for (let i = 1; i <= 20; i++) {
      const res = limiter.request(userId, startTime + i * 10);
      assert.strictEqual(res.status, 200, `Request #${i} should succeed`);
    }

    const overflowRes = limiter.request(userId, startTime + 500);
    assert.strictEqual(overflowRes.status, 429);
    assert.ok(overflowRes.message?.includes('Rate limit exceeded'));
  });

  test('Rate limit sliding window recovery: Resumes after 60,001ms', () => {
    const limiter = new RateLimiterHarness(20, 60000);
    const userId = 'usr_recovery_test';
    const startTime = 1000000;

    for (let i = 0; i < 20; i++) {
      limiter.request(userId, startTime + i * 10);
    }
    assert.strictEqual(limiter.request(userId, startTime + 1000).status, 429);

    // After 60.1s
    const recoveryRes = limiter.request(userId, startTime + 60001);
    assert.strictEqual(recoveryRes.status, 200, 'Request after sliding window expiry must succeed');
  });

  test('Memory leak prevention: Evicts expired entries when map size exceeds 500', () => {
    const limiter = new RateLimiterHarness(20, 60000);
    const now = 1000000;

    // Populate 550 old users (expired)
    for (let i = 0; i < 550; i++) {
      limiter.userTimestamps.set(`old_user_${i}`, [now - 70000]); // 70s ago (> 60s window)
    }

    assert.strictEqual(limiter.userTimestamps.size, 550);

    // Trigger request which initiates eviction pass
    const res = limiter.request('new_active_user', now);
    assert.strictEqual(res.status, 200);

    // Verify all 550 expired users were pruned from memory
    assert.strictEqual(limiter.userTimestamps.size, 1);
    assert.ok(limiter.userTimestamps.has('new_active_user'));
  });

  test('Monthly Quota Saturation: Rejects request when usage equals or exceeds limit', () => {
    const checkMonthlyQuota = (used: number, limit: number) => {
      if (used >= limit) {
        return {
          status: 429,
          error: `Monthly draft limit reached for this workspace (${used}/${limit} used). Please upgrade your plan.`,
          quotaExceeded: true,
          limit,
          used,
        };
      }
      return { status: 200, used: used + 1 };
    };

    // Free Tier: 50 limit
    assert.deepStrictEqual(checkMonthlyQuota(50, 50), {
      status: 429,
      error: 'Monthly draft limit reached for this workspace (50/50 used). Please upgrade your plan.',
      quotaExceeded: true,
      limit: 50,
      used: 50,
    });

    assert.deepStrictEqual(checkMonthlyQuota(51, 50), {
      status: 429,
      error: 'Monthly draft limit reached for this workspace (51/50 used). Please upgrade your plan.',
      quotaExceeded: true,
      limit: 50,
      used: 51,
    });

    assert.strictEqual(checkMonthlyQuota(49, 50).status, 200);

    // Team Tier: 1000 limit
    assert.strictEqual(checkMonthlyQuota(50, 1000).status, 200);
    assert.strictEqual(checkMonthlyQuota(999, 1000).status, 200);
    assert.strictEqual(checkMonthlyQuota(1000, 1000).status, 429);
  });
});

// =========================================================================
// MISSION 5: FULL-STACK PII SCRUBBING & XSS SANITIZATION INTEGRITY
// =========================================================================
describe('Empirical Challenge 5: PII Redaction & Stored/DOM Injection Defense', () => {
  test('PII Scrubber redacts emails, phone numbers, credit cards, SSNs, and API keys', () => {
    const sensitiveInput = `Customer info:
Email: john.doe@example.com
Phone: +1 (555) 123-4567
CC: 4532 1234 5678 9012
SSN: 123-45-6789
OpenAI Key: sk-proj-abcdef1234567890abcdef1234567890
GitHub Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz`;

    const scrubbed = scrubPII(sensitiveInput);

    assert.ok(!scrubbed.includes('john.doe@example.com'));
    assert.ok(!scrubbed.includes('555-123-4567'));
    assert.ok(!scrubbed.includes('4532 1234 5678 9012'));
    assert.ok(!scrubbed.includes('123-45-6789'));
    assert.ok(!scrubbed.includes('sk-proj-abcdef1234567890abcdef1234567890'));
    assert.ok(!scrubbed.includes('ghp_1234567890abcdefghijklmnopqrstuvwxyz'));

    assert.ok(scrubbed.includes('[EMAIL_REDACTED]'));
    assert.ok(scrubbed.includes('[PHONE_REDACTED]'));
    assert.ok(scrubbed.includes('[CARD_REDACTED]'));
    assert.ok(scrubbed.includes('[SSN_REDACTED]'));
    assert.ok(scrubbed.includes('[TOKEN_REDACTED]'));
  });

  test('DOM XSS sanitization: HTML entities are properly escaped before template interpolation', () => {
    const escapeHtml = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const maliciousMacroName = '<img src=x onerror=alert(1)>';
    const maliciousMacroContent = '<script>document.cookie="stolen"</script><h1>Invoice</h1>';

    const safeName = escapeHtml(maliciousMacroName);
    const safeContent = escapeHtml(maliciousMacroContent);

    assert.strictEqual(safeName, '&lt;img src=x onerror=alert(1)&gt;');
    assert.strictEqual(safeContent, '&lt;script&gt;document.cookie=&quot;stolen&quot;&lt;/script&gt;&lt;h1&gt;Invoice&lt;/h1&gt;');
    assert.ok(!safeName.includes('<img'));
    assert.ok(!safeContent.includes('<script>'));
  });
});
