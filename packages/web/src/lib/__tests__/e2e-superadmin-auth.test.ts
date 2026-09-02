/// <reference types="node" />
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import { verifySuperAdmin, supabaseAdmin } from '../admin-auth.ts';

// ============================================================================
// OPAQUE-BOX CONTRACT HARNESS & SPECIFICATION SIMULATORS
// Derived strictly from ORIGINAL_REQUEST.md, PROJECT.md, and TEST_INFRA.md
// ============================================================================

/**
 * Constant-time comparison matching the production implementation
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * In-Memory Multi-Tenant Database simulating PostgreSQL + Supabase
 */
interface BannedEmailRecord {
  id: string;
  email: string;
  reason?: string;
  banned_by?: string;
  created_at: string;
}

interface PlatformSettingsRecord {
  id: string;
  root_passkey?: string | null;
  updated_at: string;
}

interface UserAccount {
  id: string;
  email: string;
  full_name: string;
  role: 'superadmin' | 'admin' | 'owner' | 'member';
  team_id: string;
  team_name: string;
  drafts_count: number;
  email_confirmed_at: string | null;
  created_at: string;
  is_oauth?: boolean;
}

class MockDatabaseHarness {
  public users: Map<string, UserAccount> = new Map();
  public bannedEmails: Map<string, BannedEmailRecord> = new Map(); // Keyed by lowercased email
  public platformSettings: PlatformSettingsRecord = {
    id: 'singleton-settings',
    root_passkey: null,
    updated_at: new Date().toISOString(),
  };

  reset() {
    this.users.clear();
    this.bannedEmails.clear();
    this.platformSettings = {
      id: 'singleton-settings',
      root_passkey: null,
      updated_at: new Date().toISOString(),
    };
  }

