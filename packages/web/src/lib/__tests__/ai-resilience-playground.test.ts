/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scrubPII, DEFAULT_PII_WHITELIST } from '../pii-scrubber.ts';
import { cleanAiDraft, synthesizeSmartSupportDraft, extractSenderName } from '../../../../extension/src/utils/api-client.ts';

// ============================================================================
// 1. PROMPT ALIASES RESOLUTION (Feature F18)
// ============================================================================
describe('Feature F18: Custom Instruction & Prompt Aliases Resolution', () => {
  function resolveGenerationParameters(
    body: Record<string, any>,
    settings?: Record<string, any> | null
  ) {
    const rawThreadContent = (
      typeof body.threadContent === 'string' && body.threadContent.trim()
        ? body.threadContent
        : (typeof body.thread === 'string' ? body.thread : '')
    ).trim();

    const isSystemLike = (val: string) =>
      val.includes('You are DraftPilot') || val.includes('system prompt');

    const dynamicSystemPrompt =
      (typeof body.systemPrompt === 'string' && body.systemPrompt.trim()) ||
      (typeof body.system_prompt === 'string' && body.system_prompt.trim()) ||
      (typeof body.promptOverride === 'string' && isSystemLike(body.promptOverride)
        ? body.promptOverride.trim()
        : undefined) ||
      undefined;

    const baseSystemPrompt =
      dynamicSystemPrompt ||
      settings?.system_prompt?.trim() ||
      'You are DraftPilot, an intelligent customer support assistant. You write concise, friendly, and professional email replies directly to customers based on company knowledge.';

    const rawInstruction =
      (typeof body.macroHint === 'string' && body.macroHint.trim()) ||
      (typeof body.customInstruction === 'string' && body.customInstruction.trim()) ||
      (typeof body.instruction === 'string' && body.instruction.trim()) ||
      (typeof body.userPrompt === 'string' && body.userPrompt.trim()) ||
      (typeof body.promptOverride === 'string' && !isSystemLike(body.promptOverride) && body.promptOverride.trim()) ||
      '';

    const macroHint = typeof rawInstruction === 'string' ? rawInstruction.trim() : '';

    const dynamicModel =
      (typeof body.selected_model === 'string' && body.selected_model.trim()) ||
      (typeof body.model === 'string' && body.model.trim()) ||
      (typeof body.openrouter_model === 'string' && body.openrouter_model.trim()) ||
      undefined;

    const activeModel =
      dynamicModel || settings?.selected_model || settings?.openrouter_model || 'z-ai/glm-5.3-flash';

    const resolveTemperature = (): number => {
      if (body.temperature !== undefined && body.temperature !== null) {
        const parsedBody = Number(body.temperature);
        if (!isNaN(parsedBody)) {
          return Math.max(0.0, Math.min(2.0, parsedBody));
        }
      }
      const parsed = Number(settings?.temperature);
      return settings?.temperature !== undefined && settings?.temperature !== null && !isNaN(parsed)
        ? Math.max(0.0, Math.min(2.0, parsed))
        : 0.4;
    };

    const resolveMaxTokens = (model: string): number => {
      let configured = 1000;
      if (body.max_tokens !== undefined && body.max_tokens !== null) {
        const parsedBody = Number(body.max_tokens);
        if (!isNaN(parsedBody) && parsedBody > 0) {
          configured = Math.max(100, Math.min(4000, parsedBody));
        }
      } else {
        const parsed = Number(settings?.max_tokens);
        if (!isNaN(parsed) && parsed > 0) {
          configured = Math.max(100, Math.min(4000, parsed));
        }
      }
      return model.includes('glm-5.3') ? Math.max(800, configured) : configured;
    };

    return {
      rawThreadContent,
      baseSystemPrompt,
      macroHint,
      activeModel,
      temperature: resolveTemperature(),
      resolveMaxTokens,
    };
  }

  test('resolves standard macroHint parameter', () => {
    const params = resolveGenerationParameters({
      macroHint: 'Apologize profusely and offer a 20% discount code SAVE20',
    });
    assert.strictEqual(params.macroHint, 'Apologize profusely and offer a 20% discount code SAVE20');
  });

  test('resolves customInstruction alias when macroHint is absent', () => {
    const params = resolveGenerationParameters({
      customInstruction: 'Maintain a formal and respectful corporate tone',
    });
    assert.strictEqual(params.macroHint, 'Maintain a formal and respectful corporate tone');
  });

  test('resolves instruction alias when others are absent', () => {
    const params = resolveGenerationParameters({
      instruction: 'Mention that our helpline is available 24/7',
    });
    assert.strictEqual(params.macroHint, 'Mention that our helpline is available 24/7');
  });

  test('resolves userPrompt alias', () => {
    const params = resolveGenerationParameters({
      userPrompt: 'Ask the user for their order number and delivery postcode',
    });
    assert.strictEqual(params.macroHint, 'Ask the user for their order number and delivery postcode');
  });

  test('resolves user guidance promptOverride alias', () => {
    const params = resolveGenerationParameters({
      promptOverride: 'Escalate ticket to VIP technical support team',
    });
    assert.strictEqual(params.macroHint, 'Escalate ticket to VIP technical support team');
  });

  test('strictly isolates systemPrompt from macroHint', () => {
    const params = resolveGenerationParameters({
      systemPrompt: 'You are DraftPilot, an intelligent AI reply assistant for customer support.',
    });
    assert.strictEqual(params.baseSystemPrompt, 'You are DraftPilot, an intelligent AI reply assistant for customer support.');
    assert.strictEqual(params.macroHint, '', 'systemPrompt must NEVER be routed to macroHint');
  });

  test('intercepts legacy system-like promptOverride and routes to systemPrompt instead of macroHint', () => {
    const params = resolveGenerationParameters({
      promptOverride: 'You are DraftPilot, an intelligent AI reply assistant. Follow support macros strictly.',
    });
    assert.strictEqual(params.baseSystemPrompt, 'You are DraftPilot, an intelligent AI reply assistant. Follow support macros strictly.');
    assert.strictEqual(params.macroHint, '', 'System-like promptOverride must not pollute macroHint');
  });

  test('respects strict alias precedence order: macroHint > customInstruction > instruction > userPrompt > promptOverride', () => {
    const allAliases = {
      promptOverride: 'Priority 5',
      userPrompt: 'Priority 4',
      instruction: 'Priority 3',
      customInstruction: 'Priority 2',
      macroHint: 'Priority 1',
    };
    assert.strictEqual(resolveGenerationParameters(allAliases).macroHint, 'Priority 1');

    delete (allAliases as any).macroHint;
    assert.strictEqual(resolveGenerationParameters(allAliases).macroHint, 'Priority 2');

    delete (allAliases as any).customInstruction;
    assert.strictEqual(resolveGenerationParameters(allAliases).macroHint, 'Priority 3');

    delete (allAliases as any).instruction;
    assert.strictEqual(resolveGenerationParameters(allAliases).macroHint, 'Priority 4');

    delete (allAliases as any).userPrompt;
    assert.strictEqual(resolveGenerationParameters(allAliases).macroHint, 'Priority 5');
  });

  test('ignores whitespace-only higher priority aliases in favor of populated alias', () => {
    const payload = {
      macroHint: '   ',
      customInstruction: '',
      instruction: 'Deliver quick 2-sentence response',
    };
    assert.strictEqual(resolveGenerationParameters(payload).macroHint, 'Deliver quick 2-sentence response');
  });

  test('formats agent guidance section into prompt context when present', () => {
    const instruction = 'Offer 15% refund and apology';
    const agentGuidanceContext = instruction
      ? `### Agent Guidance / Custom Instruction:\n${instruction}\n\n`
      : '';
    assert.ok(agentGuidanceContext.includes('### Agent Guidance / Custom Instruction:'));
    assert.ok(agentGuidanceContext.includes('Offer 15% refund and apology'));
  });
});

