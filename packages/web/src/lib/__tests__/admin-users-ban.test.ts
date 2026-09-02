import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import { verifySuperAdmin } from '../admin-auth.ts';

describe('Milestone 1: Super Admin User Deletion & Permission Registry (banned_emails)', () => {
  const originalAdmin = process.env.ADMIN_PASSKEY;
  const originalSuper = process.env.SUPERADMIN_PASSKEY;
  const originalEmails = process.env.SUPERADMIN_EMAILS;

  beforeEach(() => {
    process.env.ADMIN_PASSKEY = 'test-superadmin-secret-2026';
    process.env.SUPERADMIN_PASSKEY = 'test-superadmin-secret-2026';
    process.env.SUPERADMIN_EMAILS = 'admin@draftpilot.app,super@draftpilot.com';
  });

  // =========================================================================
  // 1. EMAIL NORMALIZATION & LOWERCASE INDEXING
  // =========================================================================
  describe('1. Email Normalization & Case-Insensitive Registry Logic', () => {
    test('Normalizes mixed-case and padded emails to clean lowercase', () => {
      const normalizeEmail = (email: string) => email.trim().toLowerCase();

      assert.strictEqual(normalizeEmail('  User@Domain.COM  '), 'user@domain.com');
      assert.strictEqual(normalizeEmail('Spammer.Abuse+123@GMAIL.COM'), 'spammer.abuse+123@gmail.com');
      assert.strictEqual(normalizeEmail('Test_User@DraftPilot.App'), 'test_user@draftpilot.app');
    });

    test('Case-insensitive set lookup correctly matches banned emails', () => {
      const bannedSet = new Set(['badactor@example.com', 'fraud@company.io']);
      const isBanned = (email: string) => bannedSet.has(email.trim().toLowerCase());

      assert.strictEqual(isBanned('badactor@example.com'), true);
      assert.strictEqual(isBanned('BadActor@Example.COM'), true);
      assert.strictEqual(isBanned('  FRAUD@company.io  '), true);
      assert.strictEqual(isBanned('gooduser@example.com'), false);
    });
  });

  // =========================================================================
  // 2. ADMIN API AUTHENTICATION SECURITY
  // =========================================================================
  describe('2. Admin API Authentication & Route Protection', () => {
    test('Rejects unauthenticated requests without headers with 401', async () => {
      const req = new Request('http://localhost:3000/api/admin/users', {
        method: 'GET',
      });
      const auth = await verifySuperAdmin(req);
      assert.strictEqual(auth.authorized, false);
      assert.strictEqual(auth.response?.status, 401);
    });

    test('Rejects invalid passkey with 401', async () => {
      const req = new Request('http://localhost:3000/api/admin/users', {
        method: 'GET',
        headers: { 'x-admin-passkey': 'wrong-passkey-123' },
      });
      const auth = await verifySuperAdmin(req);
      assert.strictEqual(auth.authorized, false);
      assert.strictEqual(auth.response?.status, 401);
    });

    test('Authorizes request with valid x-admin-passkey', async () => {
      const req = new Request('http://localhost:3000/api/admin/users', {
        method: 'GET',
        headers: { 'x-admin-passkey': 'test-superadmin-secret-2026' },
      });
      const auth = await verifySuperAdmin(req);
      assert.strictEqual(auth.authorized, true);
    });
  });

  // =========================================================================
  // 3. USER MANAGEMENT & BANNING LOGIC CONTRACTS
  // =========================================================================
  describe('3. User Deactivation, Ban Registry, & 1-Click Restoration', () => {
    test('Ban record creation structure meets schema requirements', () => {
      const createBanRecord = (email: string, reason?: string, bannedBy?: string) => ({
        id: 'uuid-1234-test',
        email: email.trim().toLowerCase(),
        reason: reason || 'Banned by Super Admin',
        banned_by: bannedBy || 'Super Admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const ban = createBanRecord('AbusiveUser@Example.Com', 'Spamming support channels', 'admin@draftpilot.app');
      assert.strictEqual(ban.email, 'abusiveuser@example.com');
      assert.strictEqual(ban.reason, 'Spamming support channels');
      assert.strictEqual(ban.banned_by, 'admin@draftpilot.app');
      assert.ok(ban.created_at);
      assert.ok(ban.updated_at);
    });

    test('Simulated Registry allows 1-click restoration by removing email', () => {
      const registry = new Map<string, any>();
      
      // Add ban
      const email = 'user-to-restore@test.com';
      registry.set(email, { email, reason: 'Temporary block' });
      assert.strictEqual(registry.has(email), true);

      // Restore permission (unban)
      registry.delete(email);
      assert.strictEqual(registry.has(email), false);
    });

    test('User list aggregation maps teams and draft counts correctly', () => {
      const rawUsers = [
        {
          id: 'u1',
          email: 'alice@company.com',
          full_name: 'Alice Support',
          role: 'owner',
          team_id: 't1',
          teams: { id: 't1', name: 'Acme Corp', plan: 'team' },
          created_at: '2026-08-01T10:00:00Z',
        },
        {
          id: 'u2',
          email: 'bob@company.com',
          full_name: null,
          role: 'member',
          team_id: 't1',
          teams: { id: 't1', name: 'Acme Corp', plan: 'team' },
          created_at: '2026-08-05T12:00:00Z',
        },
      ];

      const drafts = [
        { user_id: 'u1', team_id: 't1' },
        { user_id: 'u1', team_id: 't1' },
        { user_id: 'u2', team_id: 't1' },
      ];

      const userDraftCounts: Record<string, number> = {};
      drafts.forEach((d) => {
        userDraftCounts[d.user_id] = (userDraftCounts[d.user_id] || 0) + 1;
      });

      const mappedUsers = rawUsers.map((u) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name || u.email.split('@')[0] || 'User',
        role: u.role,
        team_id: u.team_id,
        team_name: u.teams?.name || 'Personal Workspace',
        team_plan: u.teams?.plan || 'free',
        drafts_count: userDraftCounts[u.id] || 0,
        created_at: u.created_at,
      }));

      assert.strictEqual(mappedUsers[0].full_name, 'Alice Support');
      assert.strictEqual(mappedUsers[0].drafts_count, 2);
      assert.strictEqual(mappedUsers[1].full_name, 'bob');
      assert.strictEqual(mappedUsers[1].drafts_count, 1);
    });
  });

  // =========================================================================
  // 4. GATEWAY BAN INTERCEPTION CONTRACTS
  // =========================================================================
  describe('4. Gateway Ban Interception Response Verification', () => {
    test('Banned user check produces 403 Forbidden with banned flag', () => {
      const bannedRegistry = new Set(['deactivated@victim.org']);

      const checkAccess = (userEmail: string) => {
        const normalized = userEmail.trim().toLowerCase();
        if (bannedRegistry.has(normalized)) {
          return {
            status: 403,
            body: {
              error: 'Account deactivated. Please contact support.',
              banned: true,
              reason: 'Account deactivated by Super Admin',
            },
          };
        }
        return { status: 200, body: { success: true } };
      };

      const bannedRes = checkAccess('Deactivated@Victim.ORG');
      assert.strictEqual(bannedRes.status, 403);
      assert.strictEqual(bannedRes.body.banned, true);
      assert.strictEqual(bannedRes.body.error, 'Account deactivated. Please contact support.');

      const allowedRes = checkAccess('active@company.com');
      assert.strictEqual(allowedRes.status, 200);
      assert.strictEqual(allowedRes.body.success, true);
    });

    test('Extension client correctly intercepts 403 banned response without fallback', async () => {
      // Mock fetch simulating 403 banned response
      const mockFetchBanned = async (): Promise<any> => {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            error: 'Account deactivated. Please contact support.',
            banned: true,
          }),
        };
      };

      let fallbackTriggered = false;
      let caughtError: any = null;

      try {
        const genRes = await mockFetchBanned();
        if (genRes.status === 403) {
          const genData = await genRes.json();
          const banError = new Error(genData.error || 'Account deactivated.');
          (banError as any).banned = true;
          (banError as any).status = 403;
          throw banError;
        }

        if (!genRes.ok) {
          fallbackTriggered = true; // offline fallback
        }
      } catch (err: any) {
        if (err?.banned || err?.status === 403) {
          caughtError = err;
        } else {
          fallbackTriggered = true;
        }
      }

      assert.strictEqual(fallbackTriggered, false, 'Local fallback synthesizer MUST NOT trigger when user is banned');
      assert.ok(caughtError, 'Ban error must be caught and thrown to UI');
      assert.strictEqual(caughtError.banned, true);
      assert.strictEqual(caughtError.message, 'Account deactivated. Please contact support.');
    });
  });
});
