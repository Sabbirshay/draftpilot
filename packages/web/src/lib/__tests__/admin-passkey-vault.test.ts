import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import {
  verifySuperAdmin,
  getActiveRootPasskey,
  setCachedRootPasskey,
  clearCachedRootPasskey,
  timingSafeEqual,
  supabaseAdmin,
} from '../admin-auth.ts';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import { GET, POST } from '../../app/api/admin/passkey/route.ts';

describe('Milestone 2: Root Passkey Vault & Dynamic Platform Settings', () => {
  const originalAdminPasskey = process.env.ADMIN_PASSKEY;
  const originalSuperadminPasskey = process.env.SUPERADMIN_PASSKEY;

  beforeEach(() => {
    clearCachedRootPasskey();
    delete process.env.ADMIN_PASSKEY;
    delete process.env.SUPERADMIN_PASSKEY;
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
  });

  // ─────────────────────────────────────────────────────────────
  // 1. Timing-Safe Comparison Engine
  // ─────────────────────────────────────────────────────────────
  describe('timingSafeEqual', () => {
    test('returns true for identical ASCII strings', () => {
      assert.strictEqual(timingSafeEqual('vault-secret-key-123', 'vault-secret-key-123'), true);
    });

    test('returns true for identical UTF-8 / unicode strings', () => {
      assert.strictEqual(timingSafeEqual('root-🔑-passkey-2026', 'root-🔑-passkey-2026'), true);
    });

    test('returns false for different length strings', () => {
      assert.strictEqual(timingSafeEqual('short', 'longer-string'), false);
      assert.strictEqual(timingSafeEqual('secret1', 'secret12'), false);
    });

    test('returns false for equal length but different characters', () => {
      assert.strictEqual(timingSafeEqual('pass1234', 'pass1235'), false);
      assert.strictEqual(timingSafeEqual('abcdefgh', 'abcdEfgh'), false);
    });

    test('returns false for non-string inputs', () => {
      // @ts-ignore
      assert.strictEqual(timingSafeEqual(null, 'test'), false);
      // @ts-ignore
      assert.strictEqual(timingSafeEqual('test', undefined), false);
      // @ts-ignore
      assert.strictEqual(timingSafeEqual(12345, 12345), false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Dynamic In-Memory Cache & Resolution Hierarchy
  // ─────────────────────────────────────────────────────────────
  describe('getActiveRootPasskey & Cache Invalidation', () => {
    test('resolves to fallback ADMIN_PASSKEY env var when DB and cache are empty', async () => {
      process.env.ADMIN_PASSKEY = 'env-passkey-alpha-99';
      const resolved = await getActiveRootPasskey();
      assert.strictEqual(resolved, 'env-passkey-alpha-99');
    });

    test('resolves to fallback SUPERADMIN_PASSKEY when ADMIN_PASSKEY is not set', async () => {
      process.env.SUPERADMIN_PASSKEY = 'backup-superadmin-env-42';
      const resolved = await getActiveRootPasskey();
      assert.strictEqual(resolved, 'backup-superadmin-env-42');
    });

    test('setCachedRootPasskey immediately overrides resolution without waiting for DB or TTL', async () => {
      process.env.ADMIN_PASSKEY = 'old-env-passkey';
      setCachedRootPasskey('new-dynamically-set-passkey-888');

      const resolved = await getActiveRootPasskey();
      assert.strictEqual(resolved, 'new-dynamically-set-passkey-888');
    });

    test('clearCachedRootPasskey purges in-memory cache and re-evaluates fallback', async () => {
      setCachedRootPasskey('temporary-passkey');
      assert.strictEqual(await getActiveRootPasskey(), 'temporary-passkey');

      clearCachedRootPasskey();
      process.env.ADMIN_PASSKEY = 'restored-env-key';
      assert.strictEqual(await getActiveRootPasskey(), 'restored-env-key');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. GET /api/admin/passkey Endpoint
  // ─────────────────────────────────────────────────────────────
  describe('GET /api/admin/passkey', () => {
    test('rejects unauthorized request with 401 when no auth headers are provided', async () => {
      process.env.ADMIN_PASSKEY = 'valid-root-passkey-2026';
      const req = new Request('http://localhost:3000/api/admin/passkey', {
        method: 'GET',
      });

      const res = await GET(req as any);
      assert.strictEqual(res.status, 401);

      const body = await res.json();
      assert.ok(body.error);
    });

    test('rejects request with invalid passkey header with 401', async () => {
      process.env.ADMIN_PASSKEY = 'valid-root-passkey-2026';
      const req = new Request('http://localhost:3000/api/admin/passkey', {
        method: 'GET',
        headers: {
          'x-admin-passkey': 'wrong-passkey',
        },
      });

      const res = await GET(req as any);
      assert.strictEqual(res.status, 401);
    });

    test('returns active passkey when authorized via x-admin-passkey', async () => {
      process.env.ADMIN_PASSKEY = 'active-super-vault-key-2026';
      const req = new Request('http://localhost:3000/api/admin/passkey', {
        method: 'GET',
        headers: {
          'x-admin-passkey': 'active-super-vault-key-2026',
        },
      });

      const res = await GET(req as any);
      assert.strictEqual(res.status, 200);

      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.passkey, 'active-super-vault-key-2026');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. POST /api/admin/passkey Endpoint
  // ─────────────────────────────────────────────────────────────
  describe('POST /api/admin/passkey', () => {
    test('rejects unauthorized request with 401', async () => {
      process.env.ADMIN_PASSKEY = 'master-secret-key-123';
      const req = new Request('http://localhost:3000/api/admin/passkey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPasskey: 'brand-new-passkey-789' }),
      });

      const res = await POST(req as any);
      assert.strictEqual(res.status, 401);
    });

    test('rejects passkeys shorter than 6 characters with 400 Bad Request', async () => {
      process.env.ADMIN_PASSKEY = 'master-secret-key-123';
      const shortAttempts = ['12345', 'abc', '', '   '];

      for (const attempt of shortAttempts) {
        const req = new Request('http://localhost:3000/api/admin/passkey', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-passkey': 'master-secret-key-123',
          },
          body: JSON.stringify({ newPasskey: attempt }),
        });

        const res = await POST(req as any);
        assert.strictEqual(res.status, 400);

        const body = await res.json();
        assert.ok(body.error.includes('at least 6 characters'));
      }
    });

    test('updates passkey, invalidates cache, and returns success 200', async () => {
      process.env.ADMIN_PASSKEY = 'initial-auth-key-000';
      const updatedPasskey = 'updated-production-vault-key-2026';

      const req = new Request('http://localhost:3000/api/admin/passkey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passkey': 'initial-auth-key-000',
        },
        body: JSON.stringify({ newPasskey: updatedPasskey }),
      });

      const res = await POST(req as any);
      assert.strictEqual(res.status, 200);

      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(body.message.includes('updated dynamically'));

      // In-memory cache should immediately reflect the new passkey
      const activeKey = await getActiveRootPasskey();
      assert.strictEqual(activeKey, updatedPasskey);
    });

    test('authorizes subsequent verifySuperAdmin requests with new passkey and rejects old passkey', async () => {
      process.env.ADMIN_PASSKEY = 'stage1-passkey-111';

      // 1. Verify initial passkey works
      const initialReq = new Request('http://localhost:3000/api/admin/metrics', {
        method: 'GET',
        headers: { 'x-admin-passkey': 'stage1-passkey-111' },
      });
      const initialAuth = await verifySuperAdmin(initialReq);
      assert.strictEqual(initialAuth.authorized, true);

      // 2. Perform passkey update via POST route
      const updateReq = new Request('http://localhost:3000/api/admin/passkey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passkey': 'stage1-passkey-111',
        },
        body: JSON.stringify({ newPasskey: 'stage2-new-passkey-222' }),
      });
      const updateRes = await POST(updateReq as any);
      assert.strictEqual(updateRes.status, 200);

      // 3. New passkey should authorize immediately
      const newAuthReq = new Request('http://localhost:3000/api/admin/metrics', {
        method: 'GET',
        headers: { 'x-admin-passkey': 'stage2-new-passkey-222' },
      });
      const newAuth = await verifySuperAdmin(newAuthReq);
      assert.strictEqual(newAuth.authorized, true);

      // 4. Old passkey must now be rejected
      const oldAuthReq = new Request('http://localhost:3000/api/admin/metrics', {
        method: 'GET',
        headers: { 'x-admin-passkey': 'stage1-passkey-111' },
      });
      const oldAuth = await verifySuperAdmin(oldAuthReq);
      assert.strictEqual(oldAuth.authorized, false);
      assert.strictEqual(oldAuth.response?.status, 401);
    });
  });
});