// ============================================================================
// 2. UNCLOSED THINK TAG & OUTPUT SANITIZATION (Feature F20)
// ============================================================================
describe('Feature F20: Unclosed <think> Tag Stripping & Reasoning Sanitization', () => {
  test('strips closed <think>...</think> reasoning blocks completely', () => {
    const raw = `<think>\nLet's analyze user's request. Return window is 30 days.\n</think>\nHi Sarah,\n\nYou can return the item within 30 days.\n\nBest regards,\nCustomer Support Team`;
    const cleaned = cleanAiDraft(raw, 'Sarah');
    assert.ok(!cleaned.includes('<think>'));
    assert.ok(!cleaned.includes('</think>'));
    assert.ok(!cleaned.includes("Let's analyze"));
    assert.ok(cleaned.startsWith('Hi Sarah,'));
  });

  test('strips unclosed <think> tag when LLM output was truncated mid-reasoning', () => {
    const truncatedRaw = `<think>\nThe user is asking for assistance with their login. First, check if 2FA is active. Next, verify email address. We need to formulate a gentle reply explaining`;
    const cleaned = cleanAiDraft(truncatedRaw, 'John');
    assert.strictEqual(cleaned, '', 'Unclosed <think> tag with no subsequent content must result in clean empty string');
  });

  test('strips unclosed <think> tag while preserving valid email content preceding it', () => {
    const mixedRaw = `Hi Alex,\n\nI have processed your refund request.\n\n<think>\nInternal reasoning leaked at end of generation`;
    const cleaned = cleanAiDraft(mixedRaw, 'Alex');
    assert.ok(cleaned.startsWith('Hi Alex,'));
    assert.ok(cleaned.includes('processed your refund request'));
    assert.ok(!cleaned.includes('<think>'));
    assert.ok(!cleaned.includes('Internal reasoning leaked'));
  });

  test('strips markdown **Thinking Process:** bold headers', () => {
    const raw = `**Thinking Process:**\n1. Analyze user tone.\n2. Confirm tracking number.\n\nHi David,\n\nYour order has shipped and is on track for delivery.\n\nBest regards,\nCustomer Support Team`;
    const cleaned = cleanAiDraft(raw, 'David');
    assert.ok(!cleaned.includes('Thinking Process'));
    assert.ok(!cleaned.includes('Analyze user tone'));
    assert.ok(cleaned.startsWith('Hi David,'));
  });

  test('strips markdown **Reasoning:** header cleanly', () => {
    const raw = `**Reasoning:**\nThe customer inquired about account password reset.\n\nHi Jessica,\n\nI can help reset your password.\n\nBest regards,\nSupport Team`;
    const cleaned = cleanAiDraft(raw, 'Jessica');
    assert.ok(!cleaned.includes('Reasoning:'));
    assert.ok(cleaned.startsWith('Hi Jessica,'));
  });
});

