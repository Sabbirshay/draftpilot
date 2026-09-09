import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-passkey, x-requested-with',
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

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return jsonResponse({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const userId = authData.user.id;
    const { data: dbUser } = await supabaseAdmin
      .from('users')
      .select('team_id')
      .eq('id', userId)
      .maybeSingle();

    const teamId = dbUser?.team_id || userId;

    const month = new Date().toISOString().slice(0, 7) + '-01';

    // Parse date filters if provided
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let draftHistoryQuery = supabaseAdmin
      .from('draft_history')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);

    if (startDate) {
      draftHistoryQuery = draftHistoryQuery.gte('created_at', `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      draftHistoryQuery = draftHistoryQuery.lte('created_at', `${endDate}T23:59:59.999Z`);
    }

    const [teamRes, macrosRes, draftsRes, usageRes] = await Promise.all([
      supabaseAdmin.from('teams').select('id, plan, monthly_draft_limit').eq('id', teamId).maybeSingle(),
      supabaseAdmin.from('macros').select('*', { count: 'exact', head: true }).eq('team_id', teamId),
      draftHistoryQuery,
      supabaseAdmin.from('usage').select('draft_count').eq('team_id', teamId).eq('month', month).maybeSingle(),
    ]);

    const team = teamRes.data;
    const monthlyLimit = team?.monthly_draft_limit || (team?.plan === 'team' ? 1000 : 50);
    const teamPlan = team?.plan || 'free';
    const macrosCount = macrosRes.count || 0;
    const historyCount = draftsRes.count || 0;
    const usageDraftCount = usageRes.data?.draft_count || 0;

    // Use history count, but if history is 0 and usage has drafts, use usage count
    const effectiveDraftsCount = Math.max(historyCount, usageDraftCount);

    return jsonResponse({
      draftsCount: effectiveDraftsCount,
      historyCount,
      usageDraftCount,
      monthlyLimit,
      macrosCount,
      teamPlan,
    });
  } catch (err: any) {
    return jsonResponse({ error: err.message }, { status: 500 });
  }
}
