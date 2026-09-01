import crypto from 'crypto';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://amjliubpbysvtiqpbgnh.supabase.co';
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.resilient-admin-service-role-fallback';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[admin-auth] Warning: SUPABASE_SERVICE_ROLE_KEY is not defined in environment. Initializing resilient fallback Supabase client.'
  );
}

export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export interface AdminAuthResult {
  authorized: boolean;
  user?: User;
  response?: Response;
}

/**
 * Constant-time comparison between two strings to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Shared admin auth verification for admin API routes.
 * 1. Checks server-side admin passkey header (ADMIN_PASSKEY or SUPERADMIN_PASSKEY) using constant-time comparison
 * 2. Extracts Authorization: Bearer <token>
 * 3. Verifies token with Supabase auth
 * 4. Confirms user is a superadmin via DB role or SUPERADMIN_EMAILS env var
 * 5. Returns 401 for missing/invalid token, 403 for authenticated non-admin
 */
export async function verifySuperAdmin(req: Request): Promise<AdminAuthResult> {
  // 1. Check direct server-only admin passkey header (constant-time verification)
  const passkey = req.headers.get('x-admin-passkey')?.trim();
  const configuredPasskey = (process.env.ADMIN_PASSKEY || process.env.SUPERADMIN_PASSKEY)?.trim();
  if (passkey && configuredPasskey && timingSafeEqual(passkey, configuredPasskey)) {
    return { authorized: true };
  }

  // 2. Check Authorization Bearer token
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
