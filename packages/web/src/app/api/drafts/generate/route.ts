import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

function cleanAiDraft(rawText: string, customerName = 'there'): string {
  if (!rawText) return '';
  let text = rawText;

  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  text = text.replace(/^(?:Here's a thinking process:?|Thinking:?|Here is the thinking process:?)[\s\S]*?\n\n/i, '').trim();
  text = text.replace(/^\d+\.\s+\*\*Analyze User Input:\*\*[\s\S]*?\n\n/i, '').trim();
  text = text.replace(/^```(?:markdown|text|email)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
  text = text
    .replace(/^(?:Here is (?:the|a) (?:draft|reply|response|suggested reply):?|Draft reply:?|Response:?|Email:?)\s*\n+/i, '')
    .trim();

  text = text
    .replace(/{{name}}/g, customerName)
    .replace(/{{customer_name}}/g, customerName)
    .replace(/\[Customer\]/g, customerName)
    .replace(/\[Name\]/g, customerName);

  if (customerName && customerName.toLowerCase() !== 'there') {
    text = text.replace(/^(?:Hi|Hello|Dear)\s+there,/im, `Hi ${customerName},`);
    text = text.replace(/^(?:Hi|Hello|Dear),/im, `Hi ${customerName},`);
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

  // 2. Rate Limiting Check (20 requests per 60 seconds)
  const now = Date.now();
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

    // 3. Fetch Platform AI Settings securely on the server
    const { data: settings } = await supabaseAdmin
      .from('platform_settings')
      .select('*')
      .limit(1)
      .single();

    const customerName = extractSenderName(threadContent || '');
    let draftText = '';
    let openRouterSuccess = false;

    const strictSystemPrompt = `You are DraftPilot, an intelligent customer support assistant. You write concise, friendly, and professional email replies directly to customers based on company knowledge.

CRITICAL INSTRUCTIONS:
1. Output ONLY the raw final email reply text.
2. Absolutely DO NOT output any thinking process, analysis, reasoning steps, or markdown bullets.
3. Start directly with "Hi ${customerName}," and end with "Best regards,\\nSupport Team".
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

        const userPrompt = `Customer Message:\n${threadContent}\n\n${knowledgeContext}Write the clean, direct customer email reply now:`;

        // 1. Try Primary Model
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
        });

        let openRouterData = await openrouterRes.json().catch(() => null);

        // 2. If Primary fails, attempt Automatic Fallback Model
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

    // 4. Grounded Fallback
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
        draftText = `Hi ${customerName},\n\nThank you for getting in touch with us! I have reviewed your inquiry and would be glad to assist you.\n\nCould you please provide a few more details so I can resolve this as quickly as possible for you?\n\nLooking forward to hearing back from you,\nCustomer Support Team`;
      }
    }

    // 5. Insert Draft History
    if (teamId) {
      try {
        await supabaseAdmin.from('draft_history').insert({
          team_id: teamId,
          user_id: user.id,
          thread_snippet: (threadContent || '').slice(0, 200),
          generated_draft: draftText,
          macro_used_id: matchedMacro?.id || null,
        });
      } catch (histErr) {
        console.warn('Draft history logging note:', histErr);
      }
    }

    return NextResponse.json({
      draft: draftText,
      macroUsed: matchedMacro?.name || null,
      confidence: matchedMacro ? 96 : 88,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
