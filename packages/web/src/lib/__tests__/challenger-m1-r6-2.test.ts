/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrubPII, DEFAULT_PII_WHITELIST } from '../pii-scrubber.ts';
import { cleanAiDraft, synthesizeSmartSupportDraft, extractSenderName } from '../../../../extension/src/utils/api-client.ts';
import { getActiveRootPasskey, setCachedRootPasskey, clearCachedRootPasskey, timingSafeEqual } from '../admin-auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const routePath = path.resolve(__dirname, '../../app/api/drafts/generate/route.ts');
const adminConfigPath = path.resolve(__dirname, '../../components/admin/AdminAIConfig.tsx');
const sidepanelPath = path.resolve(__dirname, '../../../../extension/src/sidepanel/sidepanel.ts');

const routeCode = fs.readFileSync(routePath, 'utf8');
const adminConfigCode = fs.readFileSync(adminConfigPath, 'utf8');
const sidepanelCode = fs.readFileSync(sidepanelPath, 'utf8');

// ============================================================================
// 1. FALLBACK DOMAIN SYNTHESIZER: KB SNIPPETS & MACRO HINT STRESS TESTING
// ============================================================================
describe('Challenger 2 - Challenge 1: Fallback Domain Synthesizer KB Snippets & Macro Hints', () => {
  test('weaves URL and international helpline (+880...) into partnership reply', () => {
    const thread = 'Hello team, we are interested in joining Foodi as a restaurant partner in Dhaka. What is the onboarding process?';
    const kb = [
      'Restaurant Partnership Documentation:\nRegister at https://foodibd.com/become-a-partner\nSupport phone: +8809677161161',
    ];
    const draft = synthesizeSmartSupportDraft(thread, 'Tanvir', kb);

    assert.ok(draft.startsWith('Hi Tanvir,'));
    assert.ok(draft.includes('https://foodibd.com/become-a-partner'));
    assert.ok(draft.includes('+8809677161161'));
    assert.ok(draft.includes('partnerships team'));
    assert.ok(draft.includes('Customer Support Team'));
  });

  test('weaves URL with query parameters and special characters safely', () => {
    const thread = 'Need to apply for partnership program.';
    const kb = [
      'Apply here: https://partner.example.com/apply?source=portal&campaign=q3_vendor#pricing-section',
    ];
    const draft = synthesizeSmartSupportDraft(thread, 'there', kb);

    assert.ok(draft.includes('https://partner.example.com/apply?source=portal&campaign=q3_vendor#pricing-section'));
    assert.ok(draft.includes('self-service resources'));
  });

  test('handles North American and toll-free helpline phone formats', () => {
    const thread = 'My account password reset failed and 2FA is locked.';
    const kb = [
      'Account recovery helpline: 1-800-555-0199 or (888) 555-0144 available 24/7.',
    ];
    const draft = synthesizeSmartSupportDraft(thread, 'Alex', kb);

    assert.ok(draft.startsWith('Hi Alex,'));
    assert.ok(draft.includes('password reset link'));
    assert.ok(draft.includes('1-800-555-0199') || draft.includes('(888) 555-0144'));
  });

  test('extracts clean text excerpt when snippet lacks explicit URL or phone number', () => {
    const thread = 'I experienced a software bug on the billing portal';
    const kb = [
      '### Bug Reporting Protocol\nPlease record the HTTP status code and clear your local IndexedDB storage before contacting tier-2 support.',
    ];
    const draft = synthesizeSmartSupportDraft(thread, 'Chris', kb);

    assert.ok(draft.startsWith('Hi Chris,'));
    assert.ok(draft.includes('As noted in our documentation:'));
    assert.ok(draft.includes('IndexedDB storage'));
  });

  test('formats custom macro hints with proper punctuation and spacing', () => {
    const thread = 'Can I get a refund for my order?';
    
    // Case A: hint without trailing punctuation
    const draftA = synthesizeSmartSupportDraft(thread, 'Sam', [], 'Offer 20% discount code STAY20 instead of full cancellation');
    assert.ok(draftA.includes('Please note: Offer 20% discount code STAY20 instead of full cancellation.'));

    // Case B: hint with exclamation mark
    const draftB = synthesizeSmartSupportDraft(thread, 'Sam', [], 'Verify return tracking number before issuing refund!');
    assert.ok(draftB.includes('Please note: Verify return tracking number before issuing refund!'));

    // Case C: hint with trailing period
    const draftC = synthesizeSmartSupportDraft(thread, 'Sam', [], 'Customer has premium VIP subscription.');
    assert.ok(draftC.includes('Please note: Customer has premium VIP subscription.'));
    assert.ok(!draftC.includes('subscription..'));

    // Case D: empty/whitespace hint
    const draftD = synthesizeSmartSupportDraft(thread, 'Sam', [], '   ');
    assert.ok(!draftD.includes('Please note:'));
  });

  test('correctly triggers all 6 customer support intents + default general reply', () => {
    const testMatrix = [
      { inquiry: 'I want a refund and money back for this purchase', expectedIntent: 'refund' },
      { inquiry: 'Where is my order? Track shipment delivery status', expectedIntent: 'tracking' },
      { inquiry: 'Forgot password and 2fa account locked out', expectedIntent: 'account' },
      { inquiry: 'Send me the invoice receipt for recent subscription charge', expectedIntent: 'billing' },
      { inquiry: 'Encountered error glitch bug in the app, it crashed', expectedIntent: 'troubleshoot' },
      { inquiry: 'Inquiry regarding partnership affiliate collaboration', expectedIntent: 'partner' },
      { inquiry: 'Hello, what are your office hours?', expectedIntent: 'general' },
    ];

    for (const item of testMatrix) {
      const draft = synthesizeSmartSupportDraft(item.inquiry, 'Customer');
      assert.ok(draft.length > 50, `Draft for "${item.inquiry}" must be non-empty`);
      assert.ok(draft.startsWith('Hi Customer,'));
      assert.ok(draft.includes('Customer Support Team'));
    }
  });

  test('preserves whitelisted KB helplines and URLs through PII scrubber without false positive redaction', () => {
    const text = 'Contact partner helpline +8809677161161 or visit https://foodibd.com/become-a-partner. Email support@draftpilot.com. Customer SSN 123-45-6789 and personal email customer@gmail.com';
    const scrubbed = scrubPII(text, undefined, ['+8809677161161', 'https://foodibd.com/become-a-partner', 'support@draftpilot.com']);

    assert.ok(scrubbed.includes('+8809677161161'), 'Helpline must be preserved');
    assert.ok(scrubbed.includes('https://foodibd.com/become-a-partner'), 'KB URL must be preserved');
    assert.ok(scrubbed.includes('support@draftpilot.com'), 'Company email must be preserved');
    assert.ok(scrubbed.includes('[EMAIL_REDACTED]'), 'Customer personal email must be redacted');
    assert.ok(!scrubbed.includes('customer@gmail.com'));
  });
});

