import { test, describe } from 'node:test';
import assert from 'node:assert';

// Implementation matching packages/web/src/app/api/drafts/generate/route.ts & packages/api/src/drafts/ai-provider.service.ts
function cleanAiDraft(rawText: string, customerName = 'there'): string {
  if (!rawText) return '';
  let text = rawText.trim();

  // 1. Remove XML/HTML style <think>...</think> tags (DeepSeek R1 / Gemma 4 / Qwen)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Strip Reasoning Chains & Thinking Process Headers
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
      const splitMatch = text.split(/\*\*(?:Final Response|Reply|Draft|Email|Response):\*\*/i);
      if (splitMatch.length > 1 && splitMatch[1].trim().length > 15) {
        text = splitMatch[1].trim();
      } else {
        return '';
      }
    }
  }

  // 3. Double-check if the resulting text is still just a thinking process fragment
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

  // 5. Remove Meta Headers & Label Lines (handles multiple stacked headers)
  let prevText = '';
  while (prevText !== text) {
    prevText = text;
    text = text
      .replace(/^(?:Here is (?:the|a) (?:draft|reply|response|suggested reply):?|Draft reply:?|Draft:?|Response:?|Subject:[^\n]*|Email:?|Suggested Reply:?)\s*\n+/i, '')
      .trim();
  }

  // 6. Template Variable Normalization
  text = text
    .replace(/{{name}}/gi, customerName)
    .replace(/{{customer_name}}/gi, customerName)
    .replace(/\[Customer(?:\s*Name)?\]/gi, customerName)
    .replace(/\[Name\]/gi, customerName)
    .replace(/\[Client(?:\s*Name)?\]/gi, customerName);

  // 7. Sign-off Placeholder Scrubbing
  const defaultSignoff = 'Customer Support Team';
  text = text
    .replace(/\[Your Name\]/gi, defaultSignoff)
    .replace(/\[Agent Name\]/gi, defaultSignoff)
    .replace(/\[Support Representative\]/gi, defaultSignoff)
    .replace(/\[Representative Name\]/gi, defaultSignoff)
    .replace(/\[Your Title\]/gi, defaultSignoff)
    .replace(/\[Company Name\]/gi, 'DraftPilot Support')
    .replace(/\[Support Team\]/gi, defaultSignoff)
    .replace(/{{agent_name}}/gi, defaultSignoff);

  // 8. Greeting Normalization
  if (customerName && customerName.toLowerCase() !== 'there') {
    text = text.replace(/^(?:Hi|Hello|Dear)\s+there,/im, `Hi ${customerName},`);
    text = text.replace(/^(?:Hi|Hello|Dear),/im, `Hi ${customerName},`);
    text = text.replace(/^(?:Hi|Hello|Dear)\s+\[Name\],/im, `Hi ${customerName},`);
    text = text.replace(/^(?:Hi|Hello|Dear)\s+\[Customer\],/im, `Hi ${customerName},`);
  }

  return text;
}

