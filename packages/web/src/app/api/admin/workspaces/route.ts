import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export async function GET() {
  try {
    const [teamsRes, usersRes, draftsRes] = await Promise.all([
      supabaseAdmin.from('teams').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('users').select('*'),
      supabaseAdmin.from('draft_history').select('team_id'),
    ]);

    if (teamsRes.error) throw teamsRes.error;

    // Map users by team_id
    const usersByTeam: Record<string, any[]> = {};
    (usersRes.data || []).forEach((u) => {
      if (u.team_id) {
        if (!usersByTeam[u.team_id]) usersByTeam[u.team_id] = [];
        usersByTeam[u.team_id].push(u);
      }
    });

    // Map draft counts by team_id
    const draftCounts: Record<string, number> = {};
    (draftsRes.data || []).forEach((d) => {
      if (d.team_id) {
        draftCounts[d.team_id] = (draftCounts[d.team_id] || 0) + 1;
      }
    });

    const workspaces = (teamsRes.data || []).map((t) => {
      const teamUsers = usersByTeam[t.id] || [];
      const owner = teamUsers.find((u) => u.role === 'owner') || teamUsers[0];
      const email = owner?.email || 'admin@workspace.com';
      const domain = email.includes('@') ? email.split('@')[1] : 'workspace.io';

      return {
        id: t.id,
        name: t.name || 'Support Workspace',
        domain,
        ownerEmail: email,
        plan: t.plan === 'team' ? 'Team' : t.plan === 'enterprise' ? 'Enterprise' : 'Free',
        seats: teamUsers.length || 1,
        monthlyQuota: t.monthly_draft_limit || 50,
        usedDrafts: draftCounts[t.id] || 0,
        status: 'Active',
        createdAt: t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : '2026-08-01',
      };
    });

    return NextResponse.json({ workspaces });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, monthly_draft_limit, plan } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing workspace id' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (monthly_draft_limit !== undefined) updates.monthly_draft_limit = monthly_draft_limit;
    if (plan !== undefined) updates.plan = plan.toLowerCase();

    const { data, error } = await supabaseAdmin
      .from('teams')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, workspace: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
