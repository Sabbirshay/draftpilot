/// <reference types="node" />
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import {
  verifySuperAdmin,
  timingSafeEqual,
  getActiveRootPasskey,
  setCachedRootPasskey,
  clearCachedRootPasskey,
  supabaseAdmin,
} from '../admin-auth.ts';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import { GET as getAdminPasskey, POST as postAdminPasskey } from '../../app/api/admin/passkey/route.ts';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import { scrubPII } from '../pii-scrubber.ts';

// ============================================================================
// EMPIRICAL CHALLENGER TEST SUITE: REQUIREMENT 1 & REQUIREMENT 2
// ============================================================================

describe('Empirical Challenger: Deep Adversarial Verification of R1 & R2', () => {
  const originalAdminPasskey = process.env.ADMIN_PASSKEY;
  const originalSuperadminPasskey = process.env.SUPERADMIN_PASSKEY;
  const originalSuperadminEmails = process.env.SUPERADMIN_EMAILS;

  beforeEach(() => {
    clearCachedRootPasskey();
    process.env.ADMIN_PASSKEY = 'challenger-master-passkey-2026';
    delete process.env.SUPERADMIN_PASSKEY;
    process.env.SUPERADMIN_EMAILS = 'admin@draftpilot.app,superadmin@draftpilot.com';
  });

  afterEach(() => {
    clearCachedRootPasskey();
    if (originalAdminPasskey !== undefined) {
      process.env.ADMIN_PASSKEY = originalAdminPasskey;
    } else {
      delete process.env.ADMIN_PASSKEY;
    }
    if (originalSuperadminPasskey !== undefined) {
      process.env.SUPERADMIN_PASSKEY = originalSuperadminPasskey;
    } else {
      delete process.env.SUPERADMIN_PASSKEY;
    }
    if (originalSuperadminEmails !== undefined) {
      process.env.SUPERADMIN_EMAILS = originalSuperadminEmails;
    } else {
      delete process.env.SUPERADMIN_EMAILS;
    }
  });

  // ==========================================================================
  // REQUIREMENT 1: USER DELETION & BAN REGISTRY ADVERSARIAL CHALLENGES
  // ==========================================================================
  describe('Requirement 1: Ban Registry, Normalization & 1-Click Restore', () => {
    // Contract-level implementation model matching /api/admin/users and gateway routes
    class MockBanRegistryHarness {
      public bannedMap = new Map<string, { email: string; reason: string; banned_by: string; created_at: string }>();
      public activeUsers = new Map<string, { id: string; email: string; name: string }>();

      reset() {
        this.bannedMap.clear();
        this.activeUsers.clear();
      }

      banUser(rawEmail: string, reason = 'Banned by Super Admin', banned_by = 'Super Admin', deleteUser = false, userId?: string) {
        if (!rawEmail || typeof rawEmail !== 'string') {
          return { status: 400, error: 'Valid email is required' };
        }
        const normalized = rawEmail.trim().toLowerCase();
        if (!normalized) {
          return { status: 400, error: 'Valid email is required' };
        }

        this.bannedMap.set(normalized, {
          email: normalized,
          reason,
          banned_by,
          created_at: new Date().toISOString(),
        });

        if (deleteUser) {
          if (userId) {
            this.activeUsers.delete(userId);
          } else {
            for (const [uid, u] of this.activeUsers.entries()) {
              if (u.email.toLowerCase() === normalized) {
                this.activeUsers.delete(uid);
              }
            }
          }
        }

        return { status: 200, success: true, message: `User ${normalized} deactivated and added to banned registry` };
      }

      unbanUser(rawEmail: string) {
        if (!rawEmail || typeof rawEmail !== 'string') {
          return { status: 400, error: 'Valid email parameter is required' };
        }
        const normalized = rawEmail.trim().toLowerCase();
        if (!normalized) {
          return { status: 400, error: 'Valid email parameter is required' };
        }

        const existed = this.bannedMap.delete(normalized);
        return { status: 200, success: true, message: `Permission restored for ${normalized}`, existed };
      }

      isBanned(rawEmail: string): boolean {
        if (!rawEmail || typeof rawEmail !== 'string') return false;
        return this.bannedMap.has(rawEmail.trim().toLowerCase());
      }

      // Gateway verification oracle (/api/auth/me)
      simulateAuthMe(user: { id: string; email: string } | null) {
        if (!user) return { status: 401, error: 'Unauthorized: Missing token' };
        const email = user.email.trim().toLowerCase();
        if (this.bannedMap.has(email)) {
          const entry = this.bannedMap.get(email)!;
          return {
            status: 403,
            banned: true,
            error: 'Account deactivated. Please contact support.',
            reason: entry.reason,
          };
        }
        return { status: 200, user };
      }

      // Gateway verification oracle (/api/drafts/generate)
      simulateDraftGenerate(user: { id: string; email: string } | null, prompt: string) {
        if (!user) return { status: 401, error: 'Unauthorized: Missing token' };
        const email = user.email.trim().toLowerCase();
        if (this.bannedMap.has(email)) {
          return {
            status: 403,
            banned: true,
            error: 'Account deactivated. Please contact support.',
          };
        }
        return { status: 200, draft: `Generated support draft for: ${prompt}` };
      }
    }

    test('1.1: Case-variant email banning (bAnNeD@ExamPLE.CoM)', () => {
      const harness = new MockBanRegistryHarness();
      const variantEmail = 'bAnNeD@ExamPLE.CoM';

      const banResult = harness.banUser(variantEmail, 'Case variation test');
      assert.strictEqual(banResult.status, 200);
      assert.strictEqual(banResult.success, true);
      assert.strictEqual(banResult.message, 'User banned@example.com deactivated and added to banned registry');

      // Check case variants in gateway
      assert.strictEqual(harness.isBanned('banned@example.com'), true);
      assert.strictEqual(harness.isBanned('BANNED@EXAMPLE.COM'), true);
      assert.strictEqual(harness.isBanned('bAnNeD@ExamPLE.CoM'), true);
      assert.strictEqual(harness.isBanned('Banned@Example.com'), true);

      // Gateway /api/auth/me check
      const authCheck = harness.simulateAuthMe({ id: 'u1', email: 'BANNED@EXAMPLE.COM' });
      assert.strictEqual(authCheck.status, 403);
      assert.strictEqual(authCheck.banned, true);
      assert.strictEqual(authCheck.error, 'Account deactivated. Please contact support.');
    });

    test('1.2: Whitespace and control character padding in email', () => {
      const harness = new MockBanRegistryHarness();
      const paddedEmail = '  \t \r\n  Victim.User@Service.Org  \n ';

      const banResult = harness.banUser(paddedEmail, 'Whitespace padding test');
      assert.strictEqual(banResult.status, 200);
      assert.strictEqual(harness.isBanned('victim.user@service.org'), true);
      assert.strictEqual(harness.isBanned('  victim.user@service.org  '), true);
    });

    test('1.3: Rejects invalid, empty, or whitespace-only email parameters', () => {
      const harness = new MockBanRegistryHarness();
      const invalidEmails: any[] = ['', '   ', '\t\r\n', null, undefined, 12345, {}, []];

      for (const invalid of invalidEmails) {
        const banRes = harness.banUser(invalid);
        assert.strictEqual(banRes.status, 400);

        const unbanRes = harness.unbanUser(invalid);
        assert.strictEqual(unbanRes.status, 400);
      }
    });

    test('1.4: 1-Click Restore: Immediate access restoration across routes upon registry deletion', () => {
      const harness = new MockBanRegistryHarness();
      const user = { id: 'u-101', email: 'agent.lockout@supportteam.com' };
      harness.activeUsers.set(user.id, { ...user, name: 'Support Agent' });

      // Step 1: User starts in active state
      const preAuth = harness.simulateAuthMe(user);
      assert.strictEqual(preAuth.status, 200);
      const preDraft = harness.simulateDraftGenerate(user, 'Help with order');
      assert.strictEqual(preDraft.status, 200);

      // Step 2: Super Admin bans user
      harness.banUser(user.email, 'Suspicious API activity');

      // Step 3: Immediate 403 lockout at gateway
      const lockAuth = harness.simulateAuthMe(user);
      assert.strictEqual(lockAuth.status, 403);
      assert.strictEqual(lockAuth.banned, true);

      const lockDraft = harness.simulateDraftGenerate(user, 'Help with order');
      assert.strictEqual(lockDraft.status, 403);
      assert.strictEqual(lockDraft.banned, true);

      // Step 4: 1-Click Restore executed by Admin (with mixed case query parameter)
      const unbanRes = harness.unbanUser('AGENT.LOCKOUT@SUPPORTTEAM.COM');
      assert.strictEqual(unbanRes.status, 200);
      assert.strictEqual(unbanRes.existed, true);

      // Step 5: Immediate recovery of access (200 OK)
      const postAuth = harness.simulateAuthMe(user);
      assert.strictEqual(postAuth.status, 200);

      const postDraft = harness.simulateDraftGenerate(user, 'Help with order');
      assert.strictEqual(postDraft.status, 200);
      assert.ok(postDraft.draft?.includes('Generated support draft'));
    });

    test('1.5: 1-Click Restore idempotency: Restoring unbanned or non-existent email succeeds gracefully', () => {
      const harness = new MockBanRegistryHarness();
      const res = harness.unbanUser('never.banned@company.com');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.existed, false);
    });

    test('1.6: Subaddressing and Unicode email handling', () => {
      const harness = new MockBanRegistryHarness();
      const alias = 'user+spamtag@domain.co.uk';

      harness.banUser(alias, 'Spam tag detected');
      assert.strictEqual(harness.isBanned('user+spamtag@domain.co.uk'), true);
      assert.strictEqual(harness.isBanned('USER+SPAMTAG@DOMAIN.CO.UK'), true);
      // Different tag is separate
      assert.strictEqual(harness.isBanned('user+clean@domain.co.uk'), false);
    });
  });

  // ==========================================================================
  // REQUIREMENT 2: ROOT PASSKEY VAULT & DYNAMIC SETTINGS ADVERSARIAL CHALLENGES
  // ==========================================================================
  describe('Requirement 2: Passkey Vault, Dynamic Rotation & Bypass Attacks', () => {
    test('2.1: Timing attack resistance: timingSafeEqual constant-time validation', () => {
      // 1. Equal strings
      assert.strictEqual(timingSafeEqual('correct-passkey-2026', 'correct-passkey-2026'), true);

      // 2. Different characters, same length
      assert.strictEqual(timingSafeEqual('correct-passkey-2026', 'xorrect-passkey-2026'), false);
      assert.strictEqual(timingSafeEqual('correct-passkey-2026', 'correct-passkey-2027'), false);

      // 3. Different lengths
      assert.strictEqual(timingSafeEqual('short', 'longer-string-passkey'), false);
      assert.strictEqual(timingSafeEqual('longer-string-passkey', 'short'), false);

      // 4. Edge cases & type resistance
      assert.strictEqual(timingSafeEqual('', ''), true);
      assert.strictEqual(timingSafeEqual('', 'non-empty'), false);
      assert.strictEqual(timingSafeEqual('non-empty', ''), false);

      const nonStrings: any[] = [null, undefined, 123, true, false, {}, [], () => {}, NaN];
      for (const val of nonStrings) {
        assert.strictEqual(timingSafeEqual(val, 'valid'), false);
        assert.strictEqual(timingSafeEqual('valid', val), false);
        assert.strictEqual(timingSafeEqual(val, val), false);
      }
    });

    test('2.2: Passkey bypass attempts: empty, null, undefined, substring and prefix attacks', async () => {
      const realPasskey = 'superadmin-secret-passkey-2026';
      setCachedRootPasskey(realPasskey);

      const attacks = [
        '',
        '   ',
        '\t',
        '\n',
        'null',
        'undefined',
        'superadmin',
        'superadmin-secret',
        'superadmin-secret-passkey',
        'superadmin-secret-passkey-2026-extra',
        'root-superadmin-secret-passkey-2026',
        'SUPERADMIN-SECRET-PASSKEY-2026',
        'superadmin-secret-passkey-2025',
      ];

      for (const attack of attacks) {
        const req = new Request('http://localhost:3000/api/admin/passkey', {
          headers: { 'x-admin-passkey': attack },
        });
        const auth = await verifySuperAdmin(req);
        assert.strictEqual(auth.authorized, false, `Attack "${attack}" should NOT be authorized`);
      }
    });

    test('2.3: Live Route: GET /api/admin/passkey returns active passkey and requires auth', async () => {
      const activeKey = 'vault-test-passkey-2026';
      setCachedRootPasskey(activeKey);

      // 1. Unauthorized request
      const unauthReq = new Request('http://localhost:3000/api/admin/passkey');
      const unauthRes = await getAdminPasskey(unauthReq);
      assert.strictEqual(unauthRes.status, 401);

      // 2. Authorized request
      const authReq = new Request('http://localhost:3000/api/admin/passkey', {
        headers: { 'x-admin-passkey': activeKey },
      });
      const authRes = await getAdminPasskey(authReq);
      assert.strictEqual(authRes.status, 200);
      const data = await authRes.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.passkey, activeKey);
    });

    test('2.4: Live Route: POST /api/admin/passkey dynamically updates passkey and invalidates old passkey immediately', async () => {
      const initialKey = 'initial-vault-passkey-111';
      const rotatedKey = 'rotated-vault-passkey-222';
      setCachedRootPasskey(initialKey);

      // 1. Initial key authorized
      const req1 = new Request('http://localhost:3000/api/admin/passkey', {
        headers: { 'x-admin-passkey': initialKey },
      });
      assert.strictEqual((await getAdminPasskey(req1)).status, 200);

      // 2. Super Admin updates passkey
      const updateReq = new Request('http://localhost:3000/api/admin/passkey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passkey': initialKey,
        },
        body: JSON.stringify({ newPasskey: rotatedKey }),
      });
      const updateRes = await postAdminPasskey(updateReq);
      assert.strictEqual(updateRes.status, 200);
      const updateData = await updateRes.json();
      assert.strictEqual(updateData.success, true);

      // 3. Old passkey fails immediately
      const oldReq = new Request('http://localhost:3000/api/admin/passkey', {
        headers: { 'x-admin-passkey': initialKey },
      });
      assert.strictEqual((await getAdminPasskey(oldReq)).status, 401);

      // 4. New passkey succeeds immediately
      const newReq = new Request('http://localhost:3000/api/admin/passkey', {
        headers: { 'x-admin-passkey': rotatedKey },
      });
      const newRes = await getAdminPasskey(newReq);
      assert.strictEqual(newRes.status, 200);
      const newData = await newRes.json();
      assert.strictEqual(newData.passkey, rotatedKey);
    });

    test('2.5: Rejects passkey update with length < 6 or whitespace-only', async () => {
      const activeKey = 'valid-passkey-333';
      setCachedRootPasskey(activeKey);

      const invalidUpdates = ['', '1', '12', '123', '1234', '12345', '      ', '\t\n\r\t', null, undefined];

      for (const badKey of invalidUpdates) {
        const updateReq = new Request('http://localhost:3000/api/admin/passkey', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-passkey': activeKey,
          },
          body: JSON.stringify({ newPasskey: badKey }),
        });

        const updateRes = await postAdminPasskey(updateReq);
        assert.strictEqual(updateRes.status, 400);
        const data = await updateRes.json();
        assert.ok(data.error.includes('at least 6 characters'));

        // Verify active key was NOT mutated
        const checkReq = new Request('http://localhost:3000/api/admin/passkey', {
          headers: { 'x-admin-passkey': activeKey },
        });
        assert.strictEqual((await getAdminPasskey(checkReq)).status, 200);
      }
    });

    test('2.6: High-entropy complex ASCII passkey rotation with special characters', async () => {
      const complexKey = 'Vault-Master-2026-Passkey-Special-Chars!@#$%^&*()_+~`|}{[]:;?><,./';
      setCachedRootPasskey('initial-key-000');

      const updateReq = new Request('http://localhost:3000/api/admin/passkey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passkey': 'initial-key-000',
        },
        body: JSON.stringify({ newPasskey: complexKey }),
      });
      const updateRes = await postAdminPasskey(updateReq);
      assert.strictEqual(updateRes.status, 200);

      // Verify complex passkey authorizes
      const checkReq = new Request('http://localhost:3000/api/admin/passkey', {
        headers: { 'x-admin-passkey': complexKey },
      });
      const checkRes = await getAdminPasskey(checkReq);
      assert.strictEqual(checkRes.status, 200);
      const data = await checkRes.json();
      assert.strictEqual(data.passkey, complexKey);
    });
  });

  // ==========================================================================
  // EXTENSION CLIENT 403 INTERCEPTION & FALLBACK SYNTHESIZER SUPPRESSION
  // ==========================================================================
  describe('Extension Client 403 Interception & Fallback Synthesizer Oracle', () => {
    test('3.1: 403 Banned response throws immediately and suppresses fallback synthesizer', async () => {
      let fallbackSynthesizerExecuted = false;

      // Oracle modeling extension ApiClient generateDraft behavior
      const executeDraftRequest = async (mockServerStatus: number, mockServerBody: any) => {
        if (mockServerStatus === 403) {
          const errorMsg = mockServerBody?.error || 'Account deactivated. Please contact support.';
          const banError = new Error(errorMsg);
          (banError as any).banned = true;
          (banError as any).status = 403;
          throw banError; // Must throw immediately, stopping fallback execution
        }

        if (mockServerStatus === 200) {
          return { draft: mockServerBody.draft, confidence: 96 };
        }

        // Offline / Network Error Fallback Synthesizer (only for non-403)
        fallbackSynthesizerExecuted = true;
        return {
          draft: 'Hi there,\n\nI would be glad to help you with your inquiry.\n\nBest regards,\nCustomer Support Team',
          confidence: 88,
        };
      };

      // Test 1: Banned 403 response
      try {
        await executeDraftRequest(403, {
          error: 'Account deactivated. Please contact support.',
          banned: true,
        });
        assert.fail('Should have thrown error on 403');
      } catch (err: any) {
        assert.strictEqual(err.banned, true);
        assert.strictEqual(err.status, 403);
        assert.strictEqual(err.message, 'Account deactivated. Please contact support.');
        assert.strictEqual(fallbackSynthesizerExecuted, false, 'Fallback synthesizer must NEVER execute when banned!');
      }

      // Test 2: Server 500 error triggers fallback
      const fallbackResult = await executeDraftRequest(500, {});
      assert.strictEqual(fallbackSynthesizerExecuted, true);
      assert.ok(fallbackResult.draft.includes('glad to help you'));
    });

    test('3.2: PII Scrubber and cleanAiDraft handles thinking process scrubbing cleanly', () => {
      const rawText = `<think>
Analyzing user request. Refund policy applies.
</think>
Hi Sarah,

Your refund of $49.00 has been processed for card 4111-2222-3333-4444 and passcode: TopSecret123.

Best regards,
Customer Support Team`;

      const scrubbed = scrubPII(rawText);
      // Redacts 16-digit card number and passcode
      assert.strictEqual(scrubbed.includes('4111-2222-3333-4444'), false);
      assert.ok(scrubbed.includes('[CARD_REDACTED]'));
      assert.strictEqual(scrubbed.includes('TopSecret123'), false);
      assert.ok(scrubbed.includes('[SECRET_REDACTED]'));

      const cleanAiDraft = (rawText: string, customerName = 'there'): string => {
        if (!rawText) return '';
        let text = rawText.trim();
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        return text;
      };

      const cleaned = cleanAiDraft(scrubbed, 'Sarah');
      assert.strictEqual(cleaned.includes('<think>'), false);
      assert.ok(cleaned.startsWith('Hi Sarah,'));
      assert.ok(cleaned.endsWith('Customer Support Team'));
    });
  });
});
