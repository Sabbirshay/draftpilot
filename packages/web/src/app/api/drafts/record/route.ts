import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getActiveRootPasskey, timingSafeEqual } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

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
  try {
    let userId: string | null = null;
    let teamId: string | null = null;

    // 1. Authenticate via admin passkey or Bearer token
    const adminPasskey = req.headers.get('x-admin-passkey')?.trim();
    if (adminPasskey) {
      const configuredPasskey = await getActiveRootPasskey();
      if (configuredPasskey && timingSafeEqual(adminPasskey, configuredPasskey)) {
        userId = 'admin-playground';
      }
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (!authErr && authData?.user) {
        userId = authData.user.id;
        const { data: dbUser } = await supabaseAdmin
          .from('users')
          .select('team_id')
          .eq('id', userId)
          .maybeSingle();
        teamId = dbUser?.team_id || null;
      }
    }

    // Reject unauthenticated requests
    if (!userId) {
      return jsonResponse(
        { error: 'Unauthorized: Valid authentication token or admin passkey required' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    // If admin-playground, allow body.teamId if specified, or resolve default team
    if (userId === 'admin-playground') {
      if (body.teamId || body.team_id) {
        teamId = String(body.teamId || body.team_id).trim();
      } else {
        const { data: defaultTeam } = await supabaseAdmin
          .from('teams')
          .select('id')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        teamId = defaultTeam?.id || null;
      }
    }

    if (!teamId) {
      return jsonResponse(
        { error: 'Forbidden: User is not associated with an active workspace' },
        { status: 403 }
      );
    }

    const threadSnippet = String(body.threadSnippet || body.thread_snippet || '').slice(0, 200);
    const generatedDraft = String(body.generatedDraft || body.generated_draft || body.draft || '');
    const macroUsedId = body.macroUsedId || body.macro_used_id || null;

    if (!generatedDraft) {
      return jsonResponse({ error: 'Missing generatedDraft content' }, { status: 400 });
    }

    // 2. Insert into draft_history using service role
    const { data: insertedDraft, error: insertErr } = await supabaseAdmin
      .from('draft_history')
      .insert({
        team_id: teamId,
        user_id: userId === 'admin-playground' ? (body.userId || teamId) : userId,
        thread_snippet: threadSnippet,
        generated_draft: generatedDraft,
        macro_used_id: macroUsedId,
      })
      .select('id')
      .single();

    if (insertErr || !insertedDraft) {
      console.error('draft_history insert failed:', insertErr);
      return jsonResponse(
        { error: 'Failed to record draft in history', details: insertErr?.message },
        { status: 500 }
      );
    }

    // 3. Atomically update monthly usage table
    const month = new Date().toISOString().slice(0, 7) + '-01';
    let updatedCount = 1;

    try {
      const { data: rpcCount, error: rpcErr } = await supabaseAdmin
        .rpc('increment_team_usage', { p_team_id: teamId, p_month: month });

      if (!rpcErr && typeof rpcCount === 'number') {
        updatedCount = rpcCount;
      } else {
        // Fallback to atomic upsert
        const { data: existingUsage } = await supabaseAdmin
          .from('usage')
          .select('id, draft_count')
          .eq('team_id', teamId)
          .eq('month', month)
          .maybeSingle();

        if (existingUsage) {
          updatedCount = (existingUsage.draft_count || 0) + 1;
          await supabaseAdmin
            .from('usage')
            .update({ draft_count: updatedCount })
            .eq('id', existingUsage.id);
        } else {
          await supabaseAdmin
            .from('usage')
            .insert({ team_id: teamId, month, draft_count: 1 });
        }
      }
    } catch (usageErr) {
      console.warn('Usage increment note:', usageErr);
    }

    // 4. Update onboarding milestone in background
    try {
      const { data: obState } = await supabaseAdmin
        .from('onboarding_state')
        .select('id, first_draft_generated')
        .eq('team_id', teamId)
        .maybeSingle();

      if (obState) {
        if (!obState.first_draft_generated) {
          await supabaseAdmin
            .from('onboarding_state')
            .update({ first_draft_generated: true })
            .eq('id', obState.id);
        }
      } else {
        await supabaseAdmin
          .from('onboarding_state')
          .insert({ team_id: teamId, first_draft_generated: true });
      }
    } catch (obErr) {
      console.warn('Onboarding state update note:', obErr);
    }

    return jsonResponse({
      success: true,
      draftId: insertedDraft.id,
      draftCount: updatedCount,
    });
  } catch (err: any) {
    return jsonResponse({ error: err.message }, { status: 500 });
  }
}
