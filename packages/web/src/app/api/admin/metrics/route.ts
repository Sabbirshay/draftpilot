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
    const [teamsRes, usersRes, draftsRes, macrosRes, docsRes, recentDraftsRes] = await Promise.all([
      supabaseAdmin.from('teams').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('draft_history').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('macros').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('knowledge_documents').select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('draft_history')
        .select('id, team_id, thread_snippet, generated_draft, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    return NextResponse.json({
      totalTeams: teamsRes.count || 0,
      totalUsers: usersRes.count || 0,
      totalDrafts: draftsRes.count || 0,
      totalMacros: macrosRes.count || 0,
      totalDocs: docsRes.count || 0,
      recentDrafts: recentDraftsRes.data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