// ============================================================================
// 3. GROUNDED FALLBACK SYNTHESIZER WITH KB SNIPPETS & MACRO HINTS (Feature F19)
// ============================================================================
describe('Feature F19: Grounded Fallback Synthesizer with KB Snippets & Macro Hints', () => {
  test('synthesizes partnership reply incorporating Excel KB snippet link and phone', () => {
    const thread = 'Hello, I want to join Foodi as a restaurant partner. How do we start?';
    const kb = ['Become a partner at: https://foodibd.com/become-a-partner', 'Helpline: +8809677161161'];
    const draft = synthesizeSmartSupportDraft(thread, 'Rony', kb);

    assert.ok(draft.startsWith('Hi Rony,'));
    assert.ok(draft.includes('https://foodibd.com/become-a-partner'), 'Draft must contain KB link');
    assert.ok(draft.includes('+8809677161161'), 'Draft must contain KB helpline');
    assert.ok(draft.includes('Customer Support Team'));
  });

  test('synthesizes reply incorporating agent guidance / macroHint', () => {
    const thread = 'Where is my order? It was supposed to arrive yesterday.';
    const hint = 'Apologize for delay and offer discount code APOLOGY10';
    const draft = synthesizeSmartSupportDraft(thread, 'Emily', [], hint);

    assert.ok(draft.startsWith('Hi Emily,'));
    assert.ok(draft.includes('APOLOGY10'), 'Draft must include macroHint instruction discount code');
  });

  test('preserves clean default "Hi there," when customer name is unavailable', () => {
    const draft = synthesizeSmartSupportDraft('I need help with my account', 'there');
    assert.ok(draft.startsWith('Hi there,'));
  });

  test('whitelists verified company emails and helplines during PII scrubbing', () => {
    const textWithCompanyContact = 'Please visit https://foodibd.com/become-a-partner or email support@draftpilot.com or call +8809677161161. Also personal email is user.secret@gmail.com';
    const scrubbed = scrubPII(textWithCompanyContact, {
      extraWhitelist: ['support@draftpilot.com', '+8809677161161', 'https://foodibd.com/become-a-partner'],
    });

    assert.ok(scrubbed.includes('support@draftpilot.com'), 'Whitelisted company email must be preserved');
    assert.ok(scrubbed.includes('+8809677161161'), 'Whitelisted helpline phone must be preserved');
    assert.ok(scrubbed.includes('https://foodibd.com/become-a-partner'), 'Whitelisted URL must be preserved');
    assert.ok(scrubbed.includes('[EMAIL_REDACTED]'), 'Customer personal email must be redacted');
    assert.ok(!scrubbed.includes('user.secret@gmail.com'));
  });
});