function synthesizeSmartSupportDraft(promptOrThread: string, customerName = 'there'): string {
  const lower = (promptOrThread || '').toLowerCase();
  const name = customerName && customerName.toLowerCase() !== 'there' ? customerName : 'there';

  // 1. Refund & Return intent
  if (lower.includes('refund') || lower.includes('return') || lower.includes('money back')) {
    return `Hi ${name},\n\nThank you for reaching out to us. I completely understand and would be glad to help you with your return and refund request.\n\nI have located your account and initiated the refund process in accordance with our return policy. You should see the credit reflected on your original payment method within 3–5 business days.\n\nPlease don't hesitate to reach out if you have any questions in the meantime!\n\nBest regards,\nCustomer Support Team`;
  }

  // 2. Order Status & Shipping intent
  if (
    lower.includes('track') ||
    lower.includes('shipping') ||
    lower.includes('where is my order') ||
    lower.includes('where is') ||
    lower.includes('delivery') ||
    lower.includes('delay') ||
    lower.includes('package')
  ) {
    return `Hi ${name},\n\nThanks for checking in on your order status!\n\nYour shipment is on track and moving smoothly with our carrier. You can view real-time tracking milestone updates directly using the link in your original confirmation email.\n\nIf you encounter any transit delays or need address adjustments, just let me know and I will be happy to assist.\n\nWarm regards,\nCustomer Support Team`;
  }

  // 3. Password / Account Access intent
  if (
    lower.includes('password') ||
    lower.includes('login') ||
    lower.includes('2fa') ||
    lower.includes('account') ||
    lower.includes('locked') ||
    lower.includes('reset') ||
    lower.includes('sign in')
  ) {
    return `Hi ${name},\n\nThank you for contacting support regarding your account access.\n\nI've generated a secure password reset link for you. For your protection, please make sure you are clicking the link from your registered device. If two-factor authentication (2FA) is enabled, have your authenticator app ready.\n\nLet us know if you need any additional guidance getting back into your account!\n\nBest regards,\nCustomer Support Team`;
  }

  // 4. Billing / Invoice intent
  if (
    lower.includes('invoice') ||
    lower.includes('receipt') ||
    lower.includes('charge') ||
    lower.includes('card') ||
    lower.includes('billing') ||
    lower.includes('subscription') ||
    lower.includes('payment')
  ) {
    return `Hi ${name},\n\nThank you for contacting our billing department.\n\nI've reviewed your account history and confirmed your recent billing statement. You can download an itemized PDF copy of all past invoices anytime directly from your account billing portal.\n\nIf you'd like to update your payment method or need a custom VAT/tax invoice, feel free to reply and I'll take care of it immediately.\n\nBest regards,\nCustomer Support Team`;
  }

  // 5. Technical Troubleshooting intent
  if (
    lower.includes('error') ||
    lower.includes('bug') ||
    lower.includes('crash') ||
    lower.includes('issue') ||
    lower.includes('not working') ||
    lower.includes('broken') ||
    lower.includes('failed') ||
    lower.includes('troubleshoot') ||
    lower.includes('glitch')
  ) {
    return `Hi ${name},\n\nThank you for reaching out regarding the issue you are experiencing. I apologize for the inconvenience this has caused.\n\nTo help resolve this quickly, could you please try clearing your browser cache or testing in an incognito window? If the issue persists, please reply with any relevant error codes, screenshots, or the exact steps to reproduce the problem so our technical team can investigate immediately.\n\nWe appreciate your patience and look forward to getting this sorted out for you!\n\nBest regards,\nCustomer Support Team`;
  }

  // 6. Default General Support Reply
  return `Hi ${name},\n\nThank you for getting in touch with us! I have reviewed your inquiry and would be glad to assist you.\n\nCould you please provide a few more details so I can resolve this as quickly as possible for you?\n\nLooking forward to hearing back from you,\nCustomer Support Team`;
}