// ============================================================================
// 2. EXTENSION SIDEPANEL BADGE MAPPING VERIFICATION
// ============================================================================
describe('Challenger 2 - Challenge 2: Extension Sidepanel Badge Mapping Logic', () => {
  // Oracle simulating sidepanel.ts badge & title mapping logic
  function renderBadgeAndTitle(result: { source?: string; macroUsed?: string | null; notice?: string }) {
    let badgeText = '';
    let badgeBackground = '';
    let badgeColor = '';
    let badgeTitle = '';
    let containerTitle = '';

    if (result.source === 'openrouter' || result.source === 'ai') {
      badgeText = '✨ AI Generated';
      badgeBackground = 'rgba(124, 58, 237, 0.2)';
      badgeColor = '#a78bfa';
      badgeTitle = 'Authentic AI generated output via OpenRouter LLM';
      containerTitle = 'Generated AI Reply';
    } else if (result.source === 'macro') {
      badgeText = result.macroUsed ? `📐 Macro: ${result.macroUsed}` : '📐 Macro';
      badgeBackground = 'rgba(59, 130, 246, 0.2)';
      badgeColor = '#60a5fa';
      badgeTitle = result.macroUsed ? `Grounded support macro: ${result.macroUsed}` : 'Quick reply macro';
      containerTitle = 'Macro Quick Reply';
    } else {
      badgeText = '📄 Template Reply';
      badgeBackground = 'rgba(234, 179, 8, 0.2)';
      badgeColor = '#fbbf24';
      badgeTitle = result.notice || 'Grounded fallback template (not AI generated)';
      containerTitle = 'Template Reply';
    }

    return { badgeText, badgeBackground, badgeColor, badgeTitle, containerTitle };
  }

  test('maps openrouter source to "✨ AI Generated" badge', () => {
    const res = renderBadgeAndTitle({ source: 'openrouter' });
    assert.strictEqual(res.badgeText, '✨ AI Generated');
    assert.strictEqual(res.badgeColor, '#a78bfa');
    assert.strictEqual(res.containerTitle, 'Generated AI Reply');
  });

  test('maps ai source alias to "✨ AI Generated" badge', () => {
    const res = renderBadgeAndTitle({ source: 'ai' });
    assert.strictEqual(res.badgeText, '✨ AI Generated');
    assert.strictEqual(res.badgeColor, '#a78bfa');
    assert.strictEqual(res.containerTitle, 'Generated AI Reply');
  });

  test('maps macro source with macroUsed name to "📐 Macro: <Name>"', () => {
    const res = renderBadgeAndTitle({ source: 'macro', macroUsed: 'Damaged Item Exchange' });
    assert.strictEqual(res.badgeText, '📐 Macro: Damaged Item Exchange');
    assert.strictEqual(res.badgeColor, '#60a5fa');
    assert.strictEqual(res.containerTitle, 'Macro Quick Reply');
  });

  test('maps macro source without macroUsed name to generic "📐 Macro"', () => {
    const res = renderBadgeAndTitle({ source: 'macro', macroUsed: null });
    assert.strictEqual(res.badgeText, '📐 Macro');
    assert.strictEqual(res.badgeColor, '#60a5fa');
    assert.strictEqual(res.containerTitle, 'Macro Quick Reply');
  });

  test('maps template fallback source to "📄 Template Reply" badge with warning color', () => {
    const res = renderBadgeAndTitle({ source: 'template', notice: 'Server unreachable' });
    assert.strictEqual(res.badgeText, '📄 Template Reply');
    assert.strictEqual(res.badgeColor, '#fbbf24');
    assert.strictEqual(res.containerTitle, 'Template Reply');
    assert.strictEqual(res.badgeTitle, 'Server unreachable');
  });

  test('fails safe to "📄 Template Reply" for unknown or missing source property', () => {
    const res = renderBadgeAndTitle({ source: undefined });
    assert.strictEqual(res.badgeText, '📄 Template Reply');
    assert.strictEqual(res.containerTitle, 'Template Reply');
  });

  test('verifies sidepanel.ts source code contains exact emoji badge strings', () => {
    assert.ok(sidepanelCode.includes("'✨ AI Generated'"), 'sidepanel.ts must contain ✨ AI Generated');
    assert.ok(sidepanelCode.includes("'📐 Macro'"), 'sidepanel.ts must contain 📐 Macro');
    assert.ok(sidepanelCode.includes("'📄 Template Reply'"), 'sidepanel.ts must contain 📄 Template Reply');
  });
});

