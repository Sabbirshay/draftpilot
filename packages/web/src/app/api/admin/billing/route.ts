import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, verifySuperAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const PLAN_PRICING: Record<string, number> = {
  free: 0,
  team: 19,
  enterprise: 99,
};

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdmin(req);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const [teamsRes, usersRes] = await Promise.all([
      supabaseAdmin.from('teams').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('users').select('id, team_id, email, role, full_name'),
    ]);

    if (teamsRes.error) throw teamsRes.error;

    const teams = teamsRes.data || [];
    const users = usersRes.data || [];

    // Group users by team
    const usersByTeam: Record<string, any[]> = {};
    users.forEach((u) => {
      if (u.team_id) {
        if (!usersByTeam[u.team_id]) usersByTeam[u.team_id] = [];
        usersByTeam[u.team_id].push(u);
      }
    });

    let freeCount = 0;
    let teamCount = 0;
    let enterpriseCount = 0;
    let activeStripeCount = 0;
    let totalMRR = 0;

    const workspaceSubscriptions = teams.map((t) => {
      const planKey = (t.plan || 'free').toLowerCase();
      const teamUsers = usersByTeam[t.id] || [];
      const seats = Math.max(1, teamUsers.length);
      const owner = teamUsers.find((u) => u.role === 'owner') || teamUsers[0];
      const ownerEmail = owner?.email || 'admin@workspace.io';
      const hasActiveStripe = Boolean(t.stripe_subscription_id);
      const cadence = (t.billing_cadence || 'monthly').toLowerCase();

      if (hasActiveStripe) {
        activeStripeCount++;
      }

      let monthlyValue = 0;
      if (planKey === 'enterprise') {
        enterpriseCount++;
        monthlyValue = cadence === 'annual' ? 79 : 99;
      } else if (planKey === 'team') {
        teamCount++;
        monthlyValue = (cadence === 'annual' ? 15 : 19) * seats;
      } else {
        freeCount++;
        monthlyValue = 0;
      }

      totalMRR += monthlyValue;

      let status = 'Free Tier';
      if (hasActiveStripe) {
        status = `Active Stripe (${cadence})`;
      } else if (planKey !== 'free') {
        status = 'Active Paid (Direct/Comp)';
      }

      return {
        id: t.id,
        name: t.name || 'Support Workspace',
        ownerEmail,
        plan: planKey,
        cadence,
        seats,
        hasActiveStripe,
        monthlyQuota: t.monthly_draft_limit || (planKey === 'free' ? 50 : 1000),
        monthlyValue,
        status,
        createdAt: t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : '2026-08-01',
      };
    });

    const totalWorkspaces = teams.length;
    const paidWorkspaces = teamCount + enterpriseCount;
    const conversionRate = totalWorkspaces > 0 ? Math.round((paidWorkspaces / totalWorkspaces) * 100) : 0;
    const arpa = paidWorkspaces > 0 ? Math.round(totalMRR / paidWorkspaces) : 0;
    const totalARR = totalMRR * 12;

    return NextResponse.json({
      metrics: {
        totalMRR,
        totalARR,
        projectedMRR: totalMRR,
        projectedARR: totalARR,
        activeStripeSubscriptions: activeStripeCount,
        totalWorkspaces,
        paidWorkspaces,
        freeWorkspaces: freeCount,
        teamWorkspaces: teamCount,
        enterpriseWorkspaces: enterpriseCount,
        conversionRate,
        arpa,
      },
      workspaces: workspaceSubscriptions,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await verifySuperAdmin(req);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const body = await req.json();
    const { teamId, plan, monthlyQuota } = body;

    if (!teamId) {
      return NextResponse.json({ error: 'Missing teamId parameter' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (plan) {
      updates.plan = plan.toLowerCase();
    }
    if (monthlyQuota !== undefined) {
      updates.monthly_draft_limit = Number(monthlyQuota);
    } else if (plan) {
      // Auto-set default quota for plan
      if (plan.toLowerCase() === 'team') updates.monthly_draft_limit = 1000;
      if (plan.toLowerCase() === 'enterprise') updates.monthly_draft_limit = 5000;
      if (plan.toLowerCase() === 'free') updates.monthly_draft_limit = 50;
    }

    const { data, error } = await supabaseAdmin
      .from('teams')
      .update(updates)
      .eq('id', teamId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, team: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