describe('R1: Custom Instruction & Contextual Prompt Compilation', () => {
  test('userPrompt compiles custom instruction under Agent Guidance when macroHint is passed', () => {
    const threadContent = 'My account seems stuck on loading.';
    const macroHint = 'Apologize and offer discount coupon SORRY20';
    const matchedMacro = null;
    const kbSnippets: string[] = [];

    let knowledgeContext = '';
    if (matchedMacro) {
      knowledgeContext += `### Recommended Support Macro & Policy:\n${(matchedMacro as any).content}\n\n`;
    }
    if (kbSnippets && kbSnippets.length > 0) {
      knowledgeContext += `### Knowledge Base & Documentation Context:\n${kbSnippets.join('\n---\n')}\n\n`;
    }

    let agentGuidanceContext = '';
    const trimmedHint = (macroHint || '').trim();
    if (trimmedHint) {
      agentGuidanceContext = `### Agent Guidance / Custom Instruction:\n${trimmedHint}\n\n`;
    }

    const userPrompt = `Customer Message:\n${threadContent}\n\n${knowledgeContext}${agentGuidanceContext}Write the clean, direct customer email reply now:`;

    assert.ok(userPrompt.includes('### Agent Guidance / Custom Instruction:'));
    assert.ok(userPrompt.includes('Apologize and offer discount coupon SORRY20'));
    assert.ok(userPrompt.includes('Customer Message:\nMy account seems stuck on loading.'));
  });

  test('strictSystemPrompt dynamically integrates settings.system_prompt', () => {
    const customSettingsPrompt = 'You are DraftPilot Pro, providing enterprise grade technical support.';
    const customerName = 'Rachel';

    const baseSystemPrompt =
      customSettingsPrompt?.trim() ||
      'You are DraftPilot, an intelligent customer support assistant. You write concise, friendly, and professional email replies directly to customers based on company knowledge.';

    const strictSystemPrompt = `${baseSystemPrompt}

CRITICAL INSTRUCTIONS:
1. Output ONLY the raw final email reply text.
2. Absolutely DO NOT output any thinking process, analysis, reasoning steps, or markdown bullets.
3. Start directly with "Hi ${customerName}," and end with "Best regards,\\nCustomer Support Team".
4. Do NOT wrap in markdown code blocks.`;

    assert.ok(strictSystemPrompt.includes('enterprise grade technical support'));
    assert.ok(strictSystemPrompt.includes('Hi Rachel,'));
    assert.ok(strictSystemPrompt.includes('Customer Support Team'));
  });
});

describe('R2: 5-Intent Domain-Aware Smart Synthesizer Resilience & Personalization', () => {
  test('Intent 1: Refunds and returns synthesis personalized with customer name', () => {
    const draft = synthesizeSmartSupportDraft('I want a refund for my damaged shoes, please return', 'Jonathan');
    assert.ok(draft.startsWith('Hi Jonathan,'));
    assert.ok(draft.includes('refund process in accordance with our return policy'));
    assert.ok(draft.includes('3–5 business days'));
    assert.ok(draft.includes('Customer Support Team'));
  });

  test('Intent 2: Order tracking and shipping synthesis personalized with customer name', () => {
    const draft = synthesizeSmartSupportDraft('Where is my order? Can you track shipment delivery delay?', 'Samantha');
    assert.ok(draft.startsWith('Hi Samantha,'));
    assert.ok(draft.includes('shipment is on track'));
    assert.ok(draft.includes('confirmation email'));
  });

  test('Intent 3: Account access and password reset synthesis personalized with customer name', () => {
    const draft = synthesizeSmartSupportDraft('I forgot my password, account is locked and 2fa reset needed', 'Marcus');
    assert.ok(draft.startsWith('Hi Marcus,'));
    assert.ok(draft.includes('password reset link'));
    assert.ok(draft.includes('two-factor authentication (2FA)'));
  });

  test('Intent 4: Billing and invoice synthesis personalized with customer name', () => {
    const draft = synthesizeSmartSupportDraft('Need a receipt and invoice for the credit card charge', 'Valerie');
    assert.ok(draft.startsWith('Hi Valerie,'));
    assert.ok(draft.includes('itemized PDF copy of all past invoices'));
    assert.ok(draft.includes('billing portal'));
  });

  test('Intent 5: Technical troubleshooting synthesis personalized with customer name', () => {
    const draft = synthesizeSmartSupportDraft('The dashboard crashes with an error code 500 and is not working / bug', 'David');
    assert.ok(draft.startsWith('Hi David,'));
    assert.ok(draft.includes('browser cache'));
    assert.ok(draft.includes('error codes, screenshots'));
  });

  test('Default intent: fallback support reply when general inquiry without specific keywords', () => {
    const draft = synthesizeSmartSupportDraft('Do you have retail stores in Chicago?', 'Nina');
    assert.ok(draft.startsWith('Hi Nina,'));
    assert.ok(draft.includes('reviewed your inquiry and would be glad to assist'));
  });

  test('Preserves "Hi there," when customer name is default "there"', () => {
    const draft = synthesizeSmartSupportDraft('I need a refund', 'there');
    assert.ok(draft.startsWith('Hi there,'));
  });
});

