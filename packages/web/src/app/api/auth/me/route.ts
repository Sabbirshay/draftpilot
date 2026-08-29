import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://amjliubpbysvtiqpbgnh.supabase.co';
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtamxpdWJwYnlzdnRpcXBiZ25oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzM4ODI0MCwiZXhwIjoyMTAyOTY0MjQwfQ.6uJXakWY4X_azHLFrJpuRhkVoej4yVyDiGWGCjIy9sw';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

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
  const email = authUser.email || '';
  const metadata = authUser.user_metadata || {};
  const fullName = metadata.full_name || metadata.name || email.split('@')[0] || 'User';
  const avatarUrl = metadata.avatar_url || metadata.picture || null;
  const defaultTeamName = metadata.team_name || `${fullName}'s Team`;

  try {
    // 1. Fetch user from DB
    let { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('*, teams(*)')
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
        .select('*, teams(*)')
        .single();

      if (userErr) throw userErr;
      existingUser = newUser;

      // Create onboarding state
      await supabaseAdmin.from('onboarding_state').insert({ team_id: newTeam.id });
    } else if (existingUser.team_id && !existingUser.teams) {
      // Fetch team explicitly if relation join was null
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
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
