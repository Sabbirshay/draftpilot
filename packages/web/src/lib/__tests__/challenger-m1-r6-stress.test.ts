/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scrubPII, DEFAULT_PII_WHITELIST } from '../pii-scrubber.ts';
import { cleanAiDraft, extractSenderName, synthesizeSmartSupportDraft } from '../../../../extension/src/utils/api-client.ts';

// ============================================================================
// CHALLENGE SUITE 1: Multi-Alias Instruction Parsing Across All Combinations
// ============================================================================
describe('Challenge Suite 1: Multi-Alias Instruction Parsing & Precedence', () => {
  // Replicating exact resolution logic from packages/web/src/app/api/drafts/generate/route.ts (lines 425-433)
  function resolveInstruction(body: Record<string, any>): string {
    const rawInstruction =
      (typeof body.macroHint === 'string' && body.macroHint.trim()) ||
      (typeof body.customInstruction === 'string' && body.customInstruction.trim()) ||
      (typeof body.instruction === 'string' && body.instruction.trim()) ||
      (typeof body.userPrompt === 'string' && body.userPrompt.trim()) ||
      (typeof body.promptOverride === 'string' && body.promptOverride.trim()) ||
      (body.macroHint || body.customInstruction || body.instruction || body.userPrompt || body.promptOverride || '');

    return typeof rawInstruction === 'string' ? rawInstruction.trim() : '';
  }

  const aliases = ['macroHint', 'customInstruction', 'instruction', 'userPrompt', 'promptOverride'];

  test('exhaustively validates all 32 combinations (2^5) of alias presence and strict precedence', () => {
    for (let mask = 1; mask < 32; mask++) {
      const payload: Record<string, string> = {};
      let expectedWinner = '';
      for (let i = 0; i < 5; i++) {
        if (mask & (1 << i)) {
          payload[aliases[i]] = `Instruction from ${aliases[i]}`;
          if (!expectedWinner) {
            expectedWinner = `Instruction from ${aliases[i]}`;
          }
        }
      }
      const resolved = resolveInstruction(payload);
      assert.strictEqual(
        resolved,
        expectedWinner,
        `Failed for combination mask ${mask} (${Object.keys(payload).join(', ')}): expected "${expectedWinner}", got "${resolved}"`
      );
    }
  });

  test('falls back cleanly to empty string when all aliases are omitted or empty', () => {
    assert.strictEqual(resolveInstruction({}), '');
    assert.strictEqual(resolveInstruction({ macroHint: '', customInstruction: '', instruction: '' }), '');
  });

  test('ignores whitespace-only values at higher precedence in favor of populated lower alias', () => {
    const payload = {
      macroHint: '   \n\t  ',
      customInstruction: '    ',
      instruction: 'Actual directive from human supervisor',
      userPrompt: 'Lower priority directive',
    };
    assert.strictEqual(resolveInstruction(payload), 'Actual directive from human supervisor');
  });

  test('handles non-string types safely without throwing exceptions', () => {
    assert.strictEqual(resolveInstruction({ macroHint: 12345 as any, instruction: 'Fallback' }), 'Fallback');
    assert.strictEqual(resolveInstruction({ customInstruction: true as any, promptOverride: 'Valid' }), 'Valid');
    assert.strictEqual(resolveInstruction({ macroHint: null as any, userPrompt: undefined as any }), '');
    assert.strictEqual(resolveInstruction({ macroHint: {} as any }), '');
  });

  test('formats agent guidance into prompt context only when non-empty', () => {
    const formatPromptContext = (instruction: string) => {
      const trimmed = instruction.trim();
      return trimmed ? `### Agent Guidance / Custom Instruction:\n${trimmed}\n\n` : '';
    };

    assert.strictEqual(formatPromptContext(''), '');
    assert.strictEqual(formatPromptContext('   \n  '), '');
    assert.strictEqual(
      formatPromptContext('Give VIP 50% discount'),
      '### Agent Guidance / Custom Instruction:\nGive VIP 50% discount\n\n'
    );
  });
});

