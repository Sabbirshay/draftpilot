import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Authenticates incoming request via Bearer token in Authorization header.
 * Returns authenticated user and null errorResponse, or null user and 401/403 errorResponse.
 */
async function authenticateRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Missing or invalid Authorization header' },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Missing token' },
        { status: 401 }
      ),
    };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Invalid or expired token' },
        { status: 401 }
      ),
    };
  }

  const user = authData.user;
  const email = (user.email || '').trim().toLowerCase();

  // Guard: Check if email is in banned_emails registry
  if (email) {
    const { data: bannedEntry } = await supabaseAdmin
      .from('banned_emails')
      .select('id, reason')
      .ilike('email', email)
      .maybeSingle();

    if (bannedEntry) {
      return {
        user: null,
        errorResponse: NextResponse.json(
          {
            error: 'Account deactivated. Please contact support.',
            banned: true,
            reason: bannedEntry.reason || 'Account deactivated by Super Admin',
          },
          { status: 403 }
        ),
      };
    }
  }

  return { user, errorResponse: null };
}

/**
 * Resolves the team ID for the authenticated user, creating team and user record if absent.
 */
async function resolveTeamId(user: any): Promise<string | null> {
  const { data: dbUser } = await supabaseAdmin
    .from('users')
    .select('team_id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (dbUser?.team_id) {
    return dbUser.team_id;
  }

  const email = (user.email || '').trim().toLowerCase();
  const metadata = user.user_metadata || {};
  const fullName = metadata.full_name || metadata.name || email.split('@')[0] || 'User';
  const defaultTeamName = metadata.team_name || `${fullName}'s Team`;

  try {
    const { data: newTeam, error: teamErr } = await supabaseAdmin
      .from('teams')
      .insert({ name: defaultTeamName, plan: 'free', monthly_draft_limit: 50 })
      .select()
      .single();

    if (teamErr || !newTeam) return null;

    await supabaseAdmin
      .from('users')
      .upsert({
        id: user.id,
        team_id: newTeam.id,
        email,
        full_name: fullName,
        role: 'owner',
      });

    return newTeam.id;
  } catch {
    return null;
  }
}

/**
 * POST /api/extension/heartbeat
 * Heartbeat pairing telemetry from the Chrome extension.
 * Authenticates user, retrieves team_id, and upserts onboarding_state with
 * extension_installed: true, gmail_connected: true, updated_at: new Date().toISOString().
 */
export async function POST(req: NextRequest) {
  try {
    const { user, errorResponse } = await authenticateRequest(req);
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const teamId = await resolveTeamId(user);
    if (!teamId) {
      return NextResponse.json(
        { error: 'Failed to resolve user team for extension pairing' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const version = typeof body?.version === 'string' ? body.version : '0.1.0';
    const now = new Date().toISOString();

    const { data: existingState } = await supabaseAdmin
      .from('onboarding_state')
      .select('*')
      .eq('team_id', teamId)
      .maybeSingle();

    if (existingState) {
      await supabaseAdmin
        .from('onboarding_state')
        .update({
          extension_installed: true,
          gmail_connected: true,
          updated_at: now,
        })
        .eq('team_id', teamId);
    } else {
      await supabaseAdmin
        .from('onboarding_state')
        .insert({
          team_id: teamId,
          extension_installed: true,
          gmail_connected: true,
          first_macro_added: false,
          viewed_demo: false,
          updated_at: now,
        });
    }

    return NextResponse.json(
      {
        success: true,
        teamId,
        extension_installed: true,
        gmail_connected: true,
        version,
        updated_at: now,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/extension/heartbeat
 * Checks current extension pairing status for the authenticated user/team.
 */
export async function GET(req: NextRequest) {
  try {
    const { user, errorResponse } = await authenticateRequest(req);
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const teamId = await resolveTeamId(user);
    if (!teamId) {
      return NextResponse.json(
        { error: 'Failed to resolve user team' },
        { status: 500 }
      );
    }

    const { data: state } = await supabaseAdmin
      .from('onboarding_state')
      .select('*')
      .eq('team_id', teamId)
      .maybeSingle();

    return NextResponse.json(
      {
        success: true,
        teamId,
        extension_installed: Boolean(state?.extension_installed),
        gmail_connected: Boolean(state?.gmail_connected),
        onboardingState: state || {
          extension_installed: false,
          gmail_connected: false,
          first_macro_added: false,
          viewed_demo: false,
        },
        version: '0.1.0',
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
