import { test, describe } from 'node:test';
import assert from 'node:assert';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import { verifySuperAdmin, supabaseAdmin } from '../admin-auth.ts';

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

  test('authorizes directly when valid x-admin-passkey header is provided', async () => {
    const req = new Request('http://localhost:3000/api/admin/ai-config', {
      method: 'GET',
      headers: { 'x-admin-passkey': 'draftpilot-root-2026' },
    });

    const result = await verifySuperAdmin(req);
    assert.strictEqual(result.authorized, true);
    assert.strictEqual(result.response, undefined);
  });

  test('authorizes with alternative root passkeys', async () => {
    const req = new Request('http://localhost:3000/api/admin/billing', {
      method: 'GET',
      headers: { 'x-admin-passkey': 'admin2026' },
    });

    const result = await verifySuperAdmin(req);
    assert.strictEqual(result.authorized, true);
  });

  test('falls back to token auth when x-admin-passkey is invalid', async () => {
    const req = new Request('http://localhost:3000/api/admin/workspaces', {
      method: 'GET',
      headers: { 'x-admin-passkey': 'invalid-passkey-xyz' },
    });

    const result = await verifySuperAdmin(req);
    assert.strictEqual(result.authorized, false);
    assert.strictEqual(result.response?.status, 401);
  });

  test('supabaseAdmin is resiliently initialized as a Supabase client', () => {
    assert.ok(supabaseAdmin);
    assert.strictEqual(typeof supabaseAdmin.from, 'function');
    assert.strictEqual(typeof supabaseAdmin.auth.getUser, 'function');
  });
});