// ============================================================================
// CHALLENGE SUITE 2: extractSenderName Tricky Greetings, Accents, Hyphens & Blacklists
// ============================================================================
describe('Challenge Suite 2: extractSenderName Robustness & Adversarial Edge Cases', () => {
  test('extracts names with Latin extended accented characters correctly', () => {
    assert.strictEqual(extractSenderName('Thanks,\nJosé'), 'José');
    assert.strictEqual(extractSenderName('Best regards,\nRenée'), 'Renée');
    assert.strictEqual(extractSenderName('Sincerely,\nFrançois'), 'François');
    assert.strictEqual(extractSenderName('Cheers,\nMüller'), 'Müller');
    assert.strictEqual(extractSenderName('Thanks,\nSøren'), 'Søren');
    assert.strictEqual(extractSenderName('Best,\nÁlvarez'), 'Álvarez');
    assert.strictEqual(extractSenderName('Regards,\nNoëlla'), 'Noëlla');
  });

  test('extracts hyphenated, apostrophed, and compound names correctly', () => {
    assert.strictEqual(extractSenderName('Sincerely,\nJean-Luc'), 'Jean-Luc');
    assert.strictEqual(extractSenderName('Best,\nMary-Jane'), 'Mary-Jane');
    assert.strictEqual(extractSenderName('Cheers,\nMarie-Claire'), 'Marie-Claire');
    assert.strictEqual(extractSenderName('Thanks,\nO\'Connor'), 'O\'Connor');
    assert.strictEqual(extractSenderName('Warm regards,\nd\'Artagnan'), 'd\'Artagnan');
  });

  test('extracts names from diverse greeting styles and honorific prefixes', () => {
    assert.strictEqual(extractSenderName('Good morning Dr. Smith,\nCan you assist?'), 'Smith');
    assert.strictEqual(extractSenderName('Dear Prof. Johnson,\nRegarding your paper'), 'Johnson');
    assert.strictEqual(extractSenderName('Hello Mr. Anderson,\nPlease check'), 'Anderson');
    assert.strictEqual(extractSenderName('Hi Ms. Davis,\nConfirmation needed'), 'Davis');
    assert.strictEqual(extractSenderName('Good afternoon Mrs. Robinson,\nHere is the update'), 'Robinson');
    assert.strictEqual(extractSenderName('Greetings Carlos,\nWelcome aboard'), 'Carlos');
    assert.strictEqual(extractSenderName('Good day Emma,\nOrder confirmation'), 'Emma');
  });

  test('rigorously rejects all blacklisted salutations and terms, falling back to "there"', () => {
    const blacklistInputs = [
      'Dear Sir,\nI need help',
      'Dear Madam,\nOrder late',
      'Dear Sir/Madam,\nPlease assist',
      'Dear madam/sir,\nAccount locked',
      'Dear Ma\'am,\nRefund request',
      'To whom it may concern,\nCancel plan',
      'Dear concern,\nInquiry',
      'Good morning team,\nUpdate',
      'Good evening all,\nWrap up',
      'Hi everyone,\nRelease announcement',
      'Hello folks,\nMeeting rescheduled',
      'Hey colleague,\nQuick question',
      'Hey colleagues,\nTeam lunch',
      'Dear Customer,\nYour bill is ready',
      'Dear User,\nSecurity notification',
      'Dear Client,\nTerms updated',
      'Hi Friend,\nJust checking in',
      'Dear Member,\nPoints summary',
      'Hello Anyone,\nIs anyone online?',
      'Help,\nApp crashed',
      'Info,\nNeed pricing',
      'Admin,\nReset credentials',
      'Administrator,\nServer maintenance',
    ];

    for (const input of blacklistInputs) {
      const extracted = extractSenderName(input);
      assert.strictEqual(extracted, 'there', `Blacklist rejection failed for input: "${input}" (got: "${extracted}")`);
    }
  });

  test('extracts sender from From headers while ignoring bot/support/redacted headers', () => {
    assert.strictEqual(extractSenderName('From: "José Ramirez" <jose@example.com>\nSubject: Help'), 'José');
    assert.strictEqual(extractSenderName('From: Jean-Luc Picard <picard@starfleet.org>\nSubject: Log'), 'Jean-Luc');
    // Support and Team are blacklisted, so it skips them
    assert.strictEqual(extractSenderName('From: Support Team <support@draftpilot.com>\n\nHi Alice,\nI need help'), 'Alice');
    // Redacted header is skipped in favor of greeting
    assert.strictEqual(extractSenderName('From: [EMAIL_REDACTED] <[EMAIL_REDACTED]>\n\nHi Carlos,\nPlease help'), 'Carlos');
  });

  test('falls back safely to "there" for empty, blank, or symbol-only inputs', () => {
    assert.strictEqual(extractSenderName(''), 'there');
    assert.strictEqual(extractSenderName('   \t\n  '), 'there');
    assert.strictEqual(extractSenderName('!@#$%^&*()_+'), 'there');
  });
});