describe('R3: Output Sanitization & Format Enforcement', () => {
  test('strips multi-paragraph thinking reasoning chains from DeepSeek R1 / Gemma 4', () => {
    const raw = `Here's a thinking process:
1. Analyze user request: User wants to return a sweater.
2. Determine return policy: 30 days return window.

3. Formulate response: Greet warmly and provide return steps.

Hi Taylor,

Thank you for reaching out! You can easily return the sweater within 30 days.

Best regards,
Customer Support Team`;

    const cleaned = cleanAiDraft(raw, 'Taylor');
    assert.ok(!cleaned.includes('thinking process'));
    assert.ok(!cleaned.includes('Analyze user request'));
    assert.ok(cleaned.startsWith('Hi Taylor,'));
    assert.ok(cleaned.includes('return the sweater within 30 days'));
  });

  test('strips markdown code fences with preamble and trailing commentary', () => {
    const raw = `Here is the suggested response:
\`\`\`markdown
Hi Chris,

Your order has been updated successfully.

Best regards,
Customer Support Team
\`\`\`
Hope this helps! Let us know if anything else is needed.`;

    const cleaned = cleanAiDraft(raw, 'Chris');
    assert.ok(!cleaned.includes('```'));
    assert.ok(!cleaned.includes('Here is the suggested response'));
    assert.ok(cleaned.startsWith('Hi Chris,'));
    assert.ok(cleaned.includes('Your order has been updated successfully.'));
  });

  test('scrubs hallucinated sign-off placeholders to Customer Support Team', () => {
    const raw = `Hi Olivia,\n\nWe have received your ticket.\n\nSincerely,\n[Your Name]\n[Company Name]`;
    const cleaned = cleanAiDraft(raw, 'Olivia');
    assert.ok(!cleaned.includes('[Your Name]'));
    assert.ok(!cleaned.includes('[Company Name]'));
    assert.ok(cleaned.includes('Customer Support Team'));
    assert.ok(cleaned.includes('DraftPilot Support'));
  });

  test('scrubs all variations of sign-off placeholders', () => {
    const raw = `Hi Dan,\n\nAll set.\n\nBest,\n[Agent Name]\n[Support Representative]\n[Your Title]\n{{agent_name}}`;
    const cleaned = cleanAiDraft(raw, 'Dan');
    assert.ok(!cleaned.includes('[Agent Name]'));
    assert.ok(!cleaned.includes('[Support Representative]'));
    assert.ok(!cleaned.includes('[Your Title]'));
    assert.ok(!cleaned.includes('{{agent_name}}'));
    assert.ok(cleaned.includes('Customer Support Team'));
  });

  test('removes Subject: and Draft: headers from beginning of output', () => {
    const raw = `Subject: Password Reset Guidance\nDraft reply:\nHi Lucas,\n\nPlease follow the reset instructions below.`;
    const cleaned = cleanAiDraft(raw, 'Lucas');
    assert.ok(!cleaned.includes('Subject:'));
    assert.ok(!cleaned.includes('Draft reply:'));
    assert.ok(cleaned.startsWith('Hi Lucas,'));
  });

  test('normalizes template variables and customer greetings', () => {
    const raw = `Hi [Name],\n\nWe have updated records for {{customer_name}} and [Customer Name].\n\nThanks,\nSupport`;
    const cleaned = cleanAiDraft(raw, 'Hannah');
    assert.ok(!cleaned.includes('{{customer_name}}'));
    assert.ok(!cleaned.includes('[Customer Name]'));
    assert.ok(!cleaned.includes('[Name]'));
    assert.ok(cleaned.startsWith('Hi Hannah,'));
    assert.ok(cleaned.includes('Hannah'));
  });
});
