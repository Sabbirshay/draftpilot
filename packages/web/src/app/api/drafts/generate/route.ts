import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin-auth';
import { scrubPII } from '@/lib/pii-scrubber';

export const dynamic = 'force-dynamic';

function cleanAiDraft(rawText: string, customerName = 'there'): string {
  if (!rawText) return '';
  let text = rawText.trim();

  // 1. Remove XML/HTML style <think>...</think> tags (e.g. DeepSeek / Nemotron / Qwen reasoning)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Strip Reasoning Chains & Thinking Process Headers (DeepSeek R1 / Gemma 4 / Qwen)
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

function extractSenderName(text: string): string {
  if (!text) return 'there';
  const fromMatch = text.match(/(?:from|sender):\s*([^<\n\r]+?)(?:<|\n|$)/i);
  const lineAngleMatch = text.match(/(?:^|\n)([A-Za-z][A-Za-z0-9\s._-]{1,40}?)\s*<[^>\n\r]+>/);
  const signMatch = text.match(/(?:thanks|regards|cheers|best|sincerely|thank you),?\s*\n+([A-Z][a-z]+)/i);
  const greetMatch = text.match(/(?:hi|dear|hello)\s+([A-Z][a-z]+)/i);

  if (fromMatch && fromMatch[1].trim()) {
    const clean = fromMatch[1].replace(/["']/g, '').trim();
    if (clean && !clean.toLowerCase().includes('redacted')) {
      return clean.split(' ')[0];
    }
  }
  if (lineAngleMatch && lineAngleMatch[1].trim()) {
    const clean = lineAngleMatch[1].trim();
    if (clean && !clean.toLowerCase().startsWith('subject')) {
      return clean.split(' ')[0];
    }
  }
  if (signMatch && signMatch[1]) {
    return signMatch[1].trim();
  }
  if (greetMatch && greetMatch[1]) {
    const candidate = greetMatch[1].trim();
    const blacklist = ['there', 'team', 'support', 'all', 'everyone', 'sir', 'madam', 'can', 'could', 'would', 'please'];
    if (!blacklist.includes(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return 'there';
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

// In-memory sliding-window rate limiter (20 requests / 60 seconds per user)
const userRequestTimestamps = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  // 1. Authenticate Caller
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
  }

  const user = authData.user;
  const userEmail = (user.email || '').trim().toLowerCase();

  // Ban Registry Check
  if (userEmail) {
    const { data: bannedEntry } = await supabaseAdmin
      .from('banned_emails')
      .select('id, reason')
      .ilike('email', userEmail)
      .maybeSingle();

    if (bannedEntry) {
      return NextResponse.json(
        {
          error: 'Account deactivated. Please contact support.',
          banned: true,
          reason: bannedEntry.reason || 'Account deactivated by Super Admin',
        },
        { status: 403 }
      );
    }
  }

  // 2. Rate Limiting Check (20 requests per 60 seconds)
  const now = Date.now();
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
    return NextResponse.json(
      { error: 'Too Many Requests: Rate limit exceeded (max 20 drafts/min). Please slow down.' },
      { status: 429 }
    );
  }
  timestamps.push(now);
  userRequestTimestamps.set(user.id, timestamps);

  try {
    const body = await req.json();
    const { threadContent, macroHint, matchedMacro, kbSnippets } = body;

    // 2. Fetch User & Team Record
    const { data: dbUser } = await supabaseAdmin
      .from('users')
      .select('*, teams(*)')
      .eq('id', user.id)
      .single();

    const teamId = dbUser?.team_id;

    // Monthly Quota Check
    const month = new Date().toISOString().slice(0, 7) + '-01';
    let currentDraftsUsed = 0;
    let monthlyLimit = 50;
    let usageRecordId: string | null = null;

    if (teamId) {
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
        return NextResponse.json(
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

    const rawThreadContent = (threadContent || '').trim();
    const scrubbedThreadContent = scrubPII(rawThreadContent);
    const customerName = extractSenderName(scrubbedThreadContent);
    let draftText = '';
    let openRouterSuccess = false;

    const baseSystemPrompt =
      settings?.system_prompt?.trim() ||
      'You are DraftPilot, an intelligent customer support assistant. You write concise, friendly, and professional email replies directly to customers based on company knowledge.';

    const strictSystemPrompt = `${baseSystemPrompt}

CRITICAL INSTRUCTIONS:
1. Output ONLY the raw final email reply text.
2. Absolutely DO NOT output any thinking process, analysis, reasoning steps, or markdown bullets.
3. Start directly with "Hi ${customerName}," and end with "Best regards,\\nCustomer Support Team".
4. Do NOT wrap in markdown code blocks.`;

    if (settings && settings.openrouter_api_key) {
      try {
        const activeModel = settings.selected_model || settings.openrouter_model || 'google/gemma-4-26b-a4b-it:free';
        const fallbackModel = activeModel.includes('26b') ? 'google/gemma-4-31b-it:free' : 'google/gemma-4-26b-a4b-it:free';

        let knowledgeContext = '';
        if (matchedMacro?.content) {
          knowledgeContext += `### Recommended Support Macro & Policy:\n${matchedMacro.content}\n\n`;
        }
        if (kbSnippets && kbSnippets.length > 0) {
          knowledgeContext += `### Knowledge Base & Documentation Context:\n${kbSnippets.join('\n---\n')}\n\n`;
        }

        let agentGuidanceContext = '';
        const trimmedHint = (macroHint || '').trim();
        if (trimmedHint) {
          agentGuidanceContext = `### Agent Guidance / Custom Instruction:\n${trimmedHint}\n\n`;
        }

        const userPrompt = `Customer Message:\n${scrubbedThreadContent}\n\n${knowledgeContext}${agentGuidanceContext}Write the clean, direct customer email reply now:`;

        // 1. Try Primary Model (with 8s timeout)
        let openrouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.openrouter_api_key}`,
            'HTTP-Referer': 'https://draftpilot-web.vercel.app',
            'X-Title': 'DraftPilot',
          },
          body: JSON.stringify({
            model: activeModel,
            messages: [
              { role: 'system', content: strictSystemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: Math.max(1000, Number(settings.max_tokens) || 1000),
            temperature: parseFloat(settings.temperature as string) || 0.4,
            include_reasoning: false,
            reasoning: { max_tokens: 0 },
          }),
          signal: AbortSignal.timeout(8000),
        });

        let openRouterData = await openrouterRes.json().catch(() => null);

        // 2. If Primary fails, attempt Automatic Fallback Model (with 8s timeout)
        if ((!openrouterRes.ok || !openRouterData?.choices?.[0]) && fallbackModel !== activeModel) {
          console.warn(`Primary model ${activeModel} failed (${openrouterRes.status}). Attempting auto-fallback to ${fallbackModel}...`);
          const fallbackRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${settings.openrouter_api_key}`,
              'HTTP-Referer': 'https://draftpilot-web.vercel.app',
              'X-Title': 'DraftPilot',
            },
            body: JSON.stringify({
              model: fallbackModel,
              messages: [
                { role: 'system', content: strictSystemPrompt },
                { role: 'user', content: userPrompt },
              ],
              max_tokens: Math.max(1000, Number(settings.max_tokens) || 1000),
              temperature: parseFloat(settings.temperature as string) || 0.4,
              include_reasoning: false,
              reasoning: { max_tokens: 0 },
            }),
            signal: AbortSignal.timeout(8000),
          });

          const fallbackData = await fallbackRes.json().catch(() => null);
          if (fallbackRes.ok && fallbackData?.choices?.[0]) {
            openrouterRes = fallbackRes;
            openRouterData = fallbackData;
          }
        }

        if (openRouterData?.choices && openRouterData.choices.length > 0) {
          const rawContent = openRouterData.choices[0].message?.content || '';
          const cleaned = cleanAiDraft(rawContent, customerName);
          if (cleaned && cleaned.length > 15) {
            draftText = cleaned;
            openRouterSuccess = true;
          }
        }
      } catch (aiErr) {
        console.warn('Server OpenRouter generation note:', aiErr);
      }
    }

    // 4. Grounded Fallback / Local 5-Intent Synthesizer
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
        draftText = synthesizeSmartSupportDraft(scrubbedThreadContent, customerName);
      }
    }

    const scrubbedDraftText = scrubPII(draftText);

    // 5. Insert Draft History & Increment Usage
    if (teamId) {
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
      } catch (histErr) {
        console.warn('Draft history / usage logging note:', histErr);
      }
    }

    return NextResponse.json({
      draft: scrubbedDraftText,
      macroUsed: matchedMacro?.name || null,
      confidence: matchedMacro ? 96 : 88,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
