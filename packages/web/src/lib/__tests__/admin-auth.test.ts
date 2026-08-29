import { test, describe } from 'node:test';
import assert from 'node:assert';
import { verifySuperAdmin } from '../admin-auth.ts';

describe('P0-Finding 1: Superadmin API Route Guard (verifySuperAdmin)', () => {
  test('returns 401 when Authorization header is missing', async () => {
    const req = new Request('http://localhost:3000/api/admin/metrics', {
      method: 'GET',
    });

    const result = await verifySuperAdmin(req);
    assert.strictEqual(result.authorized, false);
    assert.ok(result.response);
    assert.strictEqual(result.response.status, 401);

    const body = await result.response.json();
    assert.ok(body.error.includes('Missing or invalid Authorization header'));
  });

  test('returns 401 when Authorization header is not Bearer', async () => {
    const req = new Request('http://localhost:3000/api/admin/workspaces', {
      method: 'GET',
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });

    const result = await verifySuperAdmin(req);
    assert.strictEqual(result.authorized, false);
    assert.strictEqual(result.response?.status, 401);

    const body = await result.response?.json();
    assert.ok(body.error.includes('Missing or invalid Authorization header'));
  });

  test('returns 401 when Bearer token is empty', async () => {
    const req = new Request('http://localhost:3000/api/admin/metrics', {
      method: 'GET',
      headers: { Authorization: 'Bearer ' },
    });

    const result = await verifySuperAdmin(req);
    assert.strictEqual(result.authorized, false);
    assert.strictEqual(result.response?.status, 401);
  });

  test('returns 401 when token is invalid or expired', async () => {
    const req = new Request('http://localhost:3000/api/admin/metrics', {
      method: 'GET',
      headers: { Authorization: 'Bearer fake-invalid-token-12345' },
    });

    const result = await verifySuperAdmin(req);
    assert.strictEqual(result.authorized, false);
    assert.strictEqual(result.response?.status, 401);

    const body = await result.response?.json();
    assert.ok(body.error.includes('Invalid or expired token'));
  });
});
