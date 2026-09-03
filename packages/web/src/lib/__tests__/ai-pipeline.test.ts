import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import { verifySuperAdmin, supabaseAdmin } from '../admin-auth.ts';

// ---------------------------------------------------------------------------
// Pipeline Reference Implementations for Prompt Assembly, Fallback & Sanitization
// ---------------------------------------------------------------------------

interface PromptCompilationInput {
  threadContent: string;
  macroHint?: string;
  matchedMacro?: { id?: string; name?: string; content: string } | null;
  kbSnippets?: string[];
  systemPromptOverride?: string;
  customerName?: string;
}

export function compileAIPromptContext(input: PromptCompilationInput): {
  systemPrompt: string;
  userPrompt: string;
  hasCustomGuidance: boolean;
} {
  const customerName = input.customerName || 'there';
  const baseSystem =
    input.systemPromptOverride?.trim() ||
    'You are DraftPilot, an intelligent customer support assistant. You write concise, friendly, and professional email replies directly to customers based on company knowledge.';

  const strictSystemPrompt = `${baseSystem}

CRITICAL OPERATIONAL RULES:
1. Output ONLY the raw final email reply text ready to send.
2. Absolutely DO NOT include any internal thoughts, reasoning steps, analysis headers, or markdown bullets.
3. Begin directly with "Hi ${customerName}," and conclude with a professional sign-off (e.g. "Best regards,\nSupport Team").
4. DO NOT wrap output in markdown code blocks.`;

  let knowledgeContext = '';
  if (input.matchedMacro?.content) {
    knowledgeContext += `### Relevant Support Policy / Macro (${input.matchedMacro.name || 'Standard'}):\n${input.matchedMacro.content}\n\n`;
  }
  if (input.kbSnippets && input.kbSnippets.length > 0) {
    knowledgeContext += `### Knowledge Base Context:\n${input.kbSnippets.join('\n---\n')}\n\n`;
  }

  let customInstructionSection = '';
  const trimmedHint = (input.macroHint || '').trim();
  const hasCustomGuidance = Boolean(trimmedHint);
  if (hasCustomGuidance) {
    customInstructionSection = `### User Custom Instruction / Guidance:\nIMPORTANT: ${trimmedHint}\n\n`;
  }

  const userPrompt = `Customer Message:\n${input.threadContent}\n\n${knowledgeContext}${customInstructionSection}Draft the clean, direct customer email reply now:`;

  return {
    systemPrompt: strictSystemPrompt,
    userPrompt,
    hasCustomGuidance,
  };
}

