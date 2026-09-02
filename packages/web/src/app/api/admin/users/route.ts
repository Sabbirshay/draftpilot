import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, verifySuperAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdmin(req);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const [usersRes, draftsRes, bannedRes] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('id, email, full_name, role, team_id, avatar_url, created_at, teams(id, name, plan)')
        .order('created_at', { ascending: false }),
      supabaseAdmin.from('draft_history').select('user_id, team_id'),
      supabaseAdmin
        .from('banned_emails')
        .select('id, email, reason, banned_by, created_at, updated_at')
        .order('created_at', { ascending: false }),
    ]);

    if (usersRes.error) throw usersRes.error;

    // Count drafts per user
    const userDraftCounts: Record<string, number> = {};
    (draftsRes.data || []).forEach((d: any) => {
      if (d.user_id) {
        userDraftCounts[d.user_id] = (userDraftCounts[d.user_id] || 0) + 1;
      }
    });

    const users = (usersRes.data || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name || u.email?.split('@')[0] || 'User',
      role: u.role || 'member',
      team_id: u.team_id,
      team_name: (u.teams as any)?.name || 'Personal Workspace',
      team_plan: (u.teams as any)?.plan || 'free',
      drafts_count: userDraftCounts[u.id] || 0,
      created_at: u.created_at,
    }));

    const bannedEmails = (bannedRes.data || []).map((b: any) => ({
      id: b.id,
      email: b.email,
      reason: b.reason || 'Banned by Super Admin',
      banned_by: b.banned_by || 'Super Admin',
      created_at: b.created_at,
      updated_at: b.updated_at,
    }));

    return NextResponse.json({
      success: true,
      users,
      bannedEmails,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifySuperAdmin(req);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const body = await req.json();
    const { action = 'ban', email, reason, deleteUser = true, userId } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (action === 'unban') {
      const { error: unbanErr } = await supabaseAdmin
        .from('banned_emails')
        .delete()
        .ilike('email', normalizedEmail);

      if (unbanErr) throw unbanErr;

      return NextResponse.json({
        success: true,
        message: `Permission restored for ${normalizedEmail}`,
      });
    }

    // Default action: 'ban'
    const bannedBy = auth.user?.email || 'Super Admin';
    const { error: banErr } = await supabaseAdmin
      .from('banned_emails')
      .upsert(
        {
          email: normalizedEmail,
          reason: reason || 'Banned by Super Admin',
          banned_by: bannedBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      );

    if (banErr) throw banErr;

    // Delete user from DB and Supabase Auth if deleteUser is requested
    if (deleteUser) {
      // 1. Delete from public.users
      await supabaseAdmin.from('users').delete().ilike('email', normalizedEmail);

      // 2. Delete from auth.users
      try {
        if (userId) {
          await supabaseAdmin.auth.admin.deleteUser(userId);
        } else {
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
          const targetAuthUser = authUsers?.users?.find(
            (u) => u.email?.toLowerCase() === normalizedEmail
          );
          if (targetAuthUser) {
            await supabaseAdmin.auth.admin.deleteUser(targetAuthUser.id);
          }
        }
      } catch (authErr) {
        console.warn('[admin/users] Notice deleting auth user:', authErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `User ${normalizedEmail} deactivated and added to banned registry`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await verifySuperAdmin(req);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const url = new URL(req.url);
    let email = url.searchParams.get('email');

    if (!email) {
      try {
        const body = await req.json();
        email = body.email;
      } catch {
        // body could be empty for query-based DELETE
      }
    }

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email parameter is required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { error: deleteErr } = await supabaseAdmin
      .from('banned_emails')
      .delete()
      .ilike('email', normalizedEmail);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({
      success: true,
      message: `Permission restored for ${normalizedEmail}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