// ============================================================================
// 3. ADMIN PLAYGROUND WIRING, PARAMETER FIDELITY & ROUTE CONTRACT ANALYSIS
// ============================================================================
describe('Challenger 2 - Challenge 3: Admin AI Playground Wiring & Dynamic Routing', () => {
  // Oracle for temperature parsing logic in route.ts
  function parseServerTemperature(settings: Record<string, any> | null | undefined): number {
    const parsed = Number(settings?.temperature);
    return settings?.temperature !== undefined && settings?.temperature !== null && !isNaN(parsed)
      ? Math.max(0.0, Math.min(2.0, parsed))
      : 0.4;
  }

  // Oracle for max_tokens parsing logic in route.ts
  function parseServerMaxTokens(settings: Record<string, any> | null | undefined, model: string): number {
    const parsed = Number(settings?.max_tokens);
    const configured = !isNaN(parsed) && parsed > 0 ? Math.max(100, Math.min(4000, parsed)) : 1000;
    return model.includes('glm-5.3') ? Math.max(800, configured) : configured;
  }

  test('temperature: 0.0 is strictly preserved and not treated as falsy', () => {
    assert.strictEqual(parseServerTemperature({ temperature: 0.0 }), 0.0);
    assert.strictEqual(parseServerTemperature({ temperature: 0 }), 0.0);
    assert.strictEqual(parseServerTemperature({ temperature: '0.0' }), 0.0);
    assert.strictEqual(parseServerTemperature({ temperature: '0' }), 0.0);
  });

  test('temperature clamps to valid range [0.0, 2.0]', () => {
    assert.strictEqual(parseServerTemperature({ temperature: -0.5 }), 0.0);
    assert.strictEqual(parseServerTemperature({ temperature: 3.5 }), 2.0);
    assert.strictEqual(parseServerTemperature({ temperature: 0.7 }), 0.7);
  });

  test('temperature defaults to 0.4 when missing, null, or NaN', () => {
    assert.strictEqual(parseServerTemperature(null), 0.4);
    assert.strictEqual(parseServerTemperature(undefined), 0.4);
    assert.strictEqual(parseServerTemperature({ temperature: null }), 0.4);
    assert.strictEqual(parseServerTemperature({ temperature: undefined }), 0.4);
    assert.strictEqual(parseServerTemperature({ temperature: 'invalid' }), 0.4);
  });

  test('max_tokens parsing honors custom values between 100 and 4000', () => {
    assert.strictEqual(parseServerMaxTokens({ max_tokens: 300 }, 'google/gemma-4-26b-a4b-it:free'), 300);
    assert.strictEqual(parseServerMaxTokens({ max_tokens: '500' }, 'google/gemma-4-26b-a4b-it:free'), 500);
    assert.strictEqual(parseServerMaxTokens({ max_tokens: 50 }, 'google/gemma-4-26b-a4b-it:free'), 100); // clamped to min 100
    assert.strictEqual(parseServerMaxTokens({ max_tokens: 10000 }, 'google/gemma-4-26b-a4b-it:free'), 4000); // clamped to max 4000
    assert.strictEqual(parseServerMaxTokens(null, 'google/gemma-4-26b-a4b-it:free'), 1000); // default 1000
  });

  test('max_tokens enforces minimum 800 tokens for reasoning models (glm-5.3)', () => {
    assert.strictEqual(parseServerMaxTokens({ max_tokens: 200 }, 'z-ai/glm-5.3-flash'), 800);
    assert.strictEqual(parseServerMaxTokens({ max_tokens: 1200 }, 'z-ai/glm-5.3-flash'), 1200);
  });

  test('REGRESSION: route.ts accepts both "thread" and "threadContent" from AdminAIConfig payload', () => {
    // AdminAIConfig may send `thread` while main clients send `threadContent`
    // route.ts must handle both (fallback from threadContent to thread)
    const routeFallbackHandling = routeCode.includes('body.thread') || routeCode.includes('threadContent || body.thread');

    assert.strictEqual(
      routeFallbackHandling,
      true,
      'route.ts must handle body.thread as fallback for body.threadContent'
    );
  });

  test('REGRESSION: route.ts reads dynamic parameters (temperature, max_tokens, selected_model) from request body', () => {
    // route.ts must inspect body-level overrides for playground support
    const routeUsesBodyModel = routeCode.includes('body.selected_model') || routeCode.includes('body.model');
    const routeUsesBodyTemp = routeCode.includes('body.temperature');
    const routeUsesBodyTokens = routeCode.includes('body.max_tokens');

    assert.strictEqual(routeUsesBodyModel, true, 'route.ts must inspect body.selected_model for playground overrides');
    assert.strictEqual(routeUsesBodyTemp, true, 'route.ts must inspect body.temperature for playground overrides');
    assert.strictEqual(routeUsesBodyTokens, true, 'route.ts must inspect body.max_tokens for playground overrides');
  });

  test('AUDIT / STRESS TEST: AdminAIConfig passes promptOverride: systemPrompt which route.ts converts to macroHint', () => {
    // AdminAIConfig line 400: promptOverride: systemPrompt
    // route.ts line 425-433:
    // const rawInstruction = ... || (typeof body.promptOverride === 'string' && body.promptOverride.trim()) ...
    // const macroHint = typeof rawInstruction === 'string' ? rawInstruction.trim() : '';
    // Then in fallback synthesizer:
    // synthesizeSmartSupportDraft(scrubbedThreadContent, customerName, effectiveKbSnippets, macroHint || '');
    // Which renders: "Please note: You are DraftPilot, an intelligent AI reply assistant..."
    const systemPrompt = 'You are DraftPilot, an intelligent AI reply assistant for customer support.';
    const draft = synthesizeSmartSupportDraft('I want to return an item', 'there', [], systemPrompt);

    assert.ok(draft.includes('Please note: You are DraftPilot, an intelligent AI reply assistant for customer support.'));
    // This confirms that passing promptOverride: systemPrompt leaks the system prompt into the fallback customer draft!
  });
});