// ============================================================================
// CHALLENGE SUITE 3: cleanAiDraft Reasoning Sanitization & Adversarial Challenges
// ============================================================================
describe('Challenge Suite 3: cleanAiDraft Sanitization & Edge Cases', () => {
  test('strips closed <think>...</think> blocks completely', () => {
    const raw = `<think>\nInternal analysis: policy allows returns within 30 days.\n</think>\nHi there,\n\nYou can return the item within 30 days.\n\nBest regards,\nCustomer Support Team`;
    const cleaned = cleanAiDraft(raw, 'there');
    assert.ok(!cleaned.includes('<think>'));
    assert.ok(!cleaned.includes('</think>'));
    assert.ok(!cleaned.includes('Internal analysis'));
    assert.ok(cleaned.startsWith('Hi there,'));
  });

  test('strips unclosed truncated <think> tags resulting in empty string when no draft follows', () => {
    const truncated = `<think>\nThe user wants to know delivery timeline. Step 1: verify tracking number 12345. Step 2: explain that`;
    const cleaned = cleanAiDraft(truncated, 'there');
    assert.strictEqual(cleaned, '');
  });

  test('strips unclosed truncated <think> tags when draft precedes it', () => {
    const mixed = `Hi there,\n\nYour order has shipped!\n\n<think>\nTruncated internal reasoning at end of response`;
    const cleaned = cleanAiDraft(mixed, 'there');
    assert.ok(cleaned.startsWith('Hi there,'));
    assert.ok(cleaned.includes('Your order has shipped!'));
    assert.ok(!cleaned.includes('<think>'));
    assert.ok(!cleaned.includes('Truncated internal reasoning'));
  });

  test('strips multiple stacked reasoning headers (DeepSeek / Gemma / Qwen)', () => {
    const raw = `### Reasoning\n**Thinking Process:**\nDraft Reply:\nHi there,\n\nWe have credited your account.\n\nBest regards,\nCustomer Support Team`;
    const cleaned = cleanAiDraft(raw, 'there');
    assert.ok(!cleaned.includes('Reasoning'));
    assert.ok(!cleaned.includes('Thinking Process'));
    assert.ok(!cleaned.includes('Draft Reply:'));
    assert.ok(cleaned.startsWith('Hi there,'));
  });

  test('strips outer code fence wrapper when model wraps entire email in markdown block', () => {
    const wrapped = `\`\`\`markdown\nHi there,\n\nYour account has been upgraded.\n\nBest regards,\nCustomer Support Team\n\`\`\``;
    const cleaned = cleanAiDraft(wrapped, 'there');
    assert.ok(!cleaned.startsWith('```'));
    assert.ok(!cleaned.endsWith('```'));
    assert.ok(cleaned.startsWith('Hi there,'));
    assert.ok(cleaned.includes('Your account has been upgraded.'));
  });

  test('replaces placeholders and sign-off templates', () => {
    const raw = `Hi [Customer Name],\n\nThank you for contacting [Company Name].\n\nBest regards,\n[Your Name]`;
    const cleaned = cleanAiDraft(raw, 'there');
    assert.ok(cleaned.includes('DraftPilot Support'));
    assert.ok(cleaned.includes('Customer Support Team'));
  });

  // --------------------------------------------------------------------------
  // REGRESSION: Greeting Deduplication (previously EMPIRICAL BUG 1 — now fixed)
  // --------------------------------------------------------------------------
  test('cleanAiDraft does NOT duplicate customer name in greeting when customerName is specified', () => {
    const singleNameInput = 'Hi Alice,\n\nHow are you?';
    const output = cleanAiDraft(singleNameInput, 'Alice');

    console.log('[REGRESSION CHECK 1] Input: "Hi Alice," -> Output:', JSON.stringify(output.split('\n')[0]));
    // Correct behavior: greeting is NOT duplicated
    assert.strictEqual(
      output.split('\n')[0],
      'Hi Alice,',
      'cleanAiDraft must not duplicate greeting when name already present'
    );
  });

  // --------------------------------------------------------------------------
  // REGRESSION: Code Block Preservation (previously EMPIRICAL BUG 2 — now fixed)
  // --------------------------------------------------------------------------
  test('cleanAiDraft preserves email body containing embedded code blocks', () => {
    const emailWithCodeSnippet = `Hi there,\n\nPlease review your configuration settings:\n\`\`\`\nCONFIG_TIMEOUT=30000\n\`\`\`\n\nLet us know if this works!\n\nBest regards,\nCustomer Support Team`;
    const output = cleanAiDraft(emailWithCodeSnippet, 'there');

    console.log('[REGRESSION CHECK 2] Output of email with embedded code snippet:', JSON.stringify(output));
    // Correct behavior: full email body is preserved, not truncated to just the code block
    assert.ok(
      output.includes('Please review your configuration settings'),
      'cleanAiDraft must preserve email text around code blocks'
    );
    assert.ok(
      output.includes('CONFIG_TIMEOUT=30000'),
      'cleanAiDraft must preserve code block content'
    );
  });
});

