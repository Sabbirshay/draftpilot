import { createClient, type User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://amjliubpbysvtiqpbgnh.supabase.co';
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtamxpdWJwYnlzdnRpcXBiZ25oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzM4ODI0MCwiZXhwIjoyMTAyOTY0MjQwfQ.6uJXakWY4X_azHLFrJpuRhkVoej4yVyDiGWGCjIy9sw';

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export interface AdminAuthResult {
  authorized: boolean;
  user?: User;
  response?: Response;
}

/**
 * Shared admin auth verification for admin API routes.
 * 1. Extracts Authorization: Bearer <token>
 * 2. Verifies token with Supabase auth
 * 3. Confirms user is a superadmin via DB role or SUPERADMIN_EMAILS env var
 * 4. Returns 401 for missing/invalid token, 403 for authenticated non-admin
 */
export async function verifySuperAdmin(req: Request): Promise<AdminAuthResult> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      response: Response.json(
        { error: 'Unauthorized: Missing or invalid Authorization header' },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return {
      authorized: false,
      response: Response.json(
        { error: 'Unauthorized: Token is missing' },
        { status: 401 }
      ),
    };
  }

  const { data: authData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !authData?.user) {
    return {
      authorized: false,
      response: Response.json(
        { error: 'Unauthorized: Invalid or expired token' },
        { status: 401 }
      ),
    };
  }

  const user = authData.user;
  const userEmail = (user.email || '').toLowerCase().trim();
  const superadminEmails = (process.env.SUPERADMIN_EMAILS || 'mdronykhan4633@gmail.com,mdronykhan4632@gmail.com,admin@draftpilot.app,admin@draftpilot.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  let isSuperadmin = superadminEmails.includes(userEmail);
  if (!isSuperadmin) {
    const { data: dbUser } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (dbUser?.role === 'superadmin' || dbUser?.role === 'admin') {
      isSuperadmin = true;
    }
  }

  if (!isSuperadmin) {
    return {
      authorized: false,
      response: Response.json(
        { error: 'Forbidden: Superadmin privileges required' },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user };
}