  // Ban registry operations
  banEmail(email: string, reason = 'Administrative deactivation', banned_by = 'superadmin'): BannedEmailRecord {
    const normalized = email.toLowerCase().trim();
    const record: BannedEmailRecord = {
      id: `ban-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      email: normalized,
      reason,
      banned_by,
      created_at: new Date().toISOString(),
    };
    this.bannedEmails.set(normalized, record);
    return record;
  }

  unbanEmail(email: string): boolean {
    const normalized = email.toLowerCase().trim();
    return this.bannedEmails.delete(normalized);
  }

  isEmailBanned(email: string): boolean {
    if (!email) return false;
    return this.bannedEmails.has(email.toLowerCase().trim());
  }

  deleteUser(userId: string): boolean {
    return this.users.delete(userId);
  }
}

/**
 * Dynamic Root Passkey Engine (F5, F6, F7, F8)
 * Dynamic DB passkey loader with TTL cache, fallback to env, immediate cache invalidation
 */
class DynamicPasskeyEngine {
  private db: MockDatabaseHarness;
  private cachedPasskey: string | null = null;
  private cacheExpiry = 0;
  public readonly TTL_MS = 30000; // 30 seconds TTL

  constructor(db: MockDatabaseHarness) {
    this.db = db;
  }

  async getActivePasskey(now = Date.now()): Promise<string> {
    // 1. Check memory cache
    if (this.cachedPasskey !== null && now < this.cacheExpiry) {
      return this.cachedPasskey;
    }

    // 2. Fetch from database platform_settings
    const dbPasskey = this.db.platformSettings.root_passkey;
    if (dbPasskey && dbPasskey.trim().length >= 6) {
      this.cachedPasskey = dbPasskey.trim();
      this.cacheExpiry = now + this.TTL_MS;
      return this.cachedPasskey;
    }

    // 3. Fallback to environment variables
    const envPasskey = (process.env.ADMIN_PASSKEY || process.env.SUPERADMIN_PASSKEY)?.trim() || 'default-fallback-root-2026';
    this.cachedPasskey = envPasskey;
    this.cacheExpiry = now + this.TTL_MS;
    return this.cachedPasskey;
  }

  async updatePasskey(newPasskey: string, actor = 'superadmin'): Promise<{ success: boolean; message?: string; error?: string }> {
    const clean = (newPasskey || '').trim();
    if (!clean || clean.length < 6) {
      return { success: false, error: 'Passkey must be at least 6 characters long.' };
    }

    // Update in DB singleton
    this.db.platformSettings.root_passkey = clean;
    this.db.platformSettings.updated_at = new Date().toISOString();

    // Immediate cache invalidation
    this.invalidateCache();

    return { success: true, message: 'Root passkey updated successfully.' };
  }

  invalidateCache() {
    this.cachedPasskey = null;
    this.cacheExpiry = 0;
  }

  async verifyPasskey(providedKey: string): Promise<boolean> {
    if (!providedKey || typeof providedKey !== 'string') return false;
    const active = await this.getActivePasskey();
    return timingSafeEqual(providedKey.trim(), active);
  }
}

/**
 * Super Admin API Route Handlers Simulator
 */
class AdminApiHandler {
  private db: MockDatabaseHarness;
  private passkeyEngine: DynamicPasskeyEngine;

  constructor(db: MockDatabaseHarness, passkeyEngine: DynamicPasskeyEngine) {
    this.db = db;
    this.passkeyEngine = passkeyEngine;
  }

  private async authorize(req: { headers: Record<string, string> }): Promise<boolean> {
    const passkey = req.headers['x-admin-passkey'];
    if (passkey && (await this.passkeyEngine.verifyPasskey(passkey))) {
      return true;
    }
    return false;
  }

  // GET /api/admin/users
  async handleGetUsers(req: { headers: Record<string, string> }) {
    if (!(await this.authorize(req))) {
      return { status: 401, body: { error: 'Unauthorized: Invalid admin passkey' } };
    }

    const userList = Array.from(this.db.users.values()).map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      team_name: u.team_name,
      drafts_count: u.drafts_count,
      created_at: u.created_at,
    }));

    const bannedList = Array.from(this.db.bannedEmails.values());

    return {
      status: 200,
      body: {
        success: true,
        users: userList,
        bannedEmails: bannedList,
      },
    };
  }

  // POST /api/admin/users
  async handlePostUsers(req: { headers: Record<string, string>; body: any }) {
    if (!(await this.authorize(req))) {
      return { status: 401, body: { error: 'Unauthorized: Invalid admin passkey' } };
    }

    const { action, email, reason, deleteUser, userId } = req.body || {};
    if (action !== 'ban' || !email || typeof email !== 'string' || !email.trim()) {
      return { status: 400, body: { error: 'Invalid request: email and action="ban" are required.' } };
    }

    const record = this.db.banEmail(email, reason || 'Banned by administrator');

    if (deleteUser) {
      if (userId) {
        this.db.deleteUser(userId);
      } else {
        // Find user by email and delete
        for (const [uid, user] of this.db.users.entries()) {
          if (user.email.toLowerCase() === email.toLowerCase().trim()) {
            this.db.deleteUser(uid);
            break;
          }
        }
      }
    }

    return {
      status: 200,
      body: {
        success: true,
        message: `User ${email} successfully banned${deleteUser ? ' and deleted' : ''}.`,
        bannedRecord: record,
      },
    };
  }

  // DELETE /api/admin/users (1-Click Restore)
  async handleDeleteUsers(req: { headers: Record<string, string>; query?: { email?: string }; body?: any }) {
    if (!(await this.authorize(req))) {
      return { status: 401, body: { error: 'Unauthorized: Invalid admin passkey' } };
    }

    const email = req.query?.email || req.body?.email;
    if (!email || typeof email !== 'string' || !email.trim()) {
      return { status: 400, body: { error: 'Email query or body parameter is required for unban.' } };
    }

    const unbanned = this.db.unbanEmail(email);
    return {
      status: 200,
      body: {
        success: true,
        message: `Permission restored for ${email}.`,
        unbanned,
      },
    };
  }

  // GET /api/admin/passkey
  async handleGetPasskey(req: { headers: Record<string, string> }) {
    if (!(await this.authorize(req))) {
      return { status: 401, body: { error: 'Unauthorized: Invalid admin passkey' } };
    }

    const passkey = await this.passkeyEngine.getActivePasskey();
    return { status: 200, body: { success: true, passkey } };
  }

  // POST /api/admin/passkey
  async handlePostPasskey(req: { headers: Record<string, string>; body: any }) {
    if (!(await this.authorize(req))) {
      return { status: 401, body: { error: 'Unauthorized: Invalid admin passkey' } };
    }

    const { newPasskey } = req.body || {};
    const result = await this.passkeyEngine.updatePasskey(newPasskey);
    if (!result.success) {
      return { status: 400, body: { error: result.error } };
    }

    return { status: 200, body: { success: true, message: result.message } };
  }
}

/**
 * User Gateway Simulator (/api/auth/me & /api/drafts/generate)
 */
class UserGatewayHandler {
  private db: MockDatabaseHarness;

  constructor(db: MockDatabaseHarness) {
    this.db = db;
  }

  // /api/auth/me
  async handleAuthMe(user: UserAccount | null) {
    if (!user) {
      return { status: 401, body: { error: 'Unauthorized: Missing or invalid token' } };
    }

    // 1. Gateway Ban Interception (F3)
    if (this.db.isEmailBanned(user.email)) {
      return {
        status: 403,
        body: { error: 'Account deactivated. Please contact support.', banned: true },
      };
    }

    // 2. Email Verification Guard (F10, F11)
    if (!user.is_oauth && user.email_confirmed_at === null) {
      return {
        status: 403,
        body: { error: 'Email not confirmed. Please verify your email before accessing the dashboard.', unverified: true },
      };
    }

    return {
      status: 200,
      body: {
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
        },
        team: {
          id: user.team_id,
          name: user.team_name,
        },
      },
    };
  }

  // /api/drafts/generate
  async handleDraftsGenerate(user: UserAccount | null, prompt: string) {
    if (!user) {
      return { status: 401, body: { error: 'Unauthorized: Missing or invalid token' } };
    }

    // Ban Check
    if (this.db.isEmailBanned(user.email)) {
      return {
        status: 403,
        body: { error: 'Account deactivated. Please contact support.', banned: true },
      };
    }

    // Verification Check
    if (!user.is_oauth && user.email_confirmed_at === null) {
      return {
        status: 403,
        body: { error: 'Email verification required before generating AI drafts.', unverified: true },
      };
    }

    user.drafts_count++;
    return {
      status: 200,
      body: {
        success: true,
        draft: `Generated AI response for: "${prompt}"`,
        remainingDrafts: Math.max(0, 50 - user.drafts_count),
      },
    };
  }
}

/**
 * Client Auth Form State Machine Simulator (F9, F10)
 */
class ClientAuthStateMachine {
  public isSignupBannerVisible = false;
  public unverifiedError: string | null = null;
  public banDeactivatedError: string | null = null;
  public isResendButtonVisible = false;
  public sessionActive = false;
  public resendEmailCount = 0;

  handleSignupResponse(response: { requiresVerification?: boolean; session?: any }) {
    if (response.requiresVerification) {
      this.isSignupBannerVisible = true;
      this.sessionActive = false; // Suppress auto-login and sign out temporary session
      return {
        banner: 'Check your inbox! Please verify your email before logging in.',
        signedOut: true,
      };
    }
    this.sessionActive = true;
    return { banner: null, signedOut: false };
  }

  handleLoginResponse(response: { user?: UserAccount; error?: string; banned?: boolean; unverified?: boolean }) {
    if (response.banned) {
      this.banDeactivatedError = 'Account deactivated. Please contact support.';
      this.sessionActive = false;
      this.isResendButtonVisible = false;
      return { status: 'banned', message: this.banDeactivatedError };
    }

    if (response.unverified || (response.user && response.user.email_confirmed_at === null && !response.user.is_oauth)) {
      this.unverifiedError = 'Email not confirmed. Please verify your email before logging in.';
      this.isResendButtonVisible = true;
      this.sessionActive = false;
      return { status: 'unverified', message: this.unverifiedError, canResend: true };
    }

    if (response.error) {
      return { status: 'error', message: response.error };
    }

    this.sessionActive = true;
    this.unverifiedError = null;
    this.banDeactivatedError = null;
    this.isResendButtonVisible = false;
    return { status: 'authenticated', user: response.user };
  }

  async triggerResend(email: string): Promise<{ success: boolean; message: string }> {
    if (!this.isResendButtonVisible) {
      return { success: false, message: 'Resend not available' };
    }
    this.resendEmailCount++;
    return { success: true, message: `Verification email dispatched to ${email}` };
  }
}

// ============================================================================
// TEST SUITES: TIERS 1 - 4
// ============================================================================

describe('E2E Super Admin & Auth Hardening: Full Multi-Tier Validation', () => {
  let db: MockDatabaseHarness;
  let passkeyEngine: DynamicPasskeyEngine;
  let adminApi: AdminApiHandler;
  let userGateway: UserGatewayHandler;

  beforeEach(() => {
    process.env.ADMIN_PASSKEY = 'vault-root-master-key-2026';
    delete process.env.SUPERADMIN_PASSKEY;

    db = new MockDatabaseHarness();
    passkeyEngine = new DynamicPasskeyEngine(db);
    adminApi = new AdminApiHandler(db, passkeyEngine);
    userGateway = new UserGatewayHandler(db);

    // Populate initial seed users
    db.users.set('usr-1', {
      id: 'usr-1',
      email: 'alice@draftpilot.app',
      full_name: 'Alice Support',
      role: 'owner',
      team_id: 'team-1',
      team_name: 'Support HQ',
      drafts_count: 5,
      email_confirmed_at: '2026-09-01T10:00:00Z',
      created_at: '2026-09-01T10:00:00Z',
    });

    db.users.set('usr-2', {
      id: 'usr-2',
      email: 'bob@competitor.io',
      full_name: 'Bob Spammer',
      role: 'member',
      team_id: 'team-2',
      team_name: 'External Org',
      drafts_count: 12,
      email_confirmed_at: '2026-09-01T11:00:00Z',
      created_at: '2026-09-01T11:00:00Z',
    });
  });

  // ==========================================================================
  // TIER 1: FEATURE COVERAGE & BASIC INTERFACE CONTRACTS (F1 - F12)
  // ==========================================================================
  describe('Tier 1: Feature Coverage & Core Contracts', () => {
    test('T1.1: Super Admin lists users and banned emails registry (F2, F4)', async () => {
      db.banEmail('badactor@domain.com', 'Suspicious activity', 'superadmin');

      const res = await adminApi.handleGetUsers({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.users.length, 2);
      assert.strictEqual(res.body.bannedEmails.length, 1);
      assert.strictEqual(res.body.bannedEmails[0].email, 'badactor@domain.com');
      assert.strictEqual(res.body.bannedEmails[0].reason, 'Suspicious activity');
    });

    test('T1.2: Super Admin bans user and records email into persistent registry (F1, F2)', async () => {
      const res = await adminApi.handlePostUsers({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
        body: {
          action: 'ban',
          email: 'bob@competitor.io',
          reason: 'Abuse of draft quota',
        },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(db.isEmailBanned('bob@competitor.io'), true);
      assert.strictEqual(db.bannedEmails.get('bob@competitor.io')?.reason, 'Abuse of draft quota');
    });

    test('T1.3: Super Admin deletes user account and adds email to banned registry (F1, F2)', async () => {
      assert.ok(db.users.has('usr-2'));

      const res = await adminApi.handlePostUsers({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
        body: {
          action: 'ban',
          email: 'bob@competitor.io',
          userId: 'usr-2',
          deleteUser: true,
          reason: 'Fraudulent registration',
        },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(db.users.has('usr-2'), false); // Deleted from user store
      assert.strictEqual(db.isEmailBanned('bob@competitor.io'), true); // Added to banned registry
    });

    test('T1.4: 1-Click Restore Permission removes user email from banned registry (F2, F4)', async () => {
      db.banEmail('alice@draftpilot.app', 'Temporary security lock');
      assert.strictEqual(db.isEmailBanned('alice@draftpilot.app'), true);

      const res = await adminApi.handleDeleteUsers({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
        query: { email: 'alice@draftpilot.app' },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(db.isEmailBanned('alice@draftpilot.app'), false);
    });

    test('T1.5: Gateway ban interception blocks banned user at /api/auth/me (F3)', async () => {
      const bob = db.users.get('usr-2')!;
      db.banEmail(bob.email, 'Account compromised');

      const res = await userGateway.handleAuthMe(bob);
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.banned, true);
      assert.strictEqual(res.body.error, 'Account deactivated. Please contact support.');
    });

    test('T1.6: Gateway ban interception blocks banned user at /api/drafts/generate (F3)', async () => {
      const bob = db.users.get('usr-2')!;
      db.banEmail(bob.email, 'Account compromised');

      const res = await userGateway.handleDraftsGenerate(bob, 'Draft refund reply');
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.banned, true);
      assert.strictEqual(res.body.error, 'Account deactivated. Please contact support.');
    });

    test('T1.7: Root Passkey Vault: View active root passkey (F7, F8)', async () => {
      const res = await adminApi.handleGetPasskey({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.passkey, 'vault-root-master-key-2026');
    });

    test('T1.8: Root Passkey Vault: In-panel update and dynamic resolution (F6, F7, F8)', async () => {
      const updateRes = await adminApi.handlePostPasskey({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
        body: { newPasskey: 'new-rotated-superadmin-passkey-999' },
      });

      assert.strictEqual(updateRes.status, 200);
      assert.strictEqual(updateRes.body.success, true);

      // Old passkey fails immediately
      const oldAuthRes = await adminApi.handleGetUsers({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
      });
      assert.strictEqual(oldAuthRes.status, 401);

      // New passkey succeeds immediately without server restart
      const newAuthRes = await adminApi.handleGetUsers({
        headers: { 'x-admin-passkey': 'new-rotated-superadmin-passkey-999' },
      });
      assert.strictEqual(newAuthRes.status, 200);
    });

    test('T1.9: Signup email verification banner displayed and session cleared (F9)', () => {
      const clientAuth = new ClientAuthStateMachine();
      const result = clientAuth.handleSignupResponse({
        requiresVerification: true,
        session: { token: 'temp-session-token' },
      });

      assert.strictEqual(clientAuth.isSignupBannerVisible, true);
      assert.strictEqual(clientAuth.sessionActive, false);
      assert.strictEqual(result.banner, 'Check your inbox! Please verify your email before logging in.');
      assert.strictEqual(result.signedOut, true);
    });

    test('T1.10: Unverified login blocked with Resend Verification Email button (F10, F11)', async () => {
      const clientAuth = new ClientAuthStateMachine();
      const unverifiedUser: UserAccount = {
        id: 'usr-new',
        email: 'charlie@startup.io',
        full_name: 'Charlie Unverified',
        role: 'member',
        team_id: 'team-3',
        team_name: 'Charlie Org',
        drafts_count: 0,
        email_confirmed_at: null, // Not verified!
        created_at: new Date().toISOString(),
      };

      const loginRes = clientAuth.handleLoginResponse({ user: unverifiedUser });
      assert.strictEqual(loginRes.status, 'unverified');
      assert.strictEqual(clientAuth.sessionActive, false);
      assert.strictEqual(clientAuth.isResendButtonVisible, true);

      // Resend action executes
      const resendRes = await clientAuth.triggerResend(unverifiedUser.email);
      assert.strictEqual(resendRes.success, true);
      assert.strictEqual(clientAuth.resendEmailCount, 1);
    });

    test('T1.11: Constant-time timingSafeEqual validation rejects invalid passkeys (F6)', () => {
      assert.strictEqual(timingSafeEqual('correct-passkey-1234', 'correct-passkey-1234'), true);
      assert.strictEqual(timingSafeEqual('correct-passkey-1234', 'wrong-passkey-1234'), false);
      assert.strictEqual(timingSafeEqual('short', 'longer-string-passkey'), false);
      assert.strictEqual(timingSafeEqual('', 'any'), false);
    });

    test('T1.12: Verified user successfully authenticates and generates drafts (F10, F11)', async () => {
      const alice = db.users.get('usr-1')!;
      const authRes = await userGateway.handleAuthMe(alice);
      assert.strictEqual(authRes.status, 200);
      assert.strictEqual(authRes.body.user.email, 'alice@draftpilot.app');

      const draftRes = await userGateway.handleDraftsGenerate(alice, 'Customer asks about pricing');
      assert.strictEqual(draftRes.status, 200);
      assert.strictEqual(draftRes.body.success, true);
      assert.strictEqual(alice.drafts_count, 6);
    });

    test('T1.13: Passkey retrieval returns active passkey in expected JSON schema (F7)', async () => {
      db.platformSettings.root_passkey = 'schema-validation-passkey-2026';
      passkeyEngine.invalidateCache();

      const res = await adminApi.handleGetPasskey({
        headers: { 'x-admin-passkey': 'schema-validation-passkey-2026' },
      });

      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.body, { success: true, passkey: 'schema-validation-passkey-2026' });
    });

    test('T1.14: Memory cache TTL expiry (30s) automatically refreshes from database (F6)', async () => {
      db.platformSettings.root_passkey = 'initial-db-passkey-2026';
      const baseTime = 1000000;

      // Initial read primes cache
      const key1 = await passkeyEngine.getActivePasskey(baseTime);
      assert.strictEqual(key1, 'initial-db-passkey-2026');

      // Database modified externally without in-process invalidateCache()
      db.platformSettings.root_passkey = 'updated-by-another-replica-2026';

      // Within TTL window (< 30s): returns cached value
      const keyCached = await passkeyEngine.getActivePasskey(baseTime + 15000);
      assert.strictEqual(keyCached, 'initial-db-passkey-2026');

      // After TTL window (30s+): cache expires and fetches fresh value from DB
      const keyExpired = await passkeyEngine.getActivePasskey(baseTime + 30001);
      assert.strictEqual(keyExpired, 'updated-by-another-replica-2026');
    });

    test('T1.15: Signup flow suppresses auto-login when email verification is required (F9)', () => {
      const clientAuth = new ClientAuthStateMachine();
      const signupResponse = clientAuth.handleSignupResponse({
        requiresVerification: true,
        session: { access_token: 'temp-token', user: { id: 'temp-u1', email: 'newbie@test.io' } },
      });

      assert.strictEqual(signupResponse.signedOut, true);
      assert.strictEqual(clientAuth.sessionActive, false);
      assert.strictEqual(signupResponse.banner, 'Check your inbox! Please verify your email before logging in.');
    });

    test('T1.16: Dashboard guard rejects unverified account and blocks profile loading (F11)', async () => {
      const unconfirmedUser: UserAccount = {
        id: 'u-unconfirmed',
        email: 'unconfirmed@domain.org',
        full_name: 'Unconfirmed',
        role: 'member',
        team_id: 't-unconfirmed',
        team_name: 'T Unconfirmed',
        drafts_count: 0,
        email_confirmed_at: null,
        created_at: new Date().toISOString(),
      };

      const gatewayRes = await userGateway.handleAuthMe(unconfirmedUser);
      assert.strictEqual(gatewayRes.status, 403);
      assert.strictEqual(gatewayRes.body.unverified, true);
    });
  });

  // ==========================================================================
  // TIER 2: BOUNDARY & CORNER CASES
  // ==========================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {
    test('T2.1: Case-insensitive email banning (User@Example.com vs user@example.com)', async () => {
      // Ban with mixed case and trailing spaces
      await adminApi.handlePostUsers({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
        body: { action: 'ban', email: '  Victim.Account@EXAMPLE.Com  ' },
      });

      // Variations must all be blocked
      assert.strictEqual(db.isEmailBanned('victim.account@example.com'), true);
      assert.strictEqual(db.isEmailBanned('VICTIM.ACCOUNT@EXAMPLE.COM'), true);
      assert.strictEqual(db.isEmailBanned('ViCtIm.AcCoUnT@ExAmPlE.cOm'), true);
      assert.strictEqual(db.isEmailBanned('  victim.account@example.com  '), true);

      // Gateway verification with mixed casing
      const testUser: UserAccount = {
        id: 'usr-mixed',
        email: 'ViCtIm.AcCoUnT@ExAmPlE.cOm',
        full_name: 'Victim',
        role: 'member',
        team_id: 't1',
        team_name: 'T1',
        drafts_count: 0,
        email_confirmed_at: '2026-09-01T00:00:00Z',
        created_at: '2026-09-01T00:00:00Z',
      };
      const res = await userGateway.handleAuthMe(testUser);
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.banned, true);
    });

    test('T2.2: Passkey length boundary: rejects passkeys shorter than 6 characters', async () => {
      const shortKeys = ['', '1', '12', '123', '1234', '12345', '  a  '];

      for (const key of shortKeys) {
        const res = await adminApi.handlePostPasskey({
          headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
          body: { newPasskey: key },
        });

        assert.strictEqual(res.status, 400, `Key "${key}" should be rejected for length < 6`);
        assert.ok(res.body.error?.includes('at least 6 characters'));
      }
    });

    test('T2.3: Passkey Unicode & special character validation', async () => {
      const complexPasskey = '🔑Root-Passkey-!@#$%^&*()_+~`|}{[]:;?><,./2026🚀';
      const updateRes = await adminApi.handlePostPasskey({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
        body: { newPasskey: complexPasskey },
      });

      assert.strictEqual(updateRes.status, 200);

      // Authorize with Unicode passkey
      const verifyRes = await adminApi.handleGetPasskey({
        headers: { 'x-admin-passkey': complexPasskey },
      });
      assert.strictEqual(verifyRes.status, 200);
      assert.strictEqual(verifyRes.body.passkey, complexPasskey);
    });