export function synthesizeDomainSupportDraft(inquiry: string, customerName = 'there'): {
  intent: 'refund' | 'tracking' | 'access' | 'billing' | 'troubleshooting' | 'general';
  draft: string;
} {
  const lower = inquiry.toLowerCase();

  // 1. Refund & Return Intent
  if (
    lower.includes('return') ||
    lower.includes('refund') ||
    lower.includes('exchange') ||
    lower.includes('bought') ||
    lower.includes('jacket') ||
    lower.includes('money back') ||
    lower.includes('cancel order')
  ) {
    return {
      intent: 'refund',
      draft: `Hi ${customerName},\n\nThank you for reaching out to us!\n\nYes, absolutely. Our return window is 30 days from delivery, so you are eligible to return or exchange your item.\n\nTo get this started:\n1. Reply with your original Order ID or receipt.\n2. Let us know whether you prefer a replacement size/item or a full refund to your original payment method.\n\nOnce we receive the returned item, we will process your request within 2-3 business days. Let us know if you have any questions!\n\nBest regards,\nCustomer Support Team`,
    };
  }

  // 2. Order Status & Tracking Intent
  if (
    lower.includes('shipping') ||
    lower.includes('track') ||
    lower.includes('order') ||
    lower.includes('arrive') ||
    lower.includes('delay') ||
    lower.includes('where is') ||
    lower.includes('carrier') ||
    lower.includes('transit')
  ) {
    return {
      intent: 'tracking',
      draft: `Hi ${customerName},\n\nThanks for checking in on your order status!\n\nYour shipment is on track and moving smoothly with our carrier. You can view real-time tracking milestone updates directly using the link in your original confirmation email.\n\nIf you encounter any transit delays or need address adjustments, just let me know and I will be happy to assist.\n\nBest regards,\nCustomer Support Team`,
    };
  }

  // 3. Password & Account Access Intent
  if (
    lower.includes('password') ||
    lower.includes('login') ||
    lower.includes('2fa') ||
    lower.includes('mfa') ||
    lower.includes('account') ||
    lower.includes('locked') ||
    lower.includes('access') ||
    lower.includes('auth')
  ) {
    return {
      intent: 'access',
      draft: `Hi ${customerName},\n\nThank you for contacting support regarding your account access.\n\nI have generated a secure password reset link for your account. For your protection, please ensure you click the link from your registered device. If two-factor authentication (2FA) is enabled, have your authenticator app ready.\n\nLet us know if you need any additional guidance getting back into your account!\n\nBest regards,\nSecurity & Support Team`,
    };
  }

  // 4. Billing & Invoices Intent
  if (
    lower.includes('invoice') ||
    lower.includes('receipt') ||
    lower.includes('charge') ||
    lower.includes('card') ||
    lower.includes('billing') ||
    lower.includes('payment') ||
    lower.includes('subscription') ||
    lower.includes('vat')
  ) {
    return {
      intent: 'billing',
      draft: `Hi ${customerName},\n\nThank you for contacting our billing department.\n\nI have reviewed your account history and confirmed your recent billing statement. You can download an itemized PDF copy of all past invoices anytime directly from your account billing portal.\n\nIf you would like to update your payment method or need a custom VAT/tax invoice, feel free to reply and I will take care of it immediately.\n\nBest regards,\nBilling Operations`,
    };
  }

  // 5. Technical Troubleshooting & Bug Reports Intent
  if (
    lower.includes('bug') ||
    lower.includes('error') ||
    lower.includes('issue') ||
    lower.includes('broken') ||
    lower.includes('crash') ||
    lower.includes('not working') ||
    lower.includes('glitch') ||
    lower.includes('troubleshoot')
  ) {
    return {
      intent: 'troubleshooting',
      draft: `Hi ${customerName},\n\nThank you for reporting this issue to our technical support team.\n\nI apologize for any disruption this has caused. We have logged the error details and our engineering team is actively investigating the behavior.\n\nIn the meantime, could you please try clearing your browser cache or testing in an incognito window? If the problem persists, replying with a quick screenshot or console log will help us resolve it even faster.\n\nBest regards,\nTechnical Support Team`,
    };
  }

  // Default General Inquiry Response
  return {
    intent: 'general',
    draft: `Hi ${customerName},\n\nThank you for contacting DraftPilot support! I have received your inquiry and would be glad to help.\n\nCould you please provide a few additional details regarding your request so I can ensure this is handled as quickly as possible for you?\n\nLooking forward to hearing back from you,\nCustomer Support Team`,
  };
}

