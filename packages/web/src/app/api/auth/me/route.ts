import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
  }

  const authUser = authData.user;
  const email = (authUser.email || '').trim().toLowerCase();
  const metadata = authUser.user_metadata || {};
  const fullName = metadata.full_name || metadata.name || email.split('@')[0] || 'User';
  const avatarUrl = metadata.avatar_url || metadata.picture || null;
  const defaultTeamName = metadata.team_name || `${fullName}'s Team`;

  try {
    // 0. Check if user email is present in banned_emails registry
    if (email) {
      const { data: bannedEntry } = await supabaseAdmin
        .from('banned_emails')
        .select('id, reason')
        .ilike('email', email)
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

    // 1. Fetch user from DB
    let { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (!existingUser) {
      // Auto-provision team and user if not in DB yet
      const { data: newTeam, error: teamErr } = await supabaseAdmin
        .from('teams')
        .insert({ name: defaultTeamName, plan: 'free', monthly_draft_limit: 50 })
        .select()
        .single();

      if (teamErr) throw teamErr;

      const { data: newUser, error: userErr } = await supabaseAdmin
        .from('users')
        .insert({
          id: authUser.id,
          team_id: newTeam.id,
          email,
          full_name: fullName,
          avatar_url: avatarUrl,
          role: 'owner',
        })
        .select('*')
        .single();

      if (userErr) throw userErr;
      existingUser = { ...newUser, teams: newTeam };

      // Create onboarding state
      await supabaseAdmin.from('onboarding_state').insert({ team_id: newTeam.id });
    } else if (existingUser.team_id) {
      // Fetch fresh team directly from teams table
      const { data: teamData } = await supabaseAdmin
        .from('teams')
        .select('*')
        .eq('id', existingUser.team_id)
        .single();
      if (teamData) {
        existingUser.teams = teamData;
      }
    }

    // 2. Fetch onboarding state
    const { data: obState } = await supabaseAdmin
      .from('onboarding_state')
      .select('*')
      .eq('team_id', existingUser.team_id)
      .maybeSingle();

    return NextResponse.json({
      user: existingUser,
      team: existingUser.teams,
      onboardingState: obState || {
        gmail_connected: false,
        first_macro_added: false,
        extension_installed: false,
        viewed_demo: false,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