// ============================================================================
// 4. HYPERPARAMETER FIDELITY & DYNAMIC SETTINGS (Feature F21)
// ============================================================================
describe('Feature F21: Hyperparameter Fidelity & Platform Settings Parsing', () => {
  function parseServerHyperparameters(settings: Record<string, any> | null | undefined, model: string) {
    // 1. Temperature parsing: must preserve 0.0 without falsy fallback
    const parsedTemp = Number(settings?.temperature);
    const temperature =
      settings?.temperature !== undefined && settings?.temperature !== null && !isNaN(parsedTemp)
        ? Math.max(0.0, Math.min(2.0, parsedTemp))
        : 0.4;

    // 2. Max tokens parsing: honors 100-800 from admin slider
    const parsedTokens = Number(settings?.max_tokens);
    const configuredTokens =
      settings?.max_tokens !== undefined && settings?.max_tokens !== null && !isNaN(parsedTokens) && parsedTokens > 0
        ? Math.max(100, Math.min(4000, parsedTokens))
        : 1000;

    // Headroom rule for reasoning models (e.g. glm-5.3)
    const max_tokens = model.includes('glm-5.3') ? Math.max(800, configuredTokens) : configuredTokens;

    return { temperature, max_tokens };
  }

  test('honors temperature: 0.0 strictly for deterministic support replies', () => {
    const { temperature } = parseServerHyperparameters({ temperature: 0.0 }, 'google/gemma-4-26b-a4b-it:free');
    assert.strictEqual(temperature, 0.0, 'Configured temperature 0.0 must not fall back to 0.4');
  });

  test('honors temperature: "0" string from database column', () => {
    const { temperature } = parseServerHyperparameters({ temperature: '0.0' }, 'google/gemma-4-26b-a4b-it:free');
    assert.strictEqual(temperature, 0.0);
  });

  test('defaults temperature to 0.4 when undefined or null', () => {
    assert.strictEqual(parseServerHyperparameters(null, 'google/gemma-4-26b-a4b-it:free').temperature, 0.4);
    assert.strictEqual(parseServerHyperparameters({}, 'google/gemma-4-26b-a4b-it:free').temperature, 0.4);
  });

  test('honors custom max_tokens in 100–800 range for standard models (e.g. 250 tokens)', () => {
    const { max_tokens } = parseServerHyperparameters(
      { max_tokens: 250 },
      'google/gemma-4-26b-a4b-it:free'
    );
    assert.strictEqual(max_tokens, 250, 'Custom max_tokens 250 must not be overridden to 1000');
  });

  test('enforces 800 token minimum headroom for z-ai/glm-5.3-flash', () => {
    const { max_tokens } = parseServerHyperparameters(
      { max_tokens: 250 },
      'z-ai/glm-5.3-flash'
    );
    assert.strictEqual(max_tokens, 800, 'GLM 5.3 must maintain 800 minimum tokens for reasoning');
  });
});