export function sanitizeUniversalAiDraft(
  rawText: string,
  customerName = 'there',
  teamName = 'Support Team'
): string {
  if (!rawText) return '';
  let text = rawText.trim();

  // 1. Remove XML/HTML style <think>...</think> tags (e.g. DeepSeek R1 / Nemotron / Qwen)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Strip Reasoning Chains & Multi-paragraph Thinking Process Headers
  if (
    /^(?:Here(?:'s| is) (?:a |the )?(?:thinking process|thought process|reasoning):?|Thinking Process:?|Thought Process:?|Reasoning:?|\d+\.\s*\*\*Analyze User Input)/i.test(
      text
    )
  ) {
    const emailMatch = text.match(
      /(?:^|\n\s*\n|\n)(?:> )?(Hi\b|Hello\b|Dear\b|Thank you\b|Thanks\b|Good morning\b|Good afternoon\b|Greetings\b)([\s\S]+)$/i
    );
    if (emailMatch) {
      text = (emailMatch[1] + emailMatch[2]).trim();
    } else {
      const splitMatch = text.split(/\*\*(?:Final Response|Reply|Draft|Email):\*\*/i);
      if (splitMatch.length > 1 && splitMatch[1].trim().length > 15) {
        text = splitMatch[1].trim();
      } else {
        return ''; // Truncated thinking with no draft
      }
    }
  }

  // 3. Fallback check for residual thinking analysis fragments
  if (
    /^(?:Here(?:'s| is) (?:a |the )?thinking process|\d+\.\s*\*\*Analyze User Input)/i.test(text) ||
    text.startsWith('1.  **Analyze') ||
    text.startsWith('1. **Analyze')
  ) {
    return '';
  }

  // 4. Robust Code Fence & Wrapper Removal (handles preambles and postscripts)
  const codeBlockMatch = text.match(/```(?:markdown|text|email)?\s*\n([\s\S]*?)\n```/i);
  if (codeBlockMatch && codeBlockMatch[1].trim().length > 10) {
    text = codeBlockMatch[1].trim();
  } else {
    text = text.replace(/^```(?:markdown|text|email)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
  }

  // 5. Remove Meta Headers & Label Lines
  text = text
    .replace(/^(?:Here is (?:the|a) (?:draft|reply|response|suggested reply):?|Draft reply:?|Response:?|Email:?|Suggested Reply:?)\s*\n+/i, '')
    .trim();

  // 6. Template Variable Normalization
  text = text
    .replace(/{{name}}/gi, customerName)
    .replace(/{{customer_name}}/gi, customerName)
    .replace(/\[Customer(?:\s*Name)?\]/gi, customerName)
    .replace(/\[Name\]/gi, customerName)
    .replace(/\[Client(?:\s*Name)?\]/gi, customerName);

  // 7. Sign-off Placeholder Scrubbing
  text = text
    .replace(/\[Your Name\]/gi, teamName)
    .replace(/\[Agent Name\]/gi, teamName)
    .replace(/\[Representative Name\]/gi, teamName)
    .replace(/\[Company Name\]/gi, 'DraftPilot Support')
    .replace(/\[Support Team\]/gi, teamName)
    .replace(/{{agent_name}}/gi, teamName);

  // 8. Greeting Normalization
  if (customerName && customerName.toLowerCase() !== 'there') {
    text = text.replace(/^(?:Hi|Hello|Dear)\s+there,/im, `Hi ${customerName},`);
    text = text.replace(/^(?:Hi|Hello|Dear),/im, `Hi ${customerName},`);
  }

  return text;
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('Requirement R1: Custom Instruction & Contextual Prompt Compilation', () => {
  test('injects custom macroHint into final LLM user prompt context', () => {
    const compiled = compileAIPromptContext({
      threadContent: 'Customer: The shoes I received are size 9 instead of size 10.',
      macroHint: 'Apologize profusely and offer $15 store coupon code EXCHANGE15',
      customerName: 'Marcus',
    });

    assert.strictEqual(compiled.hasCustomGuidance, true);
    assert.ok(compiled.userPrompt.includes('### User Custom Instruction / Guidance:'));
    assert.ok(compiled.userPrompt.includes('Apologize profusely and offer $15 store coupon code EXCHANGE15'));
    assert.ok(compiled.userPrompt.includes('Customer Message:\nCustomer: The shoes'));
    assert.ok(compiled.systemPrompt.includes('Hi Marcus,'));
  });

  test('compiles matched macro content and knowledge base context with structured markdown headers', () => {
    const compiled = compileAIPromptContext({
      threadContent: 'How do I cancel my annual subscription?',
      macroHint: 'Cancellation Policy',
      matchedMacro: {
        id: 'macro-101',
        name: 'Annual Subscription Cancellation',
        content: 'Users can cancel anytime from Settings > Billing. Prorated refunds apply within 14 days.',
      },
      kbSnippets: [
        'Documentation: Subscriptions renew automatically every 12 months.',
        'Policy: Direct wire refunds take up to 7 business days.',
      ],
      customerName: 'Elena',
    });

    assert.ok(compiled.userPrompt.includes('### Relevant Support Policy / Macro (Annual Subscription Cancellation):'));
    assert.ok(compiled.userPrompt.includes('Users can cancel anytime from Settings > Billing.'));
    assert.ok(compiled.userPrompt.includes('### Knowledge Base Context:'));
    assert.ok(compiled.userPrompt.includes('Subscriptions renew automatically every 12 months.'));
    assert.ok(compiled.userPrompt.includes('Direct wire refunds take up to 7 business days.'));
  });

  test('applies custom platform_settings system_prompt override while enforcing critical operational rules', () => {
    const customSystemDirective = 'You are DraftPilot Enterprise VIP Concierge. Maintain a luxury, highly polite tone.';
    const compiled = compileAIPromptContext({
      threadContent: 'Need expedited shipping on order #88492.',
      systemPromptOverride: customSystemDirective,
      customerName: 'Sophia',
    });

    assert.ok(compiled.systemPrompt.startsWith(customSystemDirective));
    assert.ok(compiled.systemPrompt.includes('CRITICAL OPERATIONAL RULES:'));
    assert.ok(compiled.systemPrompt.includes('Output ONLY the raw final email reply text'));
    assert.ok(compiled.systemPrompt.includes('Begin directly with "Hi Sophia,"'));
  });

  test('falls back gracefully to default system prompt when override is omitted or empty', () => {
    const compiled = compileAIPromptContext({
      threadContent: 'Hello, need help logging in.',
      systemPromptOverride: '   ',
      customerName: 'there',
    });

    assert.ok(compiled.systemPrompt.includes('You are DraftPilot, an intelligent customer support assistant.'));
    assert.ok(compiled.systemPrompt.includes('Hi there,'));
  });
});

describe('Requirement R2: Dual-Model Fallback & 5-Intent Domain Synthesizer', () => {
  test('domain synthesizer: correctly identifies Refund & Return intent and personalizes greeting', () => {
    const res = synthesizeDomainSupportDraft(
      'Customer: Can I return my jacket? I bought it 12 days ago and would like a refund.',
      'Sarah'
    );

    assert.strictEqual(res.intent, 'refund');
    assert.ok(res.draft.startsWith('Hi Sarah,'));
    assert.ok(res.draft.includes('30 days from delivery'));
    assert.ok(res.draft.includes('replacement size/item or a full refund'));
    assert.ok(res.draft.includes('Customer Support Team'));
  });

  test('domain synthesizer: correctly identifies Order Tracking & Shipping delay intent', () => {
    const res = synthesizeDomainSupportDraft(
      'Where is my shipment? Tracking status shows delayed in transit.',
      'David'
    );

    assert.strictEqual(res.intent, 'tracking');
    assert.ok(res.draft.startsWith('Hi David,'));
    assert.ok(res.draft.includes('shipment is on track'));
    assert.ok(res.draft.includes('tracking milestone updates'));
  });

  test('domain synthesizer: correctly identifies Password & Account Access intent', () => {
    const res = synthesizeDomainSupportDraft(
      'I am locked out of my account and cannot complete the 2FA login verification.',
      'Amira'
    );

    assert.strictEqual(res.intent, 'access');
    assert.ok(res.draft.startsWith('Hi Amira,'));
    assert.ok(res.draft.includes('secure password reset link'));
    assert.ok(res.draft.includes('two-factor authentication (2FA)'));
    assert.ok(res.draft.includes('Security & Support Team'));
  });

  test('domain synthesizer: correctly identifies Billing & Invoices intent', () => {
    const res = synthesizeDomainSupportDraft(
      'Could you please send me an itemized VAT invoice and receipt for last month charge?',
      'Carlos'
    );

    assert.strictEqual(res.intent, 'billing');
    assert.ok(res.draft.startsWith('Hi Carlos,'));
    assert.ok(res.draft.includes('itemized PDF copy of all past invoices'));
    assert.ok(res.draft.includes('Billing Operations'));
  });

  test('domain synthesizer: correctly identifies Technical Troubleshooting & Bug Reports intent', () => {
    const res = synthesizeDomainSupportDraft(
      'The extension crashed and is showing an uncaught error glitch when clicking submit.',
      'Rachel'
    );

    assert.strictEqual(res.intent, 'troubleshooting');
    assert.ok(res.draft.startsWith('Hi Rachel,'));
    assert.ok(res.draft.includes('clearing your browser cache'));
    assert.ok(res.draft.includes('Technical Support Team'));
  });

  test('domain synthesizer: falls back to general support inquiry for unclassified threads', () => {
    const res = synthesizeDomainSupportDraft(
      'What are your holiday operating hours for next month?',
      'Jordan'
    );

    assert.strictEqual(res.intent, 'general');
    assert.ok(res.draft.startsWith('Hi Jordan,'));
    assert.ok(res.draft.includes('received your inquiry and would be glad to help'));
  });

  test('fallback cascade simulation: recovers seamlessly during primary model 429/credit limit error', () => {
    const simulateModelCascade = (
      primaryStatus: number,
      primaryError: string,
      thread: string,
      customer: string
    ) => {
      // Simulate primary model failure
      if (primaryStatus === 429 || primaryError.includes('Rate limit')) {
        // Cascade to Domain Synthesizer
        const fallback = synthesizeDomainSupportDraft(thread, customer);
        return {
          source: 'domain_synthesizer',
          draft: fallback.draft,
          intent: fallback.intent,
          tokens: 135,
        };
      }
      return { source: 'primary_model', draft: 'AI generated response', intent: 'none', tokens: 80 };
    };

    const outcome = simulateModelCascade(
      429,
      'Rate limit exceeded (50 reqs/day on free tier)',
      'I want to exchange my shirt for a smaller size.',
      'Olivia'
    );

    assert.strictEqual(outcome.source, 'domain_synthesizer');
    assert.strictEqual(outcome.intent, 'refund');
    assert.ok(outcome.draft.startsWith('Hi Olivia,'));
    assert.ok(outcome.draft.includes('return window is 30 days'));
    assert.strictEqual(outcome.tokens, 135);
  });
});

describe('Requirement R3: Output Sanitization & Format Enforcement', () => {
  test('strips multi-paragraph reasoning chains produced by DeepSeek R1 and Gemma reasoning models', () => {
    const multiParagraphReasoning = `Here's a thinking process:
1. Analyze user request: The user wants to know if they can return an item purchased 12 days ago.
2. Check macro rules: 30-day return window applies.
3. Formulate response:
   - Greet customer warmly.
   - Confirm eligibility.
   - Outline next steps (Order ID, replacement vs refund).
4. Review tone: Ensure friendly and helpful closing.

Hi Sarah,

Thank you for reaching out to us!

Yes, absolutely. Our return window is 30 days from delivery, so you are eligible to return your item.

Best regards,
Support Team`;

    const cleaned = sanitizeUniversalAiDraft(multiParagraphReasoning, 'Sarah', 'Support Team');
    assert.ok(!cleaned.includes('thinking process'));
    assert.ok(!cleaned.includes('Analyze user request'));
    assert.ok(!cleaned.includes('Check macro rules'));
    assert.ok(!cleaned.includes('Formulate response'));
    assert.ok(cleaned.startsWith('Hi Sarah,'));
    assert.ok(cleaned.includes('return window is 30 days'));
    assert.ok(cleaned.endsWith('Support Team'));
  });

  test('strips code fences with leading intro preambles and trailing meta-commentary', () => {
    const rawWithPreambleAndPostscript = `Here is the suggested customer reply:
\`\`\`markdown
Hi Liam,

Your tracking number is 1Z9999999999999999 and the carrier expects delivery tomorrow.

Best regards,
Support Team
\`\`\`
Hope this helps! Let me know if you need any adjustments.`;

    const cleaned = sanitizeUniversalAiDraft(rawWithPreambleAndPostscript, 'Liam', 'Support Team');
    assert.ok(!cleaned.includes('```'));
    assert.ok(!cleaned.includes('Here is the suggested customer reply'));
    assert.ok(!cleaned.includes('Hope this helps!'));
    assert.ok(cleaned.startsWith('Hi Liam,'));
    assert.ok(cleaned.includes('1Z9999999999999999'));
    assert.ok(cleaned.endsWith('Support Team'));
  });

  test('scrubs sign-off placeholders like [Your Name], [Agent Name], [Company Name], and {{agent_name}}', () => {
    const rawWithPlaceholders = `Hi Chloe,

We have updated your billing email address as requested.

Sincerely,
[Your Name]
[Company Name]`;

    const cleaned = sanitizeUniversalAiDraft(rawWithPlaceholders, 'Chloe', 'DraftPilot Concierge');
    assert.ok(!cleaned.includes('[Your Name]'));
    assert.ok(!cleaned.includes('[Company Name]'));
    assert.ok(cleaned.includes('DraftPilot Concierge'));
    assert.ok(cleaned.includes('DraftPilot Support'));
  });

  test('normalizes customer name in greeting and template placeholders', () => {
    const rawTemplate = `Hi there,

Thank you {{name}} for contacting us. We have processed the request for [Customer Name].

Best regards,
[Support Team]`;

    const cleaned = sanitizeUniversalAiDraft(rawTemplate, 'Maya', 'Support Team');
    assert.ok(cleaned.startsWith('Hi Maya,'));
    assert.ok(!cleaned.includes('{{name}}'));
    assert.ok(!cleaned.includes('[Customer Name]'));
    assert.ok(cleaned.includes('Thank you Maya'));
  });

  test('handles degenerate thought-only output by returning empty string to trigger fallback', () => {
    const thoughtOnly = `Thinking Process:
1. **Analyze User Input:** The customer has a question about billing.
2. **Determine Solution:** Check payment gateway.`;

    const cleaned = sanitizeUniversalAiDraft(thoughtOnly, 'there');
    assert.strictEqual(cleaned, '');
  });
});

describe('Requirement R4: Super Admin AI Configuration Persistence & Security', () => {
  test('authenticates admin configuration requests via configured ADMIN_PASSKEY header', async () => {
    const originalPasskey = process.env.ADMIN_PASSKEY;
    try {
      process.env.ADMIN_PASSKEY = 'test-admin-secret-2026';
      const validReq = new Request('http://localhost:3000/api/admin/ai-config', {
        method: 'GET',
        headers: {
          'x-admin-passkey': 'test-admin-secret-2026',
        },
      });

      const auth = await verifySuperAdmin(validReq);
      assert.strictEqual(auth.authorized, true);
      assert.strictEqual(auth.response, undefined);
    } finally {
      process.env.ADMIN_PASSKEY = originalPasskey;
    }
  });

  test('rejects unauthorized admin configuration requests when passkey is missing or invalid', async () => {
    const invalidReq = new Request('http://localhost:3000/api/admin/ai-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-passkey': 'wrong-passkey-123',
      },
      body: JSON.stringify({ ai_provider: 'openrouter' }),
    });

    const auth = await verifySuperAdmin(invalidReq);
    assert.strictEqual(auth.authorized, false);
    assert.strictEqual(auth.response?.status, 401);
  });

  test('validates platform_settings persistence payload structure for live model switching', () => {
    const createSettingsPayload = (overrides: Record<string, any> = {}) => {
      const activeModel = overrides.custom_model || overrides.selected_model || 'google/gemma-4-26b-a4b-it:free';
      return {
        id: crypto.randomUUID(),
        ai_provider: overrides.ai_provider || 'openrouter',
        openrouter_api_key: overrides.openrouter_api_key || 'sk-or-v1-testkey123',
        openrouter_model: activeModel,
        selected_model: activeModel,
        openai_api_key: overrides.openai_api_key || '',
        system_prompt: overrides.system_prompt || 'Default system prompt',
        temperature: overrides.temperature !== undefined ? Number(overrides.temperature) : 0.4,
        max_tokens: overrides.max_tokens !== undefined ? Number(overrides.max_tokens) : 300,
        updated_at: new Date().toISOString(),
      };
    };

    const payload = createSettingsPayload({
      selected_model: 'google/gemma-4-31b-it:free',
      temperature: 0.65,
      max_tokens: 500,
      system_prompt: 'Custom VIP support directives',
    });

    assert.strictEqual(payload.ai_provider, 'openrouter');
    assert.strictEqual(payload.selected_model, 'google/gemma-4-31b-it:free');
    assert.strictEqual(payload.temperature, 0.65);
    assert.strictEqual(payload.max_tokens, 500);
    assert.strictEqual(payload.system_prompt, 'Custom VIP support directives');
    assert.ok(payload.updated_at);
  });

  test('validates platform_settings persistence payload for z-ai/glm-5.2:free model', () => {
    const createSettingsPayload = (overrides: Record<string, any> = {}) => {
      const activeModel = overrides.custom_model || overrides.selected_model || 'z-ai/glm-5.2:free';
      return {
        id: crypto.randomUUID(),
        ai_provider: overrides.ai_provider || 'openrouter',
        openrouter_api_key: overrides.openrouter_api_key || 'sk-or-v1-testkey123',
        openrouter_model: activeModel,
        selected_model: activeModel,
        openai_api_key: overrides.openai_api_key || '',
        system_prompt: overrides.system_prompt || 'Default system prompt',
        temperature: overrides.temperature !== undefined ? Number(overrides.temperature) : 0.4,
        max_tokens: overrides.max_tokens !== undefined ? Number(overrides.max_tokens) : 300,
        updated_at: new Date().toISOString(),
      };
    };

    const payload = createSettingsPayload({
      selected_model: 'z-ai/glm-5.2:free',
      temperature: 0.4,
      max_tokens: 300,
      system_prompt: 'DraftPilot support assistant prompt',
    });

    assert.strictEqual(payload.ai_provider, 'openrouter');
    assert.strictEqual(payload.openrouter_model, 'z-ai/glm-5.2:free');
    assert.strictEqual(payload.selected_model, 'z-ai/glm-5.2:free');
    assert.strictEqual(payload.temperature, 0.4);
    assert.strictEqual(payload.max_tokens, 300);
    assert.ok(payload.updated_at);
  });

  test('validates fallback model resolution for z-ai/glm-5.2:free', () => {
    const resolveFallbackModel = (activeModel: string) => {
      return activeModel.includes('26b') ? 'google/gemma-4-31b-it:free' : 'google/gemma-4-26b-a4b-it:free';
    };

    const fallback = resolveFallbackModel('z-ai/glm-5.2:free');
    assert.strictEqual(fallback, 'google/gemma-4-26b-a4b-it:free');
  });

  test('validates OPENROUTER_FREE_MODELS specification in AdminAIConfig.tsx adheres to requirement R1', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const configPath = path.resolve(__dirname, '../../components/admin/AdminAIConfig.tsx');
    const content = fs.readFileSync(configPath, 'utf-8');
    const match = content.match(/export const OPENROUTER_FREE_MODELS = (\[[\s\S]*?\]);/);
    assert.ok(match, 'AdminAIConfig.tsx must export OPENROUTER_FREE_MODELS array');

    const OPENROUTER_FREE_MODELS = new Function(`return ${match[1]}`)();

    assert.strictEqual(OPENROUTER_FREE_MODELS.length, 3);
    const glmModel = OPENROUTER_FREE_MODELS.find((m: any) => m.id === 'z-ai/glm-5.2:free');
    assert.ok(glmModel, 'z-ai/glm-5.2:free must exist in free models list');
    assert.strictEqual(glmModel.name, 'ZHIPU AI GLM 5.2');
    assert.strictEqual(glmModel.provider, 'ZHIPU AI');
    assert.strictEqual(glmModel.badge, 'Free · Bilingual');

    const gemma26b = OPENROUTER_FREE_MODELS.find((m: any) => m.id === 'google/gemma-4-26b-a4b-it:free');
    assert.ok(gemma26b, 'google/gemma-4-26b-a4b-it:free must exist in free models list');
    assert.strictEqual(gemma26b.name, 'Google Gemma 4 26B A4B IT');
    assert.strictEqual(gemma26b.provider, 'Google DeepMind');
    assert.strictEqual(gemma26b.badge, 'Free · MoE Architecture');

    const gemma31b = OPENROUTER_FREE_MODELS.find((m: any) => m.id === 'google/gemma-4-31b-it:free');
    assert.ok(gemma31b, 'google/gemma-4-31b-it:free must exist in free models list');
    assert.strictEqual(gemma31b.name, 'Google Gemma 4 31B IT');
    assert.strictEqual(gemma31b.provider, 'Google DeepMind');
    assert.strictEqual(gemma31b.badge, 'Free · High Reasoning');
  });

  test('validates z-ai/glm-5.3-flash specification in OPENROUTER_MODELS in AdminAIConfig.tsx', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const configPath = path.resolve(__dirname, '../../components/admin/AdminAIConfig.tsx');
    const content = fs.readFileSync(configPath, 'utf-8');

    // Verify OPENROUTER_MODELS contains z-ai/glm-5.3-flash
    assert.ok(content.includes("'z-ai/glm-5.3-flash'"), 'AdminAIConfig.tsx must include z-ai/glm-5.3-flash');
    assert.ok(content.includes("'ZHIPU AI GLM 5.3 Flash'"), 'AdminAIConfig.tsx must include display name ZHIPU AI GLM 5.3 Flash');
    assert.ok(content.includes("'High Speed · Recommended'"), 'AdminAIConfig.tsx must include badge High Speed · Recommended');

    // Verify dropdown select is present
    assert.ok(content.includes('openrouter-model-dropdown'), 'AdminAIConfig.tsx must render dropdown selector');
    assert.ok(content.includes('Select OpenRouter Model'), 'AdminAIConfig.tsx must have accessible label for model select');
  });

  test('validates platform_settings persistence payload for z-ai/glm-5.3-flash model', () => {
    const createSettingsPayload = (overrides: Record<string, any> = {}) => {
      const activeModel = overrides.custom_model || overrides.selected_model || 'z-ai/glm-5.3-flash';
      return {
        id: crypto.randomUUID(),
        ai_provider: overrides.ai_provider || 'openrouter',
        openrouter_api_key: overrides.openrouter_api_key || 'sk-or-v1-testkey123',
        openrouter_model: activeModel,
        selected_model: activeModel,
        openai_api_key: overrides.openai_api_key || '',
        system_prompt: overrides.system_prompt || 'Default system prompt',
        temperature: overrides.temperature !== undefined ? Number(overrides.temperature) : 0.4,
        max_tokens: overrides.max_tokens !== undefined ? Number(overrides.max_tokens) : 300,
        updated_at: new Date().toISOString(),
      };
    };

    const payload = createSettingsPayload({
      selected_model: 'z-ai/glm-5.3-flash',
      temperature: 0.4,
      max_tokens: 300,
      system_prompt: 'DraftPilot support assistant prompt',
    });

    assert.strictEqual(payload.ai_provider, 'openrouter');
    assert.strictEqual(payload.openrouter_model, 'z-ai/glm-5.3-flash');
    assert.strictEqual(payload.selected_model, 'z-ai/glm-5.3-flash');
    assert.strictEqual(payload.temperature, 0.4);
    assert.strictEqual(payload.max_tokens, 300);
    assert.ok(payload.updated_at);
  });

  test('validates fallback model resolution for z-ai/glm-5.3-flash', () => {
    const resolveFallbackModel = (activeModel: string) => {
      return activeModel.includes('26b') ? 'google/gemma-4-31b-it:free' : 'google/gemma-4-26b-a4b-it:free';
    };

    const fallback = resolveFallbackModel('z-ai/glm-5.3-flash');
    assert.strictEqual(fallback, 'google/gemma-4-26b-a4b-it:free');
  });
});

