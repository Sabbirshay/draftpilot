import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getActiveRootPasskey, timingSafeEqual } from '@/lib/admin-auth';
import { scrubPII } from '@/lib/pii-scrubber';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export interface DraftGenerateRequest {
  threadContent?: string;
  thread?: string;
  macroHint?: string;
  customInstruction?: string;
  instruction?: string;
  userPrompt?: string;
  promptOverride?: string;
  systemPrompt?: string;
  system_prompt?: string;
  selected_model?: string;
  model?: string;
  openrouter_model?: string;
  temperature?: number;
  max_tokens?: number;
  matchedMacro?: { id?: string; title?: string; content?: string; name?: string };
  kbSnippets?: string[];
  forceSource?: 'openrouter' | 'synthesizer';
  isTest?: boolean;
}

export interface DraftGenerateResponse {
  draft: string;
  source: 'openrouter' | 'macro' | 'template';
  modelUsed?: string;
  macroUsed?: string | null;
  customerName: string;
  cached?: boolean;
  notice?: string;
  isFallback?: boolean;
  confidence?: number;
  tokens?: number;
  error?: string;
}

function cleanAiDraft(rawText: string, customerName = 'there'): string {
  if (!rawText) return '';
  let text = rawText.trim();

  // 1. Remove XML/HTML style <think> tags (handles both closed <think>...</think> and unclosed truncated <think>...)
  text = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();

  // 2. Strip Reasoning Chains & Thinking Process Headers (DeepSeek R1 / Gemma 4 / Qwen)
  if (
    /^(?:(?:\*\*|\*|#{1,4}\s*)?(?:Here(?:'s| is) (?:a |the )?)?(?:thinking process|thought process|reasoning):?(?:\*\*)?|\d+\.\s*\*\*Analyze User Input)/i.test(
      text
    )
  ) {
    const emailMatch = text.match(
      /(?:^|\n\s*\n|\n)(?:> )?(Hi\b|Hello\b|Dear\b|Thank you\b|Thanks\b|Good morning\b|Good afternoon\b|Greetings\b)([\s\S]+)$/i
    );
    if (emailMatch) {
      text = (emailMatch[1] + emailMatch[2]).trim();
    } else {
      const splitMatch = text.split(/(?:\*\*|#{1,4}\s*)?(?:Final Response|Reply|Draft|Email|Response):?(?:\*\*)?/i);
      if (splitMatch.length > 1 && splitMatch[1].trim().length > 15) {
        text = splitMatch[1].trim();
      } else {
        return '';
      }
    }
  }

  // 3. Double-check if the resulting text is still just a thinking process fragment
  if (
    /^(?:(?:\*\*|\*|#{1,4}\s*)?(?:Here(?:'s| is) (?:a |the )?)?(?:thinking process|thought process|reasoning)|\d+\.\s*\*\*Analyze User Input)/i.test(text) ||
    text.startsWith('1.  **Analyze') ||
    text.startsWith('1. **Analyze')
  ) {
    return '';
  }

  // 4. Robust Code Fence & Wrapper Removal (handles preambles and postscripts)
  const fullWrapperMatch = text.match(/^```(?:markdown|text|email)?\s*\n([\s\S]*?)\n```$/i);
  if (fullWrapperMatch) {
    text = fullWrapperMatch[1].trim();
  } else {
    const codeBlockMatch = text.match(/```(?:markdown|text|email)?\s*\n([\s\S]*?)\n```/i);
    if (codeBlockMatch && codeBlockMatch[1].trim().length > 10) {
      const prefix = text.slice(0, codeBlockMatch.index).trim();
      const innerContent = codeBlockMatch[1].trim();
      const prefixHasGreeting = /^(?:> )?(?:Hi\b|Hello\b|Dear\b|Thank you\b|Thanks\b|Good\s+(?:morning|afternoon|evening)\b|Greetings\b)/im.test(prefix);
      const innerHasGreeting = /^(?:> )?(?:Hi\b|Hello\b|Dear\b|Thank you\b|Thanks\b|Good\s+(?:morning|afternoon|evening)\b|Greetings\b)/im.test(innerContent);
      const prefixIsPreamble = /^(?:\*\*|\*|#{1,4}\s*)?(?:Here(?:'s| is)|Draft|Suggested|Email|Response)\b/i.test(prefix);

      if (!prefixHasGreeting && (prefixIsPreamble || innerHasGreeting)) {
        text = innerContent;
      } else {
        text = text.replace(/^```(?:markdown|text|email)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
      }
    } else {
      text = text.replace(/^```(?:markdown|text|email)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
    }
  }

  // 5. Remove Meta Headers & Label Lines (handles multiple stacked headers)
  let prevText = '';
  while (prevText !== text) {
    prevText = text;
    text = text
      .replace(
        /^(?:\*\*|\*|#{1,4}\s*)?(?:Here is (?:the|a) (?:draft|reply|response|suggested reply):?|Draft reply:?|Draft:?|Response:?|(?:Subject|Re):\s*[^\n]*|Email:?|Suggested Reply:?|Thinking Process:?|Thought Process:?|Reasoning:?)(?:\*\*)?\s*\n+/i,
        ''
      )
      .trim();
  }

  // 5b. Strip trailing tip/note postscripts
  text = text.replace(/\n+---\s*\n+\*?(?:Tip|Note):?[\s\S]*$/i, '').trim();
  text = text.replace(/\n+\*(?:Tip|Note):?[\s\S]*$/i, '').trim();

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
    .replace(/\[Company\]/gi, 'DraftPilot Support')
    .replace(/\[Contact Information\]/gi, 'support@draftpilot.com')
    .replace(/\[Support Team\]/gi, defaultSignoff)
    .replace(/{{agent_name}}/gi, defaultSignoff);

  // 8. Greeting Normalization
  if (customerName && customerName.toLowerCase() !== 'there') {
    text = text.replace(
      /^(?:Hi|Hello|Dear|Hey|Good\s+(?:morning|afternoon|evening)|Greetings)\b(?:[,\t ]+(?:(?:(?:mr|mrs|ms|miss|dr|prof)\.?\s+)?[A-Z\u00C0-\u024F][A-Za-z\u00C0-\u024F]*(?:[-'· \t][A-Z\u00C0-\u024F][A-Za-z\u00C0-\u024F]*)*|\[[^\]]+\]|there|customer|user|client)(?=[\t ]*[,!:]|[\r\n]|$))?[\t ]*[,!:]?/im,
      `Hi ${customerName},`
    );
  } else {
    text = text.replace(/^(?:Hi|Hello|Dear|Hey)\s+\[Name\],/im, 'Hi there,');
    text = text.replace(/^(?:Hi|Hello|Dear|Hey)\s+\[Customer\],/im, 'Hi there,');
  }

  return text;
}

const SALUTATION_BLACKLIST = [
  'there',
  'team',
  'support',
  'all',
  'everyone',
  'sir',
  'madam',
  'sir/madam',
  'madam/sir',
  "ma'am",
  'concern',
  'customer',
  'user',
  'client',
  'can',
  'could',
  'would',
  'please',
  'whom',
  'whomever',
  'friend',
  'member',
  'anyone',
  'somebody',
  'someone',
  'help',
  'info',
  'admin',
  'administrator',
  'greetings',
  'morning',
  'afternoon',
  'evening',
  'folks',
  'colleague',
  'colleagues',
  'i',
  'we',
  'my',
  'our',
  'thank',
  'just',
];

function extractSenderName(text: string): string {
  if (!text) return 'there';
  const fromMatch = text.match(/(?:from|sender):\s*([^<\n\r]+?)(?:<|\n|$)/i);
  const lineAngleMatch = text.match(/(?:^|\n)([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9\s._-]{1,40}?)\s*<[^>\n\r]+>/i);
  const signMatch = text.match(
    /(?:thanks|regards|cheers|best|sincerely|thank you),?\s*\n+([A-Za-z\u00C0-\u024F]+(?:[-'·][A-Za-z\u00C0-\u024F]+)*)/i
  );
  const greetMatch = text.match(
    /(?:hi|hello|dear|hey|good\s+(?:morning|afternoon|evening|day)|greetings),?[^\S\r\n]+(?:(?:mr|mrs|ms|miss|dr|prof)\.?[^\S\r\n]+)?([A-Za-z\u00C0-\u024F]+(?:[-'·][A-Za-z\u00C0-\u024F]+)*(?:\s*[/]\s*[A-Za-z\u00C0-\u024F]+(?:[-'·][A-Za-z\u00C0-\u024F]+)*)?)/i
  );

  if (fromMatch && fromMatch[1].trim()) {
    const clean = fromMatch[1].replace(/["']/g, '').trim();
    if (clean && !clean.toLowerCase().includes('redacted')) {
      const candidate = clean.split(' ')[0];
      if (!SALUTATION_BLACKLIST.includes(candidate.toLowerCase())) {
        return candidate;
      }
    }
  }
  if (lineAngleMatch && lineAngleMatch[1].trim()) {
    const clean = lineAngleMatch[1].trim();
    if (!clean.toLowerCase().startsWith('subject')) {
      const candidate = clean.split(' ')[0];
      if (!SALUTATION_BLACKLIST.includes(candidate.toLowerCase())) {
        return candidate;
      }
    }
  }
  if (signMatch && signMatch[1]) {
    const clean = signMatch[1].trim();
    if (!SALUTATION_BLACKLIST.includes(clean.toLowerCase())) {
      return clean;
    }
  }
  if (greetMatch && greetMatch[1]) {
    const candidate = greetMatch[1].trim();
    const normalized = candidate.replace(/\s*[/]\s*/, '/').toLowerCase();
    if (!SALUTATION_BLACKLIST.includes(normalized)) {
      return candidate;
    }
  }
  return 'there';
}

function synthesizeSmartSupportDraft(
  promptOrThread: string,
  customerName = 'there',
  kbSnippets: string[] = [],
  macroHint = ''
): string {
  const lower = (promptOrThread || '').toLowerCase();
  const name = customerName && customerName.toLowerCase() !== 'there' ? customerName : 'there';

  // Extract Knowledge Base facts (URLs, phone numbers, clean excerpts)
  let kbFact = '';
  if (kbSnippets && kbSnippets.length > 0) {
    const urls = Array.from(new Set(kbSnippets.flatMap((s) => s.match(/https?:\/\/[^\s)]+/g) || [])));
    const phoneMatches = Array.from(
      new Set(
        kbSnippets.flatMap(
          (s) => s.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,9}/g) || []
        )
      )
    ).filter((p) => p.replace(/\D/g, '').length >= 8);

    if (urls.length > 0 && phoneMatches.length > 0) {
      kbFact = `For more details and direct access, please visit ${urls[0]} or contact our team at ${phoneMatches[0]}.`;
    } else if (urls.length > 0) {
      kbFact = `For additional details and self-service resources, you can visit ${urls[0]}.`;
    } else if (phoneMatches.length > 0) {
      kbFact = `If you need immediate assistance, please feel free to reach our team at ${phoneMatches[0]}.`;
    } else {
      const firstSnippet = kbSnippets.find((s) => s && s.trim().length > 10);
      if (firstSnippet) {
        const cleanSnippet = firstSnippet
          .replace(/^(?:###|#|\*\*).*\n*/gm, '')
          .replace(/\n+/g, ' ')
          .trim();
        if (cleanSnippet.length > 15) {
          const excerpt = cleanSnippet.length > 180 ? cleanSnippet.slice(0, 177) + '...' : cleanSnippet;
          kbFact = `As noted in our documentation: ${excerpt}`;
        }
      }
    }
  }

  // Extract custom guidance / macroHint instructions
  let hintParagraph = '';
  const trimmedHint = (macroHint || '').trim();
  if (trimmedHint) {
    const formatted = trimmedHint.endsWith('.') || trimmedHint.endsWith('!') ? trimmedHint : `${trimmedHint}.`;
    hintParagraph = `Please note: ${formatted}`;
  }

  const extras: string[] = [];
  if (kbFact) extras.push(kbFact);
  if (hintParagraph) extras.push(hintParagraph);
  const extraBlock = extras.length > 0 ? `\n\n${extras.join('\n\n')}` : '';

  // 1. Refund & Return intent
  if (lower.includes('refund') || lower.includes('return') || lower.includes('money back')) {
    return `Hi ${name},\n\nThank you for reaching out to us. I completely understand and would be glad to help you with your return and refund request.\n\nI have located your account and initiated the refund process in accordance with our return policy. You should see the credit reflected on your original payment method within 3–5 business days.${extraBlock}\n\nPlease don't hesitate to reach out if you have any questions in the meantime!\n\nBest regards,\nCustomer Support Team`;
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
    return `Hi ${name},\n\nThanks for checking in on your order status!\n\nYour shipment is on track and moving smoothly with our carrier. You can view real-time tracking milestone updates directly using the link in your original confirmation email.${extraBlock}\n\nIf you encounter any transit delays or need address adjustments, just let me know and I will be happy to assist.\n\nWarm regards,\nCustomer Support Team`;
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
    return `Hi ${name},\n\nThank you for contacting support regarding your account access.\n\nI've generated a secure password reset link for you. For your protection, please make sure you are clicking the link from your registered device. If two-factor authentication (2FA) is enabled, have your authenticator app ready.${extraBlock}\n\nLet us know if you need any additional guidance getting back into your account!\n\nBest regards,\nCustomer Support Team`;
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
    return `Hi ${name},\n\nThank you for contacting our billing department.\n\nI've reviewed your account history and confirmed your recent billing statement. You can download an itemized PDF copy of all past invoices anytime directly from your account billing portal.${extraBlock}\n\nIf you'd like to update your payment method or need a custom VAT/tax invoice, feel free to reply and I'll take care of it immediately.\n\nBest regards,\nCustomer Support Team`;
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
    return `Hi ${name},\n\nThank you for reaching out regarding the issue you are experiencing. I apologize for the inconvenience this has caused.\n\nTo help resolve this quickly, could you please try clearing your browser cache or testing in an incognito window? If the issue persists, please reply with any relevant error codes, screenshots, or the exact steps to reproduce the problem so our technical team can investigate immediately.${extraBlock}\n\nWe appreciate your patience and look forward to getting this sorted out for you!\n\nBest regards,\nCustomer Support Team`;
  }

  // 6. Partnership & Collaboration intent
  if (
    lower.includes('partner') ||
    lower.includes('collaboration') ||
    lower.includes('collaborate') ||
    lower.includes('affiliate') ||
    lower.includes('sponsor')
  ) {
    return `Hi ${name},\n\nThank you for reaching out and for your interest in partnering with us! We are always excited to explore new collaboration opportunities.\n\nCould you please share a bit more detail about your organization, your audience, and what kind of partnership structure you have in mind? I'll make sure this gets routed directly to our partnerships team.${extraBlock}\n\nLooking forward to hearing from you,\nCustomer Support Team`;
  }

  // 7. Default General Support Reply
  return `Hi ${name},\n\nThank you for getting in touch with us! I have reviewed your inquiry and would be glad to assist you.\n\nCould you please provide a few more details so I can resolve this as quickly as possible for you?${extraBlock}\n\nLooking forward to hearing back from you,\nCustomer Support Team`;
}

// In-memory sliding-window rate limiter (20 requests / 60 seconds per user)
const userRequestTimestamps = new Map<string, number[]>();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-passkey, x-requested-with, x-vercel-protection-bypass, x-agent-bypass-token',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

function jsonResponse(data: any, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
  return NextResponse.json(data, { ...init, headers });
}

export async function POST(req: NextRequest) {
  // 1. Authenticate Caller
  let user: any = null;
  const adminPasskey = req.headers.get('x-admin-passkey')?.trim();
  if (adminPasskey) {
    const configuredPasskey = await getActiveRootPasskey();
    if (configuredPasskey && timingSafeEqual(adminPasskey, configuredPasskey)) {
      user = { id: 'admin-playground', email: 'admin@draftpilot.com', role: 'superadmin' };
    }
  }

  if (!user) {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return jsonResponse({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    user = authData.user;
  }

  const userEmail = (user.email || '').trim().toLowerCase();

  // Ban Registry Check (bypassed for admin playground)
  if (userEmail && user.id !== 'admin-playground') {
    const { data: bannedEntry } = await supabaseAdmin
      .from('banned_emails')
      .select('id, reason')
      .ilike('email', userEmail)
      .maybeSingle();

    if (bannedEntry) {
      return jsonResponse(
        {
          error: 'Account deactivated. Please contact support.',
          banned: true,
          reason: bannedEntry.reason || 'Account deactivated by Super Admin',
        },
        { status: 403 }
      );
    }
  }

  // 2. Rate Limiting Check (20 requests per 60 seconds, bypassed for admin playground)
  const now = Date.now();
  if (user.id !== 'admin-playground') {
    if (userRequestTimestamps.size > 500) {
      userRequestTimestamps.forEach((times, uid) => {
        const valid = times.filter((t) => now - t < 60000);
        if (valid.length === 0) {
          userRequestTimestamps.delete(uid);
        } else {
          userRequestTimestamps.set(uid, valid);
        }
      });
    }

    const timestamps = (userRequestTimestamps.get(user.id) || []).filter((t) => now - t < 60000);
    if (timestamps.length >= 20) {
      return jsonResponse(
        { error: 'Too Many Requests: Rate limit exceeded (max 20 drafts/min). Please slow down.' },
        { status: 429 }
      );
    }
    timestamps.push(now);
    userRequestTimestamps.set(user.id, timestamps);
  }

  try {
    const body = await req.json();
    const { matchedMacro, kbSnippets, forceSource, isTest } = body;

    // 1. Thread content normalization: support both threadContent and thread
    const rawThreadContent = (
      typeof body.threadContent === 'string' && body.threadContent.trim()
        ? body.threadContent
        : (typeof body.thread === 'string' ? body.thread : '')
    ).trim();

    // 2. Dynamic system prompt extraction from body (isolated from user guidance)
    const isSystemLike = (val: string) =>
      val.includes('You are DraftPilot') || val.includes('system prompt');

    const dynamicSystemPrompt =
      (typeof body.systemPrompt === 'string' && body.systemPrompt.trim()) ||
      (typeof body.system_prompt === 'string' && body.system_prompt.trim()) ||
      (typeof body.promptOverride === 'string' && isSystemLike(body.promptOverride)
        ? body.promptOverride.trim()
        : undefined) ||
      undefined;

    // 3. Multi-alias extraction for agent guidance / macroHint:
    // macroHint || customInstruction || instruction || userPrompt || promptOverride (non-system)
    const rawInstruction =
      (typeof body.macroHint === 'string' && body.macroHint.trim()) ||
      (typeof body.customInstruction === 'string' && body.customInstruction.trim()) ||
      (typeof body.instruction === 'string' && body.instruction.trim()) ||
      (typeof body.userPrompt === 'string' && body.userPrompt.trim()) ||
      (typeof body.promptOverride === 'string' && !isSystemLike(body.promptOverride) && body.promptOverride.trim()) ||
      '';

    const macroHint = typeof rawInstruction === 'string' ? rawInstruction.trim() : '';
    const isTestMode = Boolean(isTest || user.id === 'admin-playground');

    // 2. Fetch User & Team Record
    let dbUser: any = null;
    let teamId: string | null = null;
    if (user.id !== 'admin-playground') {
      const { data } = await supabaseAdmin
        .from('users')
        .select('*, teams(*)')
        .eq('id', user.id)
        .single();
      dbUser = data;
      teamId = dbUser?.team_id;
    }

    // Monthly Quota Check (bypassed for admin playground tests)
    const month = new Date().toISOString().slice(0, 7) + '-01';
    let currentDraftsUsed = 0;
    let monthlyLimit = 50;
    let usageRecordId: string | null = null;

    if (!isTestMode && teamId) {
      const { data: teamData } = await supabaseAdmin
        .from('teams')
        .select('plan, monthly_draft_limit')
        .eq('id', teamId)
        .single();

      monthlyLimit = teamData?.monthly_draft_limit || (teamData?.plan === 'team' ? 1000 : 50);

      const { data: usageData } = await supabaseAdmin
        .from('usage')
        .select('id, draft_count')
        .eq('team_id', teamId)
        .eq('month', month)
        .single();

      if (usageData) {
        usageRecordId = usageData.id;
        currentDraftsUsed = usageData.draft_count || 0;
      }

      if (currentDraftsUsed >= monthlyLimit) {
        return jsonResponse(
          {
            error: `Monthly draft limit reached for this workspace (${currentDraftsUsed}/${monthlyLimit} used). Please upgrade your plan.`,
            quotaExceeded: true,
            limit: monthlyLimit,
            used: currentDraftsUsed,
          },
          { status: 429 }
        );
      }
    }

    // 3. Fetch Platform AI Settings securely on the server
    const { data: settings } = await supabaseAdmin
      .from('platform_settings')
      .select('*')
      .limit(1)
      .single();

    const scrubbedThreadContent = scrubPII(rawThreadContent);
    const customerName = extractSenderName(scrubbedThreadContent);
    let draftText = '';
    let openRouterSuccess = false;
    let lastOpenRouterError = '';
    let activeModel = '';
    let actualModelUsed = '';

    const baseSystemPrompt =
      dynamicSystemPrompt ||
      settings?.system_prompt?.trim() ||
      'You are DraftPilot, an intelligent customer support assistant. You write concise, friendly, and professional email replies directly to customers based on company knowledge.';

    const strictSystemPrompt = `${baseSystemPrompt}

CRITICAL INSTRUCTIONS:
1. Output ONLY the raw final email reply text ready to send.
2. Absolutely DO NOT output any thinking process, analysis, reasoning steps, or markdown bullets.
3. Start directly with "Hi ${customerName}," and end with "Best regards,\\nCustomer Support Team".
4. Do NOT wrap in markdown code blocks.
5. If "Agent Guidance / Custom Instruction" is provided, it represents direct human supervisor guidance that takes highest priority and MUST be reflected in the reply, overriding default policies or standard templates when in conflict.`;

    // Hoisted KB retrieval: available for both OpenRouter LLM and fallback synthesizer
    let effectiveKbSnippets = kbSnippets && Array.isArray(kbSnippets) && kbSnippets.length > 0 ? kbSnippets : [];
    if (effectiveKbSnippets.length === 0 && teamId && scrubbedThreadContent) {
      try {
        const queryKeywords = scrubbedThreadContent
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w: string) => w.length > 2);

        const { data: serverChunks } = await supabaseAdmin
          .from('document_chunks')
          .select('chunk_text')
          .eq('team_id', teamId)
          .limit(50);

        const { data: serverMacros } = await supabaseAdmin
          .from('macros')
          .select('name, content, tags')
          .eq('team_id', teamId)
          .limit(30);

        const searchItems: { text: string; score: number }[] = [];
        for (const chunk of serverChunks || []) {
          if (!chunk.chunk_text || chunk.chunk_text.trim().length < 10) continue;
          const lower = chunk.chunk_text.toLowerCase();
          let score = 0;
          for (const kw of queryKeywords) {
            if (lower.includes(kw)) score += kw.length >= 5 ? 3 : 2;
          }
          if (score > 0) searchItems.push({ text: chunk.chunk_text, score });
        }
        for (const macro of serverMacros || []) {
          if (!macro.content || macro.content.trim().length < 10) continue;
          const searchText = [macro.name || '', macro.content, ...(macro.tags || [])].join(' ');
          const lower = searchText.toLowerCase();
          let score = 0;
          for (const kw of queryKeywords) {
            if (lower.includes(kw)) score += kw.length >= 5 ? 3 : 2;
          }
          if (score > 0) searchItems.push({ text: searchText, score });
        }
        effectiveKbSnippets = searchItems
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map((s) => s.text);
      } catch (kbErr) {
        console.warn('Server-side KB retrieval note:', kbErr);
      }
    }

    const openrouterApiKey =
      settings?.openrouter_api_key?.trim() ||
      process.env.OPENROUTER_API_KEY?.trim() ||
      process.env.NEXT_PUBLIC_OPENROUTER_API_KEY?.trim() ||
      '';

    if (openrouterApiKey) {
      try {
        const dynamicModel =
          (typeof body.selected_model === 'string' && body.selected_model.trim()) ||
          (typeof body.model === 'string' && body.model.trim()) ||
          (typeof body.openrouter_model === 'string' && body.openrouter_model.trim()) ||
          undefined;

        activeModel = dynamicModel || settings?.selected_model || settings?.openrouter_model || 'z-ai/glm-5.3-flash';
        actualModelUsed = activeModel;
        const fallbackModel = activeModel.includes('26b')
          ? 'google/gemma-4-31b-it:free'
          : (activeModel === 'z-ai/glm-5.3-flash' ? 'z-ai/glm-5.2:free' : 'google/gemma-4-26b-a4b-it:free');

        let knowledgeContext = '';
        if (matchedMacro?.content) {
          knowledgeContext += `### Recommended Support Macro & Policy:\n${matchedMacro.content}\n\n`;
        }

        if (effectiveKbSnippets.length > 0) {
          knowledgeContext += `### Knowledge Base & Documentation Context:\n${effectiveKbSnippets.join('\n---\n')}\n\n`;
        }

        let agentGuidanceContext = '';
        const trimmedHint = (macroHint || '').trim();
        if (trimmedHint) {
          agentGuidanceContext = `### Agent Guidance / Custom Instruction:\n${trimmedHint}\n\n`;
        }

        const userPrompt = `Customer Message:\n${scrubbedThreadContent}\n\n${knowledgeContext}${agentGuidanceContext}Write the clean, direct customer email reply now:`;

        const isReasoningMandatory = (model: string) =>
          model.includes('o1') || model.includes('o3') || model.includes('glm-5.3');

        // Candidate models to try in sequence
        const candidateModels: string[] = [];
        if (activeModel) candidateModels.push(activeModel);
        if (fallbackModel && !candidateModels.includes(fallbackModel)) candidateModels.push(fallbackModel);
        if (!candidateModels.includes('z-ai/glm-5.3-flash')) candidateModels.push('z-ai/glm-5.3-flash');
        if (!candidateModels.includes('z-ai/glm-5.2:free')) candidateModels.push('z-ai/glm-5.2:free');
        if (!candidateModels.includes('meta-llama/llama-3.1-8b-instruct:free')) candidateModels.push('meta-llama/llama-3.1-8b-instruct:free');
        if (!candidateModels.includes('meta-llama/llama-3.3-70b-instruct:free')) candidateModels.push('meta-llama/llama-3.3-70b-instruct:free');
        if (!candidateModels.includes('mistralai/mistral-small-3.1-24b-instruct:free')) candidateModels.push('mistralai/mistral-small-3.1-24b-instruct:free');

        actualModelUsed = activeModel;
        for (const modelToTry of candidateModels) {
          try {
            const max_tokens = (() => {
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
              return modelToTry.includes('glm-5.3') ? Math.max(800, configured) : configured;
            })();

            const temperature = (() => {
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
            })();

            const requestBody: any = {
              model: modelToTry,
              messages: [
                { role: 'system', content: strictSystemPrompt },
                { role: 'user', content: userPrompt },
              ],
              max_tokens,
              temperature,
            };
            if (!isReasoningMandatory(modelToTry)) {
              requestBody.include_reasoning = false;
              requestBody.reasoning = { max_tokens: 0 };
            }

            const timeoutMs = isReasoningMandatory(modelToTry) ? 20000 : 10000;
            const openrouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${openrouterApiKey}`,
                'HTTP-Referer': 'https://draftpilot-web.vercel.app',
                'X-Title': 'DraftPilot',
              },
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(timeoutMs),
            });

            const openRouterData = await openrouterRes.json().catch(() => null);

            if (openrouterRes.ok && openRouterData?.choices && openRouterData.choices.length > 0) {
              const rawContent = openRouterData.choices[0].message?.content || '';
              const cleaned = cleanAiDraft(rawContent, customerName);
              if (cleaned && cleaned.length > 15) {
                draftText = cleaned;
                openRouterSuccess = true;
                actualModelUsed = modelToTry;
                break;
              }
            } else {
              const errSnippet = typeof openRouterData?.error === 'string'
                ? openRouterData.error
                : (openRouterData?.error?.message || openrouterRes.statusText);
              lastOpenRouterError = `${modelToTry}: ${openrouterRes.status} ${errSnippet}`;
              console.warn(
                `Model ${modelToTry} attempt failed (${openrouterRes.status}):`,
                openRouterData?.error || openrouterRes.statusText
              );

              // If API key is invalid or credits exhausted, all models will fail; terminate cascade early
              if (openrouterRes.status === 401 || openrouterRes.status === 402) {
                break;
              }
            }
          } catch (modelErr: any) {
            lastOpenRouterError = `${modelToTry}: ${modelErr?.message || 'Network error'}`;
            console.warn(`Model ${modelToTry} error:`, modelErr);
          }
        }
      } catch (aiErr) {
        console.warn('Server OpenRouter generation note:', aiErr);
      }
    }

    // 4. Grounded Fallback / Local Synthesizer
    if (!openRouterSuccess) {
      if (matchedMacro?.content) {
        draftText = matchedMacro.content
          .replace(/{{name}}/g, customerName)
          .replace(/{{customer_name}}/g, customerName)
          .replace(/\[Customer\]/g, customerName)
          .replace(/\[Name\]/g, customerName);

        if (customerName && customerName.toLowerCase() !== 'there') {
          draftText = draftText.replace(/^(?:Hi|Hello|Dear)\s+there,/im, `Hi ${customerName},`);
          draftText = draftText.replace(/^(?:Hi|Hello|Dear),/im, `Hi ${customerName},`);
        }
      } else {
        draftText = synthesizeSmartSupportDraft(scrubbedThreadContent, customerName, effectiveKbSnippets, macroHint || '');
      }
    }

    // Harvest whitelisted company contacts from retrieved KB context and macros
    const kbContactsWhitelist: string[] = ['support@draftpilot.com'];
    const harvestContacts = (content: string) => {
      if (!content) return;
      const emails = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      for (const email of emails) kbContactsWhitelist.push(email);
      const phones = content.match(/(?:\b|\+)(?:\d{1,4}[-.\s]?)?(?:\(?\d{2,5}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b/g) || [];
      for (const phone of phones) {
        if (phone.replace(/\D/g, '').length >= 7) kbContactsWhitelist.push(phone.trim());
      }
    };
    for (const snippet of effectiveKbSnippets) harvestContacts(snippet);
    if (matchedMacro?.content) harvestContacts(matchedMacro.content);

    const scrubbedDraftText = scrubPII(draftText, undefined, kbContactsWhitelist);

    // 5. Insert Draft History & Increment Usage (bypassed for test mode)
    if (!isTestMode && teamId) {
      try {
        await supabaseAdmin.from('draft_history').insert({
          team_id: teamId,
          user_id: user.id,
          thread_snippet: (scrubbedThreadContent || '').slice(0, 200),
          generated_draft: scrubbedDraftText,
          macro_used_id: matchedMacro?.id || null,
        });

        // Increment monthly usage count in the usage table
        if (usageRecordId) {
          await supabaseAdmin
            .from('usage')
            .update({ draft_count: currentDraftsUsed + 1 })
            .eq('id', usageRecordId);
        } else {
          await supabaseAdmin.from('usage').insert({
            team_id: teamId,
            month,
            draft_count: 1,
          });
        }

        // 5b. Auto-unlock AI Draft onboarding milestone
        try {
          const { data: existingOb } = await supabaseAdmin
            .from('onboarding_state')
            .select('id, first_draft_generated')
            .eq('team_id', teamId)
            .maybeSingle();

          if (existingOb) {
            if (!existingOb.first_draft_generated) {
              await supabaseAdmin
                .from('onboarding_state')
                .update({ first_draft_generated: true })
                .eq('id', existingOb.id);
            }
          } else {
            await supabaseAdmin
              .from('onboarding_state')
              .insert({ team_id: teamId, first_draft_generated: true });
          }
        } catch (obErr) {
          console.warn('Onboarding milestone update note:', obErr);
        }
      } catch (histErr) {
        console.warn('Draft history / usage logging note:', histErr);
      }
    }

    const draftSource = openRouterSuccess
      ? 'openrouter'
      : (matchedMacro?.content ? 'macro' : 'template');

    let notice: string | undefined;
    if (!openRouterSuccess) {
      if (!openrouterApiKey) {
        notice = 'No OpenRouter API key configured in Platform Settings or environment. Generated using fallback template.';
      } else {
        notice = `AI generation unavailable (${lastOpenRouterError || 'candidate models exhausted'}). Generated using fallback template.`;
      }
    }

    return jsonResponse({
      draft: scrubbedDraftText,
      macroUsed: matchedMacro?.name || null,
      confidence: matchedMacro ? 96 : (openRouterSuccess ? 92 : 88),
      source: draftSource,
      customerName: customerName || 'there',
      modelUsed: openRouterSuccess ? actualModelUsed : undefined,
      isFallback: openRouterSuccess ? actualModelUsed !== activeModel : (!openRouterSuccess && !matchedMacro?.content),
      draftRecorded: !isTestMode && Boolean(teamId),
      ...(notice ? { notice } : {}),
    });
  } catch (err: any) {
    return jsonResponse({ error: err.message }, { status: 500 });
  }
}
