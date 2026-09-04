/// <reference types="node" />
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
// @ts-ignore - Node --experimental-strip-types requires explicit extension
import { NextRequest } from 'next/server.js';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import {
  middleware,
  config,
  timingSafeEqual,
  getConfiguredBypassSecrets,
  getConfiguredBypassSecret,
  isAuthorizedAutomationBypass,
  AUTOMATION_BYPASS_HEADERS,
  AUTOMATION_BYPASS_COOKIES,
} from '../middleware.ts';

describe('Vercel BotID Middleware & Authorized Automation Bypass (R1 & R2)', () => {
  const TEST_SECRET = 'dp_test_automation_bypass_sec_99a8b7c6';
  const VERCEL_SECRET = 'vercel_sec_automation_bypass_alpha_1';
  const AGENT_SECRET = 'agent_sec_token_hermes_audit_2';
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    delete process.env.AGENT_BYPASS_TOKEN;
    delete process.env.AUTOMATION_BYPASS_SECRET;
    delete process.env.BOTID_BYPASS_SECRET;
    delete process.env.AUTOMATION_BYPASS_TOKEN;
  });

  afterEach(() => {
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = originalEnv.VERCEL_AUTOMATION_BYPASS_SECRET;
    process.env.AGENT_BYPASS_TOKEN = originalEnv.AGENT_BYPASS_TOKEN;
    process.env.AUTOMATION_BYPASS_SECRET = originalEnv.AUTOMATION_BYPASS_SECRET;
    process.env.BOTID_BYPASS_SECRET = originalEnv.BOTID_BYPASS_SECRET;
    process.env.AUTOMATION_BYPASS_TOKEN = originalEnv.AUTOMATION_BYPASS_TOKEN;
  });

  // =========================================================================
  // 1. ROUTE SCOPING & MATCHER CONTRACT
  // =========================================================================
  describe('1. Route Scoping & Matcher Configuration', () => {
    test('matcher is explicitly and strictly scoped to /login and /join only', () => {
      assert.ok(Array.isArray(config.matcher), 'matcher should be an array');
      assert.strictEqual(config.matcher.length, 2, 'matcher must have exactly 2 routes');
      assert.ok(config.matcher.includes('/login'), 'matcher must include /login');
      assert.ok(config.matcher.includes('/join'), 'matcher must include /join');
      assert.ok(!config.matcher.includes('/'), 'matcher must NOT include public landing page /');
      assert.ok(!config.matcher.includes('/dashboard'), 'matcher must NOT include session-gated /dashboard');
      assert.ok(!config.matcher.includes('/api/drafts'), 'matcher must NOT include /api/drafts');
    });
  });

  // =========================================================================
  // 2. CONSTANT-TIME EQUALITY & TIMING ATTACK RESILIENCE
  // =========================================================================
  describe('2. Constant-Time Equality (timingSafeEqual)', () => {
    test('returns true for identical strings', () => {
      assert.strictEqual(timingSafeEqual(TEST_SECRET, TEST_SECRET), true);
      assert.strictEqual(timingSafeEqual('simple-key', 'simple-key'), true);
      assert.strictEqual(timingSafeEqual('a'.repeat(64), 'a'.repeat(64)), true);
    });

    test('returns false for different strings of same length', () => {
      assert.strictEqual(timingSafeEqual('abcde1', 'abcde2'), false);
      assert.strictEqual(timingSafeEqual('x'.repeat(32), 'y'.repeat(32)), false);
    });

    test('returns false for strings of different lengths', () => {
      assert.strictEqual(timingSafeEqual(TEST_SECRET, TEST_SECRET + '_extra'), false);
      assert.strictEqual(timingSafeEqual(TEST_SECRET + '_extra', TEST_SECRET), false);
      assert.strictEqual(timingSafeEqual('short', 'longer_string'), false);
    });

    test('returns false for prefix, suffix, and substring attacks', () => {
      const base = 'classified_master_token_2026';
      assert.strictEqual(timingSafeEqual(base.slice(0, 10), base), false);
      assert.strictEqual(timingSafeEqual(base, base.slice(0, 10)), false);
      assert.strictEqual(timingSafeEqual(base.slice(5), base), false);
      assert.strictEqual(timingSafeEqual('prefix_' + base, base), false);
    });

    test('returns false for empty or falsy inputs', () => {
      assert.strictEqual(timingSafeEqual('', TEST_SECRET), false);
      assert.strictEqual(timingSafeEqual(TEST_SECRET, ''), false);
      assert.strictEqual(timingSafeEqual('', ''), false);
      // @ts-ignore
      assert.strictEqual(timingSafeEqual(null, TEST_SECRET), false);
      // @ts-ignore
      assert.strictEqual(timingSafeEqual(TEST_SECRET, undefined), false);
      // @ts-ignore
      assert.strictEqual(timingSafeEqual(12345, 12345), false);
    });
  });

  // =========================================================================
  // 3. BYPASS SECRET RESOLUTION FROM ENVIRONMENT
  // =========================================================================
  describe('3. Environment Secret Resolution', () => {
    test('resolves VERCEL_AUTOMATION_BYPASS_SECRET as primary environment variable', () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = '  vercel_env_key_1  ';
      assert.strictEqual(getConfiguredBypassSecret(), 'vercel_env_key_1');
      assert.deepStrictEqual(getConfiguredBypassSecrets(), ['vercel_env_key_1']);
    });

    test('resolves AGENT_BYPASS_TOKEN as environment variable', () => {
      process.env.AGENT_BYPASS_TOKEN = 'agent_env_key_2';
      assert.strictEqual(getConfiguredBypassSecret(), 'agent_env_key_2');
      assert.deepStrictEqual(getConfiguredBypassSecrets(), ['agent_env_key_2']);
    });

    test('resolves multiple secrets concurrently when multiple env vars are defined', () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 'secret_alpha';
      process.env.AGENT_BYPASS_TOKEN = 'secret_beta';
      process.env.AUTOMATION_BYPASS_SECRET = 'secret_gamma';

      const secrets = getConfiguredBypassSecrets();
      assert.strictEqual(secrets.length, 3);
      assert.ok(secrets.includes('secret_alpha'));
      assert.ok(secrets.includes('secret_beta'));
      assert.ok(secrets.includes('secret_gamma'));
    });

    test('falls back to AUTOMATION_BYPASS_SECRET, BOTID_BYPASS_SECRET, and AUTOMATION_BYPASS_TOKEN', () => {
      process.env.AUTOMATION_BYPASS_SECRET = 'legacy_secret';
      assert.strictEqual(getConfiguredBypassSecret(), 'legacy_secret');

      delete process.env.AUTOMATION_BYPASS_SECRET;
      process.env.BOTID_BYPASS_SECRET = 'botid_fallback_key';
      assert.strictEqual(getConfiguredBypassSecret(), 'botid_fallback_key');

      delete process.env.BOTID_BYPASS_SECRET;
      process.env.AUTOMATION_BYPASS_TOKEN = 'token_fallback_key';
      assert.strictEqual(getConfiguredBypassSecret(), 'token_fallback_key');
    });

    test('returns null / empty array when no secret environment variables are set', () => {
      assert.strictEqual(getConfiguredBypassSecret(), null);
      assert.deepStrictEqual(getConfiguredBypassSecrets(), []);
    });

    test('returns null / empty array when secret environment variable is whitespace only', () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = '   \t\n  ';
      assert.strictEqual(getConfiguredBypassSecret(), null);
      assert.deepStrictEqual(getConfiguredBypassSecrets(), []);
    });
  });

  // =========================================================================
  // 4. AUTHORIZED AUTOMATION BYPASS DETECTION (isAuthorizedAutomationBypass)
  // =========================================================================
  describe('4. Bypass Header Detection & Validation', () => {
    test('authorizes bypass with primary x-vercel-protection-bypass header', () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = VERCEL_SECRET;
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-vercel-protection-bypass': VERCEL_SECRET },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(req), true);
    });

    test('authorizes bypass with primary x-agent-bypass-token header', () => {
      process.env.AGENT_BYPASS_TOKEN = AGENT_SECRET;
      const req = new NextRequest('http://localhost:3000/join', {
        headers: { 'x-agent-bypass-token': AGENT_SECRET },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(req), true);
    });

    test('authorizes bypass with x-automation-bypass-secret header', () => {
      process.env.AUTOMATION_BYPASS_SECRET = TEST_SECRET;
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-automation-bypass-secret': TEST_SECRET },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(req), true);
    });

    test('authorizes bypass with x-automation-bypass header', () => {
      process.env.AUTOMATION_BYPASS_SECRET = TEST_SECRET;
      const req = new NextRequest('http://localhost:3000/join', {
        headers: { 'x-automation-bypass': TEST_SECRET },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(req), true);
    });

    test('authorizes bypass with x-botid-bypass-secret header', () => {
      process.env.AUTOMATION_BYPASS_SECRET = TEST_SECRET;
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-botid-bypass-secret': TEST_SECRET },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(req), true);
    });

    test('authorizes bypass with x-botid-bypass header', () => {
      process.env.AUTOMATION_BYPASS_SECRET = TEST_SECRET;
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-botid-bypass': TEST_SECRET },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(req), true);
    });

    test('authorizes bypass with x-automation-secret header', () => {
      process.env.AUTOMATION_BYPASS_SECRET = TEST_SECRET;
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-automation-secret': TEST_SECRET },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(req), true);
    });

    test('authorizes bypass with x-bypass-token and x-bypass-secret headers', () => {
      process.env.AUTOMATION_BYPASS_SECRET = TEST_SECRET;
      const req1 = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-bypass-token': TEST_SECRET },
      });
      const req2 = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-bypass-secret': TEST_SECRET },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(req1), true);
      assert.strictEqual(isAuthorizedAutomationBypass(req2), true);
    });

    test('authorizes bypass with Authorization Bearer header (both Bearer and bearer)', () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = TEST_SECRET;
      const reqUpper = new NextRequest('http://localhost:3000/login', {
        headers: { authorization: `Bearer ${TEST_SECRET}` },
      });
      const reqLower = new NextRequest('http://localhost:3000/login', {
        headers: { authorization: `bearer ${TEST_SECRET}` },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(reqUpper), true);
      assert.strictEqual(isAuthorizedAutomationBypass(reqLower), true);
    });

    test('correctly handles whitespace padding in header token', () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = TEST_SECRET;
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-vercel-protection-bypass': `  ${TEST_SECRET}  ` },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(req), true);
    });

    test('rejects when header value does not match secret', () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = TEST_SECRET;
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-vercel-protection-bypass': 'invalid_forged_secret_token' },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(req), false);
    });

    test('rejects when header value is empty or whitespace only', () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = TEST_SECRET;
      const reqEmpty = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-vercel-protection-bypass': '' },
      });
      const reqSpaces = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-vercel-protection-bypass': '    ' },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(reqEmpty), false);
      assert.strictEqual(isAuthorizedAutomationBypass(reqSpaces), false);
    });

    test('rejects all bypass attempts when secret is not configured in env', () => {
      // process.env secrets are deleted
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-vercel-protection-bypass': TEST_SECRET },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(req), false);
    });

    test('accepts explicit configuredSecret argument override (string and array)', () => {
      const explicitSecret = 'custom_explicit_key_123';
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-agent-bypass-token': explicitSecret },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(req, explicitSecret), true);
      assert.strictEqual(isAuthorizedAutomationBypass(req, [explicitSecret, 'other']), true);
      assert.strictEqual(isAuthorizedAutomationBypass(req, 'different_key'), false);
    });
  });

  // =========================================================================
  // 5. COOKIE BYPASS DETECTION & VALIDATION
  // =========================================================================
  describe('5. Bypass Cookie Detection & Validation', () => {
    test('authorizes bypass with x-vercel-protection-bypass cookie', () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = VERCEL_SECRET;
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { cookie: `x-vercel-protection-bypass=${VERCEL_SECRET}; session=xyz` },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(req), true);
    });

    test('authorizes bypass with x-agent-bypass-token cookie', () => {
      process.env.AGENT_BYPASS_TOKEN = AGENT_SECRET;
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { cookie: `x-agent-bypass-token=${AGENT_SECRET}` },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(req), true);
    });

    test('authorizes bypass with _vercel_jwt cookie containing authorized secret', () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = VERCEL_SECRET;
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { cookie: `_vercel_jwt=${VERCEL_SECRET}` },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(req), true);
    });

    test('authorizes bypass with _vercel_protection_bypass cookie', () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = VERCEL_SECRET;
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { cookie: `_vercel_protection_bypass=${VERCEL_SECRET}` },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(req), true);
    });

    test('rejects forged or invalid cookie value', () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = VERCEL_SECRET;
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { cookie: '_vercel_jwt=forged_unauthorized_token' },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(req), false);
    });

    test('rejects empty or whitespace cookie value', () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = VERCEL_SECRET;
      const req = new NextRequest('http://localhost:3000/login', {
        headers: { cookie: 'x-vercel-protection-bypass=' },
      });
      assert.strictEqual(isAuthorizedAutomationBypass(req), false);
    });
  });

  // =========================================================================
  // 6. MULTIPLE CONFIGURED SECRETS COEXISTENCE
  // =========================================================================
  describe('6. Coexistence of Multiple Configured Secrets', () => {
    test('authorizes either secret when both VERCEL_AUTOMATION_BYPASS_SECRET and AGENT_BYPASS_TOKEN are set', () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = VERCEL_SECRET;
      process.env.AGENT_BYPASS_TOKEN = AGENT_SECRET;

      const reqVercel = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-vercel-protection-bypass': VERCEL_SECRET },
      });
      const reqAgent = new NextRequest('http://localhost:3000/join', {
        headers: { 'x-agent-bypass-token': AGENT_SECRET },
      });
      const reqUnknown = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-vercel-protection-bypass': 'wrong_token' },
      });

      assert.strictEqual(isAuthorizedAutomationBypass(reqVercel), true);
      assert.strictEqual(isAuthorizedAutomationBypass(reqAgent), true);
      assert.strictEqual(isAuthorizedAutomationBypass(reqUnknown), false);
    });
  });

  // =========================================================================
  // 7. END-TO-END MIDDLEWARE EXECUTION: AUTHORIZED AUTOMATION BYPASS
  // =========================================================================
  describe('7. Middleware E2E: Authorized Automation Bypass Execution', () => {
    test('authorized agent with x-vercel-protection-bypass on /login passes without calling BotID', async () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = VERCEL_SECRET;

      let botIdCalled = false;
      const mockBotCheck = async () => {
        botIdCalled = true;
        return { isBot: true }; // If called, it would flag as bot
      };

      const req = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-vercel-protection-bypass': VERCEL_SECRET },
      });

      const res = await middleware(req, { checkBotIdFn: mockBotCheck });

      // Verification of bypass success
      assert.strictEqual(res.status, 200, 'Bypassed request must return 200/next');
      assert.strictEqual(botIdCalled, false, 'checkBotId must NEVER be invoked for authorized bypass');

      // Forwarded request headers verification
      assert.strictEqual(
        res.headers.get('x-middleware-request-x-is-human'),
        '1',
        'Forwarded header x-is-human must be 1 so downstream auth skips bot checks'
      );
      assert.strictEqual(
        res.headers.get('x-middleware-request-x-automation-bypassed'),
        '1',
        'Forwarded header x-automation-bypassed must be 1'
      );

      // Direct response headers verification
      assert.strictEqual(res.headers.get('x-is-human'), '1', 'Response header x-is-human must be 1');
      assert.strictEqual(
        res.headers.get('x-automation-bypassed'),
        '1',
        'Response header x-automation-bypassed must be 1'
      );
      assert.strictEqual(
        res.headers.get('x-botid-bypassed'),
        '1',
        'Response header x-botid-bypassed must be 1'
      );
    });

    test('authorized agent with x-agent-bypass-token on /join passes with x-is-human marker', async () => {
      process.env.AGENT_BYPASS_TOKEN = AGENT_SECRET;

      let botIdCalled = false;
      const mockBotCheck = async () => {
        botIdCalled = true;
        return { isBot: true };
      };

      const req = new NextRequest('http://localhost:3000/join', {
        headers: { 'x-agent-bypass-token': AGENT_SECRET },
      });

      const res = await middleware(req, { checkBotIdFn: mockBotCheck });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(botIdCalled, false);
      assert.strictEqual(res.headers.get('x-middleware-request-x-is-human'), '1');
      assert.strictEqual(res.headers.get('x-is-human'), '1');
      assert.strictEqual(res.headers.get('x-automation-bypassed'), '1');
    });

    test('authorized agent with bypass cookie on /login passes without calling BotID', async () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = VERCEL_SECRET;

      let botIdCalled = false;
      const mockBotCheck = async () => {
        botIdCalled = true;
        return { isBot: true };
      };

      const req = new NextRequest('http://localhost:3000/login', {
        headers: { cookie: `x-vercel-protection-bypass=${VERCEL_SECRET}` },
      });

      const res = await middleware(req, { checkBotIdFn: mockBotCheck });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(botIdCalled, false);
      assert.strictEqual(res.headers.get('x-middleware-request-x-is-human'), '1');
      assert.strictEqual(res.headers.get('x-automation-bypassed'), '1');
    });

    test('supports passing secret via options.bypassSecret in test harness (string and array)', async () => {
      const mockBotCheck = async () => ({ isBot: true });
      const customSecret = 'harness_isolated_bypass_token';

      const req = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-agent-bypass-token': customSecret },
      });

      const res = await middleware(req, {
        bypassSecret: customSecret,
        checkBotIdFn: mockBotCheck,
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('x-automation-bypassed'), '1');

      // Test array of secrets in options
      const resArr = await middleware(req, {
        bypassSecret: ['other_secret', customSecret],
        checkBotIdFn: mockBotCheck,
      });
      assert.strictEqual(resArr.status, 200);
    });
  });

  // =========================================================================
  // 8. END-TO-END MIDDLEWARE EXECUTION: GENERAL PUBLIC TRAFFIC (BOTID PRESERVED)
  // =========================================================================
  describe('8. Middleware E2E: General Public Traffic BotID Enforcement', () => {
    test('verified human visitor on /login passes with x-is-human header', async () => {
      const mockHumanCheck = async () => ({ isBot: false });
      const req = new NextRequest('http://localhost:3000/login');

      const res = await middleware(req, { checkBotIdFn: mockHumanCheck });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('x-middleware-request-x-is-human'), '1');
      assert.strictEqual(res.headers.get('x-is-human'), '1');
      assert.strictEqual(
        res.headers.get('x-automation-bypassed'),
        null,
        'Normal human traffic must NOT have x-automation-bypassed response header'
      );
    });

    test('verified human visitor on /join passes with x-is-human header', async () => {
      const mockHumanCheck = async () => ({ isBot: false });
      const req = new NextRequest('http://localhost:3000/join');

      const res = await middleware(req, { checkBotIdFn: mockHumanCheck });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('x-middleware-request-x-is-human'), '1');
      assert.strictEqual(res.headers.get('x-is-human'), '1');
    });

    test('unverified bot visitor on /login is blocked with 401 and stable error shape', async () => {
      const mockBotCheck = async () => ({ isBot: true });
      const req = new NextRequest('http://localhost:3000/login');

      const res = await middleware(req, { checkBotIdFn: mockBotCheck });

      assert.strictEqual(res.status, 401, 'Bot traffic must receive 401 Unauthorized');
      const body = await res.json();
      assert.strictEqual(body.error, 'bot_detected');
      assert.strictEqual(
        body.message,
        'We could not verify this request as human. Please refresh the page, disable VPN/proxy if active, and try again.'
      );
    });

    test('unverified bot visitor on /join is blocked with 401 and stable error shape', async () => {
      const mockBotCheck = async () => ({ isBot: true });
      const req = new NextRequest('http://localhost:3000/join');

      const res = await middleware(req, { checkBotIdFn: mockBotCheck });

      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.error, 'bot_detected');
      assert.ok(body.message.includes('We could not verify this request as human'));
    });
  });

  // =========================================================================
  // 9. END-TO-END MIDDLEWARE EXECUTION: MALICIOUS & FAILED BYPASS ATTEMPTS
  // =========================================================================
  describe('9. Middleware E2E: Malicious & Failed Bypass Attempts', () => {
    test('bot request with incorrect x-vercel-protection-bypass token is blocked with 401', async () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = VERCEL_SECRET;
      const mockBotCheck = async () => ({ isBot: true });

      const req = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-vercel-protection-bypass': 'wrong_invalid_secret_token' },
      });

      const res = await middleware(req, { checkBotIdFn: mockBotCheck });

      assert.strictEqual(res.status, 401, 'Attacker with wrong token must be blocked');
      const body = await res.json();
      assert.strictEqual(body.error, 'bot_detected');
    });

    test('bot request with incorrect x-agent-bypass-token is blocked with 401', async () => {
      process.env.AGENT_BYPASS_TOKEN = AGENT_SECRET;
      const mockBotCheck = async () => ({ isBot: true });

      const req = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-agent-bypass-token': 'wrong_agent_token' },
      });

      const res = await middleware(req, { checkBotIdFn: mockBotCheck });

      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.error, 'bot_detected');
    });

    test('bot request with fake bypass cookie is blocked with 401', async () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = VERCEL_SECRET;
      const mockBotCheck = async () => ({ isBot: true });

      const req = new NextRequest('http://localhost:3000/login', {
        headers: { cookie: 'x-vercel-protection-bypass=fake_cookie_secret' },
      });

      const res = await middleware(req, { checkBotIdFn: mockBotCheck });

      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.error, 'bot_detected');
    });

    test('bot request with empty or whitespace token is blocked with 401', async () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = VERCEL_SECRET;
      const mockBotCheck = async () => ({ isBot: true });

      const req = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-vercel-protection-bypass': '   ' },
      });

      const res = await middleware(req, { checkBotIdFn: mockBotCheck });

      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.error, 'bot_detected');
    });

    test('bot request with substring/prefix attack is blocked with 401', async () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = VERCEL_SECRET;
      const mockBotCheck = async () => ({ isBot: true });

      const req = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-vercel-protection-bypass': VERCEL_SECRET.slice(0, 12) },
      });

      const res = await middleware(req, { checkBotIdFn: mockBotCheck });

      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.error, 'bot_detected');
    });

    test('bot request when server secrets are UNSET is blocked with 401 even if header is sent', async () => {
      // process.env has NO bypass secret set
      const mockBotCheck = async () => ({ isBot: true });

      const req = new NextRequest('http://localhost:3000/login', {
        headers: { 'x-vercel-protection-bypass': 'any_token_at_all' },
      });

      const res = await middleware(req, { checkBotIdFn: mockBotCheck });

      assert.strictEqual(res.status, 401);
      const body = await res.json();
      assert.strictEqual(body.error, 'bot_detected');
    });

    test('multiple headers: valid secret in one header overrides invalid or flag in another', async () => {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = VERCEL_SECRET;
      const mockBotCheck = async () => ({ isBot: true });

      const req = new NextRequest('http://localhost:3000/login', {
        headers: {
          'x-automation-bypass': '1', // flag value
          'x-vercel-protection-bypass': VERCEL_SECRET, // actual secret
        },
      });

      const res = await middleware(req, { checkBotIdFn: mockBotCheck });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('x-automation-bypassed'), '1');
      assert.strictEqual(res.headers.get('x-is-human'), '1');
      assert.strictEqual(res.headers.get('x-middleware-request-x-is-human'), '1');
    });
  });
});
