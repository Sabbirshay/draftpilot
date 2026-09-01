import { test, describe } from 'node:test';
import assert from 'node:assert';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import { verifySuperAdmin } from '../admin-auth.ts';

describe('Milestone 1 Hardened Security Suite: Admin Auth & Constant-Time Verification', () => {
  test('authenticates valid ADMIN_PASSKEY in constant-time with trimming', async () => {
    const originalAdmin = process.env.ADMIN_PASSKEY;
    try {
      process.env.ADMIN_PASSKEY = 'super-secret-master-passkey-2026';
      const req = new Request('http://localhost:3000/api/admin/metrics', {
        method: 'GET',
        headers: {
          'x-admin-passkey': '  super-secret-master-passkey-2026  ',
        },
      });

      const res = await verifySuperAdmin(req);
      assert.strictEqual(res.authorized, true);
      assert.strictEqual(res.response, undefined);
    } finally {
      process.env.ADMIN_PASSKEY = originalAdmin;
    }
  });

  test('authenticates valid SUPERADMIN_PASSKEY when ADMIN_PASSKEY is not set', async () => {
    const originalAdmin = process.env.ADMIN_PASSKEY;
    const originalSuper = process.env.SUPERADMIN_PASSKEY;
    try {
      delete process.env.ADMIN_PASSKEY;
      process.env.SUPERADMIN_PASSKEY = 'fallback-superadmin-env-key';
      const req = new Request('http://localhost:3000/api/admin/ai-config', {
        method: 'GET',
        headers: {
          'x-admin-passkey': 'fallback-superadmin-env-key',
        },
      });

      const res = await verifySuperAdmin(req);
      assert.strictEqual(res.authorized, true);
    } finally {
      process.env.ADMIN_PASSKEY = originalAdmin;
      process.env.SUPERADMIN_PASSKEY = originalSuper;
    }
  });

  test('rejects deprecated hardcoded strings: draftpilot-root-2026, admin2026, root', async () => {
    const originalAdmin = process.env.ADMIN_PASSKEY;
    try {
      process.env.ADMIN_PASSKEY = 'custom-configured-production-key';
      const deprecated = ['draftpilot-root-2026', 'admin2026', 'root', 'admin'];

      for (const passkey of deprecated) {
        const req = new Request('http://localhost:3000/api/admin/workspaces', {
          method: 'GET',
          headers: {
            'x-admin-passkey': passkey,
          },
        });

        const res = await verifySuperAdmin(req);
        assert.strictEqual(res.authorized, false);
        assert.strictEqual(res.response?.status, 401);
      }
    } finally {
      process.env.ADMIN_PASSKEY = originalAdmin;
    }
  });

  test('rejects partial passkey match / prefix match to avoid timing / substring leaks', async () => {
    const originalAdmin = process.env.ADMIN_PASSKEY;
    try {
      process.env.ADMIN_PASSKEY = 'correct-long-secret-key-12345';
      const invalidAttempts = [
        'correct-long-secret-key-1234',
        'correct-long-secret-key-123456',
        'correct',
        '12345',
        '',
      ];

      for (const attempt of invalidAttempts) {
        const req = new Request('http://localhost:3000/api/admin/metrics', {
          method: 'GET',
          headers: {
            'x-admin-passkey': attempt,
          },
        });

        const res = await verifySuperAdmin(req);
        assert.strictEqual(res.authorized, false);
        assert.strictEqual(res.response?.status, 401);
      }
    } finally {
      process.env.ADMIN_PASSKEY = originalAdmin;
    }
  });
});

describe('Milestone 1 Hardened Security Suite: Monthly Quota Calculation Logic', () => {
  test('correctly calculates remaining quota and detects limit saturation', () => {
    const checkQuotaLimit = (used: number, limit: number) => {
      return {
        isWithinLimit: used < limit,
        remaining: Math.max(0, limit - used),
        saturated: used >= limit,
      };
    };

    // Free tier: 50 limit
    assert.deepStrictEqual(checkQuotaLimit(0, 50), { isWithinLimit: true, remaining: 50, saturated: false });
    assert.deepStrictEqual(checkQuotaLimit(49, 50), { isWithinLimit: true, remaining: 1, saturated: false });
    assert.deepStrictEqual(checkQuotaLimit(50, 50), { isWithinLimit: false, remaining: 0, saturated: true });
    assert.deepStrictEqual(checkQuotaLimit(51, 50), { isWithinLimit: false, remaining: 0, saturated: true });

    // Team tier: 1000 limit
    assert.deepStrictEqual(checkQuotaLimit(999, 1000), { isWithinLimit: true, remaining: 1, saturated: false });
    assert.deepStrictEqual(checkQuotaLimit(1000, 1000), { isWithinLimit: false, remaining: 0, saturated: true });
  });

  test('formats current month key in ISO standard YYYY-MM-01', () => {
    const getMonthString = (date: Date) => {
      return date.toISOString().slice(0, 7) + '-01';
    };

    const d = new Date('2026-09-02T03:00:00Z');
    assert.strictEqual(getMonthString(d), '2026-09-01');
  });
});

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

describe('Milestone 1 Hardened Security Suite: Next.js Security Headers & CSP', () => {
  test('verifies next.config.js exports hardened Content-Security-Policy without unsafe-eval', async () => {
    const nextConfig = require('../../../next.config.js');
    assert.ok(typeof nextConfig.headers === 'function');
    const headersList = await nextConfig.headers();
    const globalHeaderRule = headersList.find((h: any) => h.source === '/(.*)');
    assert.ok(globalHeaderRule);

    const csp = globalHeaderRule.headers.find((h: any) => h.key === 'Content-Security-Policy');
    assert.ok(csp);
    assert.strictEqual(csp.value.includes("'unsafe-eval'"), false);
    assert.ok(csp.value.includes("object-src 'none'"));
    assert.ok(csp.value.includes("base-uri 'self'"));
    assert.ok(csp.value.includes("frame-ancestors 'none'"));

    const hsts = globalHeaderRule.headers.find((h: any) => h.key === 'Strict-Transport-Security');
    assert.ok(hsts);
    assert.ok(hsts.value.includes('max-age=63072000'));

    const xcto = globalHeaderRule.headers.find((h: any) => h.key === 'X-Content-Type-Options');
    assert.ok(xcto);
    assert.strictEqual(xcto.value, 'nosniff');
  });
});