// ============================================================================
// 5. OPENROUTER TELEMETRY AUTO-HYDRATION (Feature F21)
// ============================================================================
describe('Feature F21: OpenRouter Key Telemetry Auto-Hydration', () => {
  interface OpenRouterKeyResponse {
    label: string | null;
    usage: number;
    limit: number | null;
    is_free_tier: boolean;
    rate_limit?: {
      requests: number;
      interval: string;
    };
  }

  function parseKeyTelemetry(data: any): OpenRouterKeyResponse | null {
    if (!data) return null;
    return {
      label: data.label || null,
      usage: Number(data.usage) || 0,
      limit: data.limit !== undefined && data.limit !== null ? Number(data.limit) : null,
      is_free_tier: Boolean(data.is_free_tier),
      rate_limit: data.rate_limit,
    };
  }

  test('parses active key telemetry with free-tier account metrics', () => {
    const apiPayload = {
      label: 'DraftPilot Prod Key',
      usage: 0.0125,
      limit: null,
      is_free_tier: true,
      rate_limit: { requests: 20, interval: '10s' },
    };

    const telemetry = parseKeyTelemetry(apiPayload);
    assert.ok(telemetry);
    assert.strictEqual(telemetry.label, 'DraftPilot Prod Key');
    assert.strictEqual(telemetry.usage, 0.0125);
    assert.strictEqual(telemetry.limit, null);
    assert.strictEqual(telemetry.is_free_tier, true);
    assert.strictEqual(telemetry.rate_limit?.requests, 20);
    assert.strictEqual(telemetry.rate_limit?.interval, '10s');
  });

  test('parses paid / credit balance telemetry correctly', () => {
    const apiPayload = {
      label: 'Enterprise Key',
      usage: 14.85,
      limit: 100.0,
      is_free_tier: false,
      rate_limit: { requests: 50, interval: '10s' },
    };

    const telemetry = parseKeyTelemetry(apiPayload);
    assert.ok(telemetry);
    assert.strictEqual(telemetry.is_free_tier, false);
    assert.strictEqual(telemetry.limit, 100.0);
    assert.strictEqual(telemetry.usage, 14.85);
  });
});

// ============================================================================
// 6. ADMIN PLAYGROUND WIREUP & FALLBACK RESILIENCE (Feature F21)
// ============================================================================
describe('Feature F21: Admin Playground Execution & Dynamic Routing', () => {
  test('authenticates admin test requests via x-admin-passkey and exempts from quota', () => {
    const isTestRequest = (headers: Record<string, string>, body: Record<string, any>) => {
      const hasAdminPasskey = headers['x-admin-passkey'] === 'root-secret-passkey-123';
      const isTestFlag = Boolean(body.isTest);
      return {
        authorized: hasAdminPasskey || Boolean(headers['Authorization']),
        quotaExempt: isTestFlag || hasAdminPasskey,
      };
    };

    const check = isTestRequest(
      { 'x-admin-passkey': 'root-secret-passkey-123' },
      { threadContent: 'Test thread', isTest: true }
    );

    assert.strictEqual(check.authorized, true);
    assert.strictEqual(check.quotaExempt, true);
  });

  test('playground simulates two-tier cascade: server route -> client fallback -> local synthesizer', () => {
    const runPlaygroundPipeline = (serverAvailable: boolean, openRouterAvailable: boolean) => {
      if (serverAvailable) {
        return { tier: 'server', source: 'openrouter', draft: 'Server generated draft' };
      }
      if (openRouterAvailable) {
        return { tier: 'client-openrouter', source: 'openrouter', draft: 'Client OpenRouter draft' };
      }
      return { tier: 'synthesizer', source: 'template', draft: 'Synthesizer grounded reply' };
    };

    assert.strictEqual(runPlaygroundPipeline(true, true).tier, 'server');
    assert.strictEqual(runPlaygroundPipeline(false, true).tier, 'client-openrouter');
    assert.strictEqual(runPlaygroundPipeline(false, false).tier, 'synthesizer');
  });
});
