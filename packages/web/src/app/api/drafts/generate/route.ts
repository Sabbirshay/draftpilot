import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getActiveRootPasskey, timingSafeEqual } from '@/lib/admin-auth';
import { scrubPII } from '@/lib/pii-scrubber';
import { cleanAiDraft, extractSenderName, synthesizeSmartSupportDraft } from '@/lib/draft-utils';

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
  draftRecorded?: boolean;
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

  // 3. Superadmin privilege check (authorizes test mode and model/prompt overrides)
  const superadminEmails = (process.env.SUPERADMIN_EMAILS || 'mdronykhan4633@gmail.com,mdronykhan4632@gmail.com,admin@draftpilot.app,admin@draftpilot.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  let isSuperadmin = user.id === 'admin-playground' || superadminEmails.includes(userEmail);
  if (!isSuperadmin && user.id && user.id !== 'admin-playground') {
    const { data: uRole } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (uRole?.role === 'superadmin') {
      isSuperadmin = true;
    }
  }

  // 4. Fetch Platform AI Settings & Maintenance Mode Check
  const { data: settings } = await supabaseAdmin
    .from('platform_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  // Check feature flags for emergency maintenance mode
  const featureFlags = (settings as any)?.feature_flags;
  if (Array.isArray(featureFlags)) {
    const maintenanceFlag = featureFlags.find((f: any) => f.key === 'feat_maintenance_lockdown');
    if (maintenanceFlag?.enabled && user.id !== 'admin-playground') {
      return jsonResponse(
        {
          error: 'DraftPilot generation is temporarily paused for scheduled maintenance. Please try again shortly.',
          maintenance: true,
        },
        { status: 503 }
      );
    }
  }

  try {
    const body = await req.json();
    const { matchedMacro, kbSnippets, forceSource, isTest } = body;

    // Quota bypass (isTest) is strictly restricted to verified superadmin / admin-playground
    const isTestMode = isSuperadmin && Boolean(isTest || user.id === 'admin-playground');

    // 1. Thread content normalization
    const rawThreadContent = (
      typeof body.threadContent === 'string' && body.threadContent.trim()
        ? body.threadContent
        : (typeof body.thread === 'string' ? body.thread : '')
    ).trim();

    // 2. Dynamic system prompt extraction (only permitted for superadmin / admin playground)
    const isSystemLike = (val: string) =>
      val.includes('You are DraftPilot') || val.includes('system prompt');

    const dynamicSystemPrompt =
      isSuperadmin
        ? ((typeof body.systemPrompt === 'string' && body.systemPrompt.trim()) ||
           (typeof body.system_prompt === 'string' && body.system_prompt.trim()) ||
           (typeof body.promptOverride === 'string' && isSystemLike(body.promptOverride)
             ? body.promptOverride.trim()
             : undefined) ||
           undefined)
        : undefined;

    // 3. Multi-alias extraction for agent guidance / macroHint
    const rawInstruction =
      (typeof body.macroHint === 'string' && body.macroHint.trim()) ||
      (typeof body.customInstruction === 'string' && body.customInstruction.trim()) ||
      (typeof body.instruction === 'string' && body.instruction.trim()) ||
      (typeof body.userPrompt === 'string' && body.userPrompt.trim()) ||
      (typeof body.promptOverride === 'string' && !isSystemLike(body.promptOverride) && body.promptOverride.trim()) ||
      '';

    const macroHint = typeof rawInstruction === 'string' ? rawInstruction.trim() : '';

    // 4. Fetch User & Team Record
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

      if (!teamId) {
        return jsonResponse(
          { error: 'Forbidden: Account is not associated with an active workspace' },
          { status: 403 }
        );
      }
    } else {
      teamId = body.teamId || body.team_id || null;
    }

    // Monthly Quota Check (bypassed for authorized test mode)
    const month = new Date().toISOString().slice(0, 7) + '-01';
    let currentDraftsUsed = 0;
    let monthlyLimit = 50;

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
        .maybeSingle();

      if (usageData) {
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

    // 5. PII Scrubbing Across ALL Prompt Segments (Thread, Guidance, Macros, KB, System Prompt)
    const customPiiRules = Array.isArray(dbUser?.teams?.custom_pii_rules) ? dbUser.teams.custom_pii_rules : [];

    const scrubbedThreadContent = scrubPII(rawThreadContent, customPiiRules);
    const scrubbedMacroHint = macroHint ? scrubPII(macroHint, customPiiRules) : '';
    const scrubbedMatchedMacroContent = matchedMacro?.content ? scrubPII(matchedMacro.content, customPiiRules) : '';

    // Hoisted KB retrieval
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

    const scrubbedKbSnippets = effectiveKbSnippets.map((s: string) => scrubPII(s, customPiiRules));
    const scrubbedDynamicSystemPrompt = dynamicSystemPrompt ? scrubPII(dynamicSystemPrompt, customPiiRules) : undefined;

    const customerName = extractSenderName(scrubbedThreadContent);
    let draftText = '';
    let openRouterSuccess = false;
    let lastOpenRouterError = '';
    let activeModel = '';
    let actualModelUsed = '';

    const baseSystemPrompt =
      scrubbedDynamicSystemPrompt ||
      settings?.system_prompt?.trim() ||
      'You are DraftPilot, an intelligent customer support assistant. You write concise, friendly, and professional email replies directly to customers based on company knowledge.';

    const strictSystemPrompt = `${baseSystemPrompt}

CRITICAL INSTRUCTIONS:
1. Output ONLY the raw final email reply text ready to send.
2. Absolutely DO NOT output any thinking process, analysis, reasoning steps, or markdown bullets.
3. Start directly with "Hi ${customerName}," and end with "Best regards,\nCustomer Support Team".
4. Do NOT wrap in markdown code blocks.
5. If "Agent Guidance / Custom Instruction" is provided, it represents direct human supervisor guidance that takes highest priority and MUST be reflected in the reply, overriding default policies or standard templates when in conflict.`;

    const openrouterApiKey =
      settings?.openrouter_api_key?.trim() ||
      process.env.OPENROUTER_API_KEY?.trim() ||
      process.env.NEXT_PUBLIC_OPENROUTER_API_KEY?.trim() ||
      '';

    const aiProvider = settings?.ai_provider || 'openrouter';
    const isOfflineMode = aiProvider === 'offline' || forceSource === 'synthesizer';

    if (openrouterApiKey && !isOfflineMode) {
      try {
        const dynamicModel =
          isSuperadmin
            ? ((typeof body.selected_model === 'string' && body.selected_model.trim()) ||
               (typeof body.model === 'string' && body.model.trim()) ||
               (typeof body.openrouter_model === 'string' && body.openrouter_model.trim()) ||
               undefined)
            : undefined;

        activeModel = dynamicModel || settings?.selected_model || settings?.openrouter_model || 'z-ai/glm-5.3-flash';
        actualModelUsed = activeModel;
        const fallbackModel = activeModel.includes('26b')
          ? 'google/gemma-4-31b-it:free'
          : (activeModel === 'z-ai/glm-5.3-flash' ? 'z-ai/glm-5.2:free' : 'google/gemma-4-26b-a4b-it:free');

        let knowledgeContext = '';
        if (scrubbedMatchedMacroContent) {
          knowledgeContext += `### Recommended Support Macro & Policy:\n${scrubbedMatchedMacroContent}\n\n`;
        }

        if (scrubbedKbSnippets.length > 0) {
          knowledgeContext += `### Knowledge Base & Documentation Context:\n${scrubbedKbSnippets.join('\n---\n')}\n\n`;
        }

        let agentGuidanceContext = '';
        if (scrubbedMacroHint) {
          agentGuidanceContext = `### Agent Guidance / Custom Instruction:\n${scrubbedMacroHint}\n\n`;
        }

        const userPrompt = `Customer Message:\n${scrubbedThreadContent}\n\n${knowledgeContext}${agentGuidanceContext}Write the clean, direct customer email reply now:`;

        const isReasoningMandatory = (model: string) =>
          model.includes('o1') || model.includes('o3') || model.includes('glm-5.3');

        // Bounded candidate models: try activeModel and fallbackModel at most (staying within 60s timeout budget)
        const candidateModels: string[] = [activeModel];
        if (fallbackModel && fallbackModel !== activeModel) {
          candidateModels.push(fallbackModel);
        }

        actualModelUsed = activeModel;
        for (const modelToTry of candidateModels) {
          try {
            const max_tokens = (() => {
              let configured = 1000;
              if (body.max_tokens !== undefined && body.max_tokens !== null) {
                const parsedBody = Number(body.max_tokens);
                if (!isNaN(parsedBody) && parsedBody > 0) {
                  configured = isSuperadmin
                    ? Math.max(100, Math.min(4000, parsedBody))
                    : Math.max(100, Math.min(1000, parsedBody));
                }
              } else {
                const parsed = Number(settings?.max_tokens);
                if (!isNaN(parsed) && parsed > 0) {
                  configured = Math.max(100, Math.min(1000, parsed));
                }
              }
              return modelToTry.includes('glm-5.3') ? Math.max(800, configured) : configured;
            })();

            const temperature = (() => {
              if (body.temperature !== undefined && body.temperature !== null) {
                const parsedBody = Number(body.temperature);
                if (!isNaN(parsedBody)) {
                  return Math.max(0.0, Math.min(1.5, parsedBody));
                }
              }
              const parsed = Number(settings?.temperature);
              return settings?.temperature !== undefined && settings?.temperature !== null && !isNaN(parsed)
                ? Math.max(0.0, Math.min(1.5, parsed))
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

            const timeoutMs = 20000; // 20s budget per model attempt
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

              // Stop cascade early on auth or quota errors
              if (openrouterRes.status === 401 || openrouterRes.status === 402 || openrouterRes.status === 429) {
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

    // 6. Grounded Fallback / Truthful Local Synthesizer
    if (!openRouterSuccess) {
      if (scrubbedMatchedMacroContent) {
        draftText = scrubbedMatchedMacroContent
          .replace(/{{name}}/g, customerName)
          .replace(/{{customer_name}}/g, customerName)
          .replace(/\[Customer\]/g, customerName)
          .replace(/\[Name\]/g, customerName);

        if (customerName && customerName.toLowerCase() !== 'there') {
          draftText = draftText.replace(/^(?:Hi|Hello|Dear)\s+there,/im, `Hi ${customerName},`);
          draftText = draftText.replace(/^(?:Hi|Hello|Dear),/im, `Hi ${customerName},`);
        }
      } else {
        draftText = synthesizeSmartSupportDraft(scrubbedThreadContent, customerName, scrubbedKbSnippets, scrubbedMacroHint || '');
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
    for (const snippet of scrubbedKbSnippets) harvestContacts(snippet);
    if (scrubbedMatchedMacroContent) harvestContacts(scrubbedMatchedMacroContent);

    const scrubbedDraftText = scrubPII(draftText, customPiiRules, kbContactsWhitelist);

    // 7. Insert Draft History & Atomically Increment Usage (bypassed for test mode)
    let draftRecorded = false;

    if (!isTestMode && teamId) {
      try {
        const { data: insertedDraft, error: histErr } = await supabaseAdmin
          .from('draft_history')
          .insert({
            team_id: teamId,
            user_id: user.id,
            thread_snippet: (scrubbedThreadContent || '').slice(0, 200),
            generated_draft: scrubbedDraftText,
            macro_used_id: matchedMacro?.id || null,
          })
          .select('id')
          .single();

        if (!histErr && insertedDraft) {
          draftRecorded = true;

          // Increment monthly usage count atomically
          try {
            const { error: rpcErr } = await supabaseAdmin
              .rpc('increment_team_usage', { p_team_id: teamId, p_month: month });

            if (rpcErr) {
              // Fallback to update
              const { data: existingUsage } = await supabaseAdmin
                .from('usage')
                .select('id, draft_count')
                .eq('team_id', teamId)
                .eq('month', month)
                .maybeSingle();

              if (existingUsage) {
                await supabaseAdmin
                  .from('usage')
                  .update({ draft_count: (existingUsage.draft_count || 0) + 1 })
                  .eq('id', existingUsage.id);
              } else {
                await supabaseAdmin.from('usage').insert({
                  team_id: teamId,
                  month,
                  draft_count: 1,
                });
              }
            }
          } catch (uErr) {
            console.warn('Atomic usage increment note:', uErr);
          }

          // Auto-unlock AI Draft onboarding milestone
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
      if (isOfflineMode) {
        notice = 'Draft generated using local support template (offline mode active).';
      } else if (!openrouterApiKey) {
        notice = 'No OpenRouter API key configured in Platform Settings or environment. Generated using fallback template.';
      } else {
        notice = `AI generation unavailable (${lastOpenRouterError || 'candidate models exhausted'}). Generated using fallback template.`;
      }
    }

    return jsonResponse({
      draft: scrubbedDraftText,
      macroUsed: matchedMacro?.name || null,
      confidence: matchedMacro ? 96 : (openRouterSuccess ? 92 : 80),
      source: draftSource,
      customerName: customerName || 'there',
      modelUsed: openRouterSuccess ? actualModelUsed : undefined,
      isFallback: openRouterSuccess ? actualModelUsed !== activeModel : (!openRouterSuccess && !matchedMacro?.content),
      draftRecorded,
      ...(notice ? { notice } : {}),
    });
  } catch (err: any) {
    return jsonResponse({ error: err.message }, { status: 500 });
  }
}