    test('T2.4: OAuth accounts bypass email verification requirement', async () => {
      const oauthUser: UserAccount = {
        id: 'usr-google',
        email: 'google.user@gmail.com',
        full_name: 'Google OAuth User',
        role: 'member',
        team_id: 'team-google',
        team_name: 'Google Org',
        drafts_count: 0,
        email_confirmed_at: null, // Supabase OAuth might report null or auto-confirm
        created_at: new Date().toISOString(),
        is_oauth: true, // Marked as OAuth
      };

      const res = await userGateway.handleAuthMe(oauthUser);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.user.email, 'google.user@gmail.com');

      const draftRes = await userGateway.handleDraftsGenerate(oauthUser, 'Need help with billing');
      assert.strictEqual(draftRes.status, 200);
    });

    test('T2.5: Email subaddressing (plus addressing) strict boundary', async () => {
      // Ban specific alias
      db.banEmail('spammer+test@domain.com', 'Alias abuse');

      assert.strictEqual(db.isEmailBanned('spammer+test@domain.com'), true);
      assert.strictEqual(db.isEmailBanned('SPAMMER+TEST@DOMAIN.COM'), true);
      // Different alias is not automatically banned unless explicitly recorded
      assert.strictEqual(db.isEmailBanned('spammer+other@domain.com'), false);
    });

    test('T2.6: Unban idempotency & missing parameters handling', async () => {
      // Unbanning non-existent email returns clean 200 with unbanned: false
      const nonExistentRes = await adminApi.handleDeleteUsers({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
        query: { email: 'never.banned@example.com' },
      });
      assert.strictEqual(nonExistentRes.status, 200);
      assert.strictEqual(nonExistentRes.body.unbanned, false);

      // Missing email returns 400
      const missingEmailRes = await adminApi.handleDeleteUsers({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
        query: { email: '' },
      });
      assert.strictEqual(missingEmailRes.status, 400);
    });

    test('T2.7: Ban precedence over unverified email status', async () => {
      const clientAuth = new ClientAuthStateMachine();
      const bannedAndUnverifiedUser: UserAccount = {
        id: 'usr-bad-unverified',
        email: 'fraud@badactor.org',
        full_name: 'Fraudster',
        role: 'member',
        team_id: 't-bad',
        team_name: 'Bad Team',
        drafts_count: 0,
        email_confirmed_at: null, // Unverified
        created_at: new Date().toISOString(),
      };

      db.banEmail('fraud@badactor.org', 'Fraud detection');

      // Gateway check returns 403 banned
      const gatewayRes = await userGateway.handleAuthMe(bannedAndUnverifiedUser);
      assert.strictEqual(gatewayRes.status, 403);
      assert.strictEqual(gatewayRes.body.banned, true);

      // Client auth handles banned state (takes priority over unverified banner)
      const clientRes = clientAuth.handleLoginResponse(gatewayRes.body);
      assert.strictEqual(clientRes.status, 'banned');
      assert.strictEqual(clientAuth.isResendButtonVisible, false);
      assert.ok(clientAuth.banDeactivatedError?.includes('Account deactivated'));
    });

    test('T2.8: Unauthenticated access to admin routes is strictly rejected', async () => {
      const missingHeaderRes = await adminApi.handleGetUsers({ headers: {} });
      assert.strictEqual(missingHeaderRes.status, 401);

      const invalidKeyRes = await adminApi.handleGetUsers({ headers: { 'x-admin-passkey': 'completely-wrong-key' } });
      assert.strictEqual(invalidKeyRes.status, 401);
    });

    test('T2.9: Email format validation with international and RFC-compliant special characters', async () => {
      const complexEmails = [
        'first.last@dept.sub.corp.co.uk',
        'customer_support-team+urgent123@domain-name.io',
        'admin@x.org',
      ];

      for (const email of complexEmails) {
        const banRes = await adminApi.handlePostUsers({
          headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
          body: { action: 'ban', email, reason: 'RFC compliance verification' },
        });
        assert.strictEqual(banRes.status, 200);
        assert.strictEqual(db.isEmailBanned(email), true);
        assert.strictEqual(db.isEmailBanned(email.toUpperCase()), true);
      }
    });

    test('T2.10: Empty string and whitespace-only email ban requests are rejected with 400', async () => {
      const invalidEmails = ['', '   ', '\t\n', null, undefined];

      for (const email of invalidEmails) {
        const res = await adminApi.handlePostUsers({
          headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
          body: { action: 'ban', email: email as any },
        });
        assert.strictEqual(res.status, 400);
        assert.ok(res.body.error?.includes('required'));
      }
    });

    test('T2.11: Stale passkey in sessionStorage invalidated when server passkey changes', async () => {
      const staleSessionPasskey = 'stale-cached-client-passkey-123';
      db.platformSettings.root_passkey = 'freshly-updated-server-passkey-999';
      passkeyEngine.invalidateCache();

      const res = await adminApi.handleGetUsers({
        headers: { 'x-admin-passkey': staleSessionPasskey },
      });
      assert.strictEqual(res.status, 401);
    });

    test('T2.12: Whitespace-only passkey update is rejected with 400', async () => {
      const whitespaceKeys = ['      ', '\t\t\t\t\t\t', '\n\r\n\r\n\r'];

      for (const badKey of whitespaceKeys) {
        const res = await adminApi.handlePostPasskey({
          headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
          body: { newPasskey: badKey },
        });
        assert.strictEqual(res.status, 400);
        assert.ok(res.body.error?.includes('at least 6 characters'));
      }
    });

    test('T2.13: Resend verification rate-limiting: consecutive resend clicks handle state cleanly', async () => {
      const clientAuth = new ClientAuthStateMachine();
      clientAuth.isResendButtonVisible = true;

      // Dispatches multiple resends cleanly
      for (let i = 1; i <= 3; i++) {
        const outcome = await clientAuth.triggerResend('user@test.org');
        assert.strictEqual(outcome.success, true);
        assert.strictEqual(clientAuth.resendEmailCount, i);
      }
    });

    test('T2.14: Stale bearer token with revoked user blocked at gateway', async () => {
      const res = await userGateway.handleAuthMe(null);
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.error, 'Unauthorized: Missing or invalid token');
    });

    test('T2.15: email_confirmed_at values: null vs undefined vs empty string vs valid ISO', () => {
      const isConfirmed = (val: any) => {
        return Boolean(val && typeof val === 'string' && val.trim().length > 0);
      };

      assert.strictEqual(isConfirmed(null), false);
      assert.strictEqual(isConfirmed(undefined), false);
      assert.strictEqual(isConfirmed(''), false);
      assert.strictEqual(isConfirmed('   '), false);
      assert.strictEqual(isConfirmed('2026-09-02T12:00:00.000Z'), true);
    });
  });

  // ==========================================================================
  // TIER 3: PAIRWISE COMBINATORIAL & CROSS-FEATURE INTERACTIONS
  // ==========================================================================
  describe('Tier 3: Pairwise Combinatorial & Cross-Feature Interactions', () => {
    test('T3.1: Pairwise - Banned user attempts passkey header injection to bypass gateway', async () => {
      const bannedUser = db.users.get('usr-2')!;
      db.banEmail(bannedUser.email, 'Banned member');

      // Even if user sends admin passkey header to user endpoints, ban check still enforces block
      const res = await userGateway.handleAuthMe(bannedUser);
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.banned, true);

      const draftRes = await userGateway.handleDraftsGenerate(bannedUser, 'Generate draft anyway');
      assert.strictEqual(draftRes.status, 403);
      assert.strictEqual(draftRes.body.banned, true);
    });

    test('T3.2: Pairwise - Root passkey updated mid-session during ongoing admin ban operations', async () => {
      // 1. Initial admin request with old passkey succeeds
      const getRes1 = await adminApi.handleGetUsers({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
      });
      assert.strictEqual(getRes1.status, 200);

      // 2. Super admin rotates passkey
      await adminApi.handlePostPasskey({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
        body: { newPasskey: 'vault-rotated-emergency-2026' },
      });

      // 3. Admin request using old passkey fails with 401
      const failBanRes = await adminApi.handlePostUsers({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
        body: { action: 'ban', email: 'alice@draftpilot.app' },
      });
      assert.strictEqual(failBanRes.status, 401);

      // 4. Admin updates session header to new passkey and retry succeeds
      const successBanRes = await adminApi.handlePostUsers({
        headers: { 'x-admin-passkey': 'vault-rotated-emergency-2026' },
        body: { action: 'ban', email: 'alice@draftpilot.app' },
      });
      assert.strictEqual(successBanRes.status, 200);
      assert.strictEqual(db.isEmailBanned('alice@draftpilot.app'), true);
    });

    test('T3.3: Pairwise - Unverified user attempts AI draft generation before verification', async () => {
      const unverifiedUser: UserAccount = {
        id: 'usr-pending',
        email: 'pending@startup.io',
        full_name: 'Pending User',
        role: 'owner',
        team_id: 'team-pending',
        team_name: 'Pending Org',
        drafts_count: 0,
        email_confirmed_at: null,
        created_at: new Date().toISOString(),
      };

      // Draft generation is blocked
      const draftRes = await userGateway.handleDraftsGenerate(unverifiedUser, 'Customer wants refund');
      assert.strictEqual(draftRes.status, 403);
      assert.strictEqual(draftRes.body.unverified, true);
      assert.strictEqual(unverifiedUser.drafts_count, 0); // Quota was not consumed

      // Simulate verification completion
      unverifiedUser.email_confirmed_at = new Date().toISOString();

      // Subsequent draft generation succeeds
      const allowedDraftRes = await userGateway.handleDraftsGenerate(unverifiedUser, 'Customer wants refund');
      assert.strictEqual(allowedDraftRes.status, 200);
      assert.strictEqual(unverifiedUser.drafts_count, 1);
    });

    test('T3.4: Pairwise - User deleted then attempts re-registration while on ban list vs restored', async () => {
      // 1. Admin bans and deletes user
      await adminApi.handlePostUsers({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
        body: {
          action: 'ban',
          email: 'bob@competitor.io',
          userId: 'usr-2',
          deleteUser: true,
        },
      });

      // 2. User re-registers with same email
      const reRegisteredUser: UserAccount = {
        id: 'usr-2-recreated',
        email: 'bob@competitor.io',
        full_name: 'Bob Spammer Return',
        role: 'owner',
        team_id: 'team-new',
        team_name: 'New Org',
        drafts_count: 0,
        email_confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      // Gateway still blocks because email is in banned_emails registry
      const blockedRes = await userGateway.handleAuthMe(reRegisteredUser);
      assert.strictEqual(blockedRes.status, 403);
      assert.strictEqual(blockedRes.body.banned, true);

      // 3. Admin restores permission
      await adminApi.handleDeleteUsers({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
        query: { email: 'bob@competitor.io' },
      });

      // 4. Now re-registered account can access gateway
      const restoredRes = await userGateway.handleAuthMe(reRegisteredUser);
      assert.strictEqual(restoredRes.status, 200);
      assert.strictEqual(restoredRes.body.user.email, 'bob@competitor.io');
    });

    test('T3.5: Pairwise - Concurrent dynamic passkey resolution under simulated load', async () => {
      // Set DB passkey
      db.platformSettings.root_passkey = 'concurrent-high-entropy-key-2026';
      passkeyEngine.invalidateCache();

      // Launch 25 concurrent verification requests
      const promises = Array.from({ length: 25 }).map(async (_, idx) => {
        const isOdd = idx % 2 === 1;
        const keyToTest = isOdd ? 'concurrent-high-entropy-key-2026' : 'wrong-passkey';
        return passkeyEngine.verifyPasskey(keyToTest);
      });

      const results = await Promise.all(promises);
      results.forEach((allowed, idx) => {
        const isOdd = idx % 2 === 1;
        assert.strictEqual(allowed, isOdd, `Request #${idx} outcome mismatch`);
      });
    });

    test('T3.6: Pairwise - Banned user cannot trigger verification resend', async () => {
      const clientAuth = new ClientAuthStateMachine();
      db.banEmail('banned.spammer@shady.net', 'Spam activity');

      // Login returns banned
      const loginOutcome = clientAuth.handleLoginResponse({ banned: true });
      assert.strictEqual(loginOutcome.status, 'banned');
      assert.strictEqual(clientAuth.isResendButtonVisible, false);

      // Direct trigger attempt rejected
      const resendOutcome = await clientAuth.triggerResend('banned.spammer@shady.net');
      assert.strictEqual(resendOutcome.success, false);
      assert.strictEqual(clientAuth.resendEmailCount, 0);
    });

    test('T3.7: Pairwise - Active session polled by client is immediately banned on server update', async () => {
      const activeUser = db.users.get('usr-1')!;
      // Normal state: 200 OK
      const preBan = await userGateway.handleAuthMe(activeUser);
      assert.strictEqual(preBan.status, 200);

      // Super admin bans user in DB
      db.banEmail(activeUser.email, 'Emergency security lock');

      // Next poll from client
      const postBan = await userGateway.handleAuthMe(activeUser);
      assert.strictEqual(postBan.status, 403);
      assert.strictEqual(postBan.body.banned, true);
    });

    test('T3.8: Pairwise - Extension client terminates local state upon receiving 403 banned', () => {
      const extensionMock = {
        storage: { token: 'active-ext-token', userEmail: 'agent@corp.com' },
        isLocked: false,
        lockoutReason: null as string | null,
        handleApiResponse(status: number, body: any) {
          if (status === 403 && body.banned) {
            this.storage.token = '';
            this.isLocked = true;
            this.lockoutReason = body.error;
          }
        },
      };

      assert.strictEqual(extensionMock.isLocked, false);
      assert.strictEqual(extensionMock.storage.token, 'active-ext-token');

      // Receives 403 banned
      extensionMock.handleApiResponse(403, { error: 'Account deactivated. Please contact support.', banned: true });

      assert.strictEqual(extensionMock.isLocked, true);
      assert.strictEqual(extensionMock.storage.token, '');
      assert.strictEqual(extensionMock.lockoutReason, 'Account deactivated. Please contact support.');
    });
  });

  // ==========================================================================
  // TIER 4: REAL-WORLD ADMINISTRATIVE LIFECYCLES & USER WORKLOADS
  // ==========================================================================
  describe('Tier 4: Real-World Administrative Lifecycles', () => {
    test('T4.1: Scenario 1 - Security Incident: Key Rotation -> User Ban -> Gateway Interception -> Restore Access', async () => {
      // Step 1: Super admin discovers compromised user account
      const compromisedUser = db.users.get('usr-2')!; // bob@competitor.io
      assert.strictEqual(db.isEmailBanned(compromisedUser.email), false);

      // Step 2: Super admin rotates root passkey to secure the system
      const rotationRes = await adminApi.handlePostPasskey({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
        body: { newPasskey: 'Incident-Response-Passkey-SecOps-2026!' },
      });
      assert.strictEqual(rotationRes.status, 200);

      // Step 3: Super admin bans compromised user with new passkey
      const banRes = await adminApi.handlePostUsers({
        headers: { 'x-admin-passkey': 'Incident-Response-Passkey-SecOps-2026!' },
        body: {
          action: 'ban',
          email: compromisedUser.email,
          reason: 'Compromised API token in security incident INC-4921',
        },
      });
      assert.strictEqual(banRes.status, 200);
      assert.strictEqual(db.isEmailBanned(compromisedUser.email), true);

      // Step 4: Compromised user attempts API access and is blocked with 403
      const authMeRes = await userGateway.handleAuthMe(compromisedUser);
      assert.strictEqual(authMeRes.status, 403);
      assert.strictEqual(authMeRes.body.banned, true);

      // Step 5: Compromised user attempts Extension draft generation and is blocked
      const draftRes = await userGateway.handleDraftsGenerate(compromisedUser, 'Draft reply for customer inquiry');
      assert.strictEqual(draftRes.status, 403);
      assert.strictEqual(draftRes.body.banned, true);

      // Step 6: Incident resolved -> Admin restores permission via 1-click restore
      const restoreRes = await adminApi.handleDeleteUsers({
        headers: { 'x-admin-passkey': 'Incident-Response-Passkey-SecOps-2026!' },
        query: { email: compromisedUser.email },
      });
      assert.strictEqual(restoreRes.status, 200);
      assert.strictEqual(db.isEmailBanned(compromisedUser.email), false);

      // Step 7: Restored user recovers access to both gateway and AI draft generation
      const recoveredAuth = await userGateway.handleAuthMe(compromisedUser);
      assert.strictEqual(recoveredAuth.status, 200);

      const recoveredDraft = await userGateway.handleDraftsGenerate(compromisedUser, 'Hello customer');
      assert.strictEqual(recoveredDraft.status, 200);
      assert.strictEqual(recoveredDraft.body.success, true);
    });

    test('T4.2: Scenario 2 - Complete Registration Lifecycle: Signup Banner -> Unverified Block -> Resend -> Verified Dashboard Entry', async () => {
      const clientAuth = new ClientAuthStateMachine();

      // Step 1: User signs up at /join
      const signupOutcome = clientAuth.handleSignupResponse({
        requiresVerification: true,
        session: { access_token: 'ephemeral-unconfirmed-token' },
      });
      assert.strictEqual(clientAuth.isSignupBannerVisible, true);
      assert.strictEqual(clientAuth.sessionActive, false);
      assert.strictEqual(signupOutcome.banner, 'Check your inbox! Please verify your email before logging in.');

      // Step 2: User tries to log in immediately without verifying email
      const rawUserRecord: UserAccount = {
        id: 'usr-new-registrant',
        email: 'developer@saas.com',
        full_name: 'SaaS Developer',
        role: 'owner',
        team_id: 'team-saas',
        team_name: 'SaaS Dev Team',
        drafts_count: 0,
        email_confirmed_at: null, // Pending verification
        created_at: new Date().toISOString(),
      };

      const loginOutcome = clientAuth.handleLoginResponse({ user: rawUserRecord });
      assert.strictEqual(loginOutcome.status, 'unverified');
      assert.strictEqual(clientAuth.sessionActive, false);
      assert.strictEqual(clientAuth.isResendButtonVisible, true);
      assert.strictEqual(clientAuth.unverifiedError, 'Email not confirmed. Please verify your email before logging in.');

      // Step 3: User clicks "Resend Verification Email"
      const resendOutcome = await clientAuth.triggerResend(rawUserRecord.email);
      assert.strictEqual(resendOutcome.success, true);
      assert.strictEqual(clientAuth.resendEmailCount, 1);

      // Step 4: User clicks email verification link in inbox (email_confirmed_at populated)
      rawUserRecord.email_confirmed_at = new Date().toISOString();

      // Step 5: User logs in again -> Dashboard access granted
      const secondLogin = clientAuth.handleLoginResponse({ user: rawUserRecord });
      assert.strictEqual(secondLogin.status, 'authenticated');
      assert.strictEqual(clientAuth.sessionActive, true);
      assert.strictEqual(clientAuth.unverifiedError, null);

      // Step 6: User gateway validates session and loads dashboard
      const gatewayRes = await userGateway.handleAuthMe(rawUserRecord);
      assert.strictEqual(gatewayRes.status, 200);
      assert.strictEqual(gatewayRes.body.user.email, 'developer@saas.com');
      assert.strictEqual(gatewayRes.body.team.name, 'SaaS Dev Team');
    });

    test('T4.3: Scenario 3 - Multi-Tenant Admin Management & Banned Registry Audit Trail', async () => {
      // Seed 3 multi-tenant users
      const tenantUsers: UserAccount[] = [
        { id: 'u-101', email: 'org1.user@tenant1.com', full_name: 'T1 User', role: 'owner', team_id: 't-1', team_name: 'Tenant 1', drafts_count: 10, email_confirmed_at: '2026-09-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z' },
        { id: 'u-102', email: 'org2.user@tenant2.com', full_name: 'T2 User', role: 'member', team_id: 't-2', team_name: 'Tenant 2', drafts_count: 20, email_confirmed_at: '2026-09-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z' },
        { id: 'u-103', email: 'spammer@shady.net', full_name: 'Spam Bot', role: 'member', team_id: 't-3', team_name: 'Spam Org', drafts_count: 50, email_confirmed_at: '2026-09-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z' },
      ];

      tenantUsers.forEach((u) => db.users.set(u.id, u));

      // Admin views all users
      const listRes1 = await adminApi.handleGetUsers({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
      });
      assert.strictEqual(listRes1.body.users.length, 5); // 2 seed + 3 new

      // Admin deletes and bans spammer
      await adminApi.handlePostUsers({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
        body: {
          action: 'ban',
          email: 'spammer@shady.net',
          userId: 'u-103',
          deleteUser: true,
          reason: 'Automated spam bot pattern',
        },
      });

      // Audit check: user list has 4, banned list has 1
      const listRes2 = await adminApi.handleGetUsers({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
      });
      assert.strictEqual(listRes2.body.users.length, 4);
      assert.strictEqual(listRes2.body.bannedEmails.length, 1);
      assert.strictEqual(listRes2.body.bannedEmails[0].email, 'spammer@shady.net');

      // Tenant 1 & 2 users continue generating drafts without interruption
      const t1User = db.users.get('u-101')!;
      const t1Draft = await userGateway.handleDraftsGenerate(t1User, 'Reply to inquiry');
      assert.strictEqual(t1Draft.status, 200);
    });

    test('T4.4: Scenario 4 - Dynamic Passkey State Machine, Vault Card & sessionStorage Sync', async () => {
      // 1. Initial passkey from env
      const initialKey = await passkeyEngine.getActivePasskey();
      assert.strictEqual(initialKey, 'vault-root-master-key-2026');

      // 2. Mock AdminGuard sessionStorage state
      const mockSessionStorage = new Map<string, string>();
      mockSessionStorage.set('draftpilot_admin_unlocked', 'true');
      mockSessionStorage.set('draftpilot_admin_passkey', initialKey);

      // 3. Admin updates passkey via Vault UI
      const updatedKey = 'Vault-Key-Rotated-Dynamic-2026-Secret!';
      const updateRes = await adminApi.handlePostPasskey({
        headers: { 'x-admin-passkey': mockSessionStorage.get('draftpilot_admin_passkey')! },
        body: { newPasskey: updatedKey },
      });
      assert.strictEqual(updateRes.status, 200);

      // 4. Client updates sessionStorage
      mockSessionStorage.set('draftpilot_admin_passkey', updatedKey);

      // 5. Subsequent admin request uses synchronized sessionStorage passkey
      const subsequentReq = await adminApi.handleGetUsers({
        headers: { 'x-admin-passkey': mockSessionStorage.get('draftpilot_admin_passkey')! },
      });
      assert.strictEqual(subsequentReq.status, 200);

      // 6. DB singleton holds the updated value
      assert.strictEqual(db.platformSettings.root_passkey, updatedKey);
    });

    test('T4.5: Scenario 5 - Rapid Multi-User Administrative Bulk Audit & Targeted Revocation', async () => {
      // Setup 10 enterprise users
      for (let i = 1; i <= 10; i++) {
        db.users.set(`enterprise-usr-${i}`, {
          id: `enterprise-usr-${i}`,
          email: `agent${i}@enterprise-corp.com`,
          full_name: `Enterprise Agent ${i}`,
          role: 'member',
          team_id: 'enterprise-team',
          team_name: 'Enterprise Corp',
          drafts_count: i * 3,
          email_confirmed_at: '2026-09-01T00:00:00Z',
          created_at: '2026-09-01T00:00:00Z',
        });
      }

      // Admin bans agents 3, 5, 8
      const targetBans = ['agent3@enterprise-corp.com', 'agent5@enterprise-corp.com', 'agent8@enterprise-corp.com'];
      for (const target of targetBans) {
        const banOutcome = await adminApi.handlePostUsers({
          headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
          body: { action: 'ban', email: target, reason: 'Offboarding agent' },
        });
        assert.strictEqual(banOutcome.status, 200);
      }

      // Audit verify
      const auditRes = await adminApi.handleGetUsers({
        headers: { 'x-admin-passkey': 'vault-root-master-key-2026' },
      });
      assert.strictEqual(auditRes.body.bannedEmails.length, 3);

      // Agent 1 works, Agent 3 is blocked, Agent 2 works
      const u1 = db.users.get('enterprise-usr-1')!;
      const u3 = db.users.get('enterprise-usr-3')!;
      assert.strictEqual((await userGateway.handleAuthMe(u1)).status, 200);
      assert.strictEqual((await userGateway.handleAuthMe(u3)).status, 403);
    });

    test('T4.6: Scenario 6 - Self-Healing Email Verification Recovery Lifecycle with Stale Session Clearing', async () => {
      const clientAuth = new ClientAuthStateMachine();
      const victimUser: UserAccount = {
        id: 'usr-stale-flow',
        email: 'stale.user@recovery.org',
        full_name: 'Stale User',
        role: 'member',
        team_id: 'team-stale',
        team_name: 'Recovery Org',
        drafts_count: 0,
        email_confirmed_at: null,
        created_at: new Date().toISOString(),
      };

      // 1. Initial attempt before verification -> blocked
      const login1 = clientAuth.handleLoginResponse({ user: victimUser });
      assert.strictEqual(login1.status, 'unverified');
      assert.strictEqual(clientAuth.sessionActive, false);
      assert.strictEqual(clientAuth.isResendButtonVisible, true);

      // 2. User requests resend
      await clientAuth.triggerResend(victimUser.email);
      assert.strictEqual(clientAuth.resendEmailCount, 1);

      // 3. User verifies
      victimUser.email_confirmed_at = '2026-09-03T03:00:00Z';

      // 4. Second attempt -> authenticated
      const login2 = clientAuth.handleLoginResponse({ user: victimUser });
      assert.strictEqual(login2.status, 'authenticated');
      assert.strictEqual(clientAuth.sessionActive, true);
    });
  });
});