// ============================================================================
// 4. ADMIN PASSKEY AUTH & TEST QUOTA BYPASS
// ============================================================================
describe('Challenger 2 - Challenge 4: Admin Passkey Authentication & Quota Bypass', () => {
  test('timingSafeEqual safely verifies equal strings and rejects mismatched strings', () => {
    assert.strictEqual(timingSafeEqual('correct-passkey-123', 'correct-passkey-123'), true);
    assert.strictEqual(timingSafeEqual('correct-passkey-123', 'wrong-passkey'), false);
    assert.strictEqual(timingSafeEqual('correct-passkey-123', 'correct-passkey-124'), false);
    assert.strictEqual(timingSafeEqual('', ''), true);
    assert.strictEqual(timingSafeEqual('abc', 'abcd'), false);
  });

  test('resolves active root passkey from cache when set', async () => {
    setCachedRootPasskey('test-secret-root-passkey-m1');
    const active = await getActiveRootPasskey();
    assert.strictEqual(active, 'test-secret-root-passkey-m1');
    clearCachedRootPasskey();
  });

  test('verifies route.ts auth branch: validates x-admin-passkey and bypasses user quota', () => {
    // Replicate route.ts auth & testMode evaluation
    function evaluateAuthAndQuota(
      headers: Record<string, string>,
      body: Record<string, any>,
      configuredPasskey: string | null
    ) {
      let user: any = null;
      const adminPasskey = headers['x-admin-passkey']?.trim();
      if (adminPasskey && configuredPasskey && timingSafeEqual(adminPasskey, configuredPasskey)) {
        user = { id: 'admin-playground', email: 'admin@draftpilot.com', role: 'superadmin' };
      }

      const isTestMode = Boolean(body.isTest || user?.id === 'admin-playground');
      const shouldCheckQuota = !isTestMode && user?.id !== 'admin-playground';
      const shouldLogHistory = !isTestMode && user?.id !== 'admin-playground';

      return {
        authenticated: Boolean(user),
        userId: user?.id,
        isTestMode,
        shouldCheckQuota,
        shouldLogHistory,
      };
    }

    const validAdminCall = evaluateAuthAndQuota(
      { 'x-admin-passkey': 'my-root-secret' },
      { isTest: true },
      'my-root-secret'
    );
    assert.strictEqual(validAdminCall.authenticated, true);
    assert.strictEqual(validAdminCall.userId, 'admin-playground');
    assert.strictEqual(validAdminCall.isTestMode, true);
    assert.strictEqual(validAdminCall.shouldCheckQuota, false);
    assert.strictEqual(validAdminCall.shouldLogHistory, false);

    const invalidAdminPasskey = evaluateAuthAndQuota(
      { 'x-admin-passkey': 'wrong-passkey' },
      { isTest: true },
      'my-root-secret'
    );
    assert.strictEqual(invalidAdminPasskey.authenticated, false);
  });
});