// ============================================================================
// CHALLENGE SUITE 4: PII Scrubbing Preservation vs Redaction
// ============================================================================
describe('Challenge Suite 4: PII Scrubber Whitelist Preservation & Redaction Rigor', () => {
  const extraWhitelist = [
    '+8809677161161',
    'vip-support@mycorp.com',
    'https://foodibd.com/become-a-partner',
  ];

  test('preserves all default company contact emails unredacted', () => {
    const text = 'Reach out at support@draftpilot.com, help@draftpilot.com, contact@draftpilot.com, or info@draftpilot.com';
    const scrubbed = scrubPII(text);
    assert.ok(scrubbed.includes('support@draftpilot.com'));
    assert.ok(scrubbed.includes('help@draftpilot.com'));
    assert.ok(scrubbed.includes('contact@draftpilot.com'));
    assert.ok(scrubbed.includes('info@draftpilot.com'));
    assert.ok(!scrubbed.includes('[EMAIL_REDACTED]'));
  });

  test('preserves extra whitelisted email and URL unredacted', () => {
    const text = 'Visit https://foodibd.com/become-a-partner or write to vip-support@mycorp.com';
    const scrubbed = scrubPII(text, { extraWhitelist });
    assert.ok(scrubbed.includes('https://foodibd.com/become-a-partner'));
    assert.ok(scrubbed.includes('vip-support@mycorp.com'));
    assert.ok(!scrubbed.includes('[EMAIL_REDACTED]'));
  });

  test('preserves 14-digit whitelisted helpline without false-positive credit card redaction', () => {
    const text = 'Call our 24/7 helpline at +8809677161161 for assistance.';
    const scrubbed = scrubPII(text, { extraWhitelist });
    assert.ok(scrubbed.includes('+8809677161161'), 'Helpline must survive unredacted');
    assert.ok(!scrubbed.includes('[CARD_REDACTED]'), 'Helpline must NOT be redacted as credit card');
    assert.ok(!scrubbed.includes('[PHONE_REDACTED]'), 'Helpline must NOT be redacted as customer phone');
  });

  test('redacts real customer email addresses while keeping whitelisted support email in same message', () => {
    const text = 'User real.customer@gmail.com emailed support@draftpilot.com regarding a refund.';
    const scrubbed = scrubPII(text);
    assert.ok(scrubbed.includes('support@draftpilot.com'), 'Support email must be preserved');
    assert.ok(!scrubbed.includes('real.customer@gmail.com'), 'Customer email must be redacted');
    assert.ok(scrubbed.includes('[EMAIL_REDACTED]'));
  });

  test('redacts non-whitelisted draftpilot email addresses', () => {
    const text = 'Direct email ceo@draftpilot.com and dev.team@draftpilot.com';
    const scrubbed = scrubPII(text);
    assert.ok(!scrubbed.includes('ceo@draftpilot.com'));
    assert.ok(!scrubbed.includes('dev.team@draftpilot.com'));
    assert.strictEqual(scrubbed.split('[EMAIL_REDACTED]').length - 1, 2);
  });

  test('redacts real customer credit cards (both spaced and unspaced 16 digits)', () => {
    const text = 'Card A: 4532 1123 4567 8901, Card B: 5412345678901234';
    const scrubbed = scrubPII(text);
    assert.ok(!scrubbed.includes('4532'));
    assert.ok(!scrubbed.includes('5412345678901234'));
    assert.strictEqual(scrubbed.split('[CARD_REDACTED]').length - 1, 2);
  });

  test('redacts real customer phone numbers while preserving whitelisted helpline in same message', () => {
    const text = 'Helpline is +8809677161161. Customer mobile is +1-555-432-1098 or 01711223344.';
    const scrubbed = scrubPII(text, { extraWhitelist });
    assert.ok(scrubbed.includes('+8809677161161'), 'Helpline must survive');
    assert.ok(!scrubbed.includes('555-432-1098'), 'US customer phone must be redacted');
    assert.ok(!scrubbed.includes('01711223344'), 'BD customer phone must be redacted');
    assert.ok(scrubbed.includes('[PHONE_REDACTED]'));
  });

  test('redacts other PII categories: SSN, IPv4, Tokens, Passwords, Addresses', () => {
    const text = 'SSN: 123-45-6789, IP: 192.168.1.1, Token: sk-proj12345678901234567890, Password: secretpassword123, Address: 123 Main Street, Apt 4B';
    const scrubbed = scrubPII(text);
    assert.ok(scrubbed.includes('[SSN_REDACTED]'));
    assert.ok(scrubbed.includes('[IP_REDACTED]'));
    assert.ok(scrubbed.includes('[TOKEN_REDACTED]'));
    assert.ok(scrubbed.includes('[SECRET_REDACTED]'));
    assert.ok(scrubbed.includes('[ADDRESS_REDACTED]'));
  });

  test('safely rejects catastrophic backtracking ReDoS pattern in custom rules', () => {
    const maliciousRule = {
      id: 'malicious-1',
      pattern: '((a+)+)+$',
      replacement: '[MALICIOUS]',
      isRegex: true,
      enabled: true,
    };
    const start = Date.now();
    const result = scrubPII('aaaaaaaaaaaaaaaaaaaaaaaaaaaa!', { customRules: [maliciousRule] });
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 100, `Execution took ${elapsed}ms; ReDoS guard failed`);
    assert.strictEqual(result, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa!');
  });
});
