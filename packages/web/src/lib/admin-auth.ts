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
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// In-memory cache for dynamic root passkey (30-second TTL)
let cachedDbPasskey: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 30000;

/**
 * Manually update or invalidate the in-memory root passkey cache.
 */
export function setCachedRootPasskey(passkey: string | null): void {
  cachedDbPasskey = passkey ? passkey.trim() : null;
  cacheTimestamp = Date.now();
}

/**
 * Clear the in-memory root passkey cache.
 */
export function clearCachedRootPasskey(): void {
  cachedDbPasskey = null;
  cacheTimestamp = 0;
}

/**
 * Resolves the active root passkey dynamically:
 * 1. Checks in-memory cache for dynamic DB passkey (30s TTL).
 * 2. If expired or empty, queries database singleton in `platform_settings.root_passkey`.
 * 3. Falls back to environment variables (`ADMIN_PASSKEY` or `SUPERADMIN_PASSKEY`).
 */
export async function getActiveRootPasskey(): Promise<string | null> {
  const now = Date.now();
  if (cachedDbPasskey !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedDbPasskey;
  }

  try {
    const fetchDbPasskey = async () => {
      const { data, error } = await supabaseAdmin
        .from('platform_settings')
        .select('root_passkey')
        .limit(1)
        .maybeSingle();

      if (!error && data?.root_passkey && typeof data.root_passkey === 'string' && data.root_passkey.trim()) {
        return data.root_passkey.trim();
      }
      return null;
    };

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 150));
    const dbPasskey = await Promise.race([fetchDbPasskey(), timeoutPromise]);

    if (dbPasskey) {
      cachedDbPasskey = dbPasskey;
      cacheTimestamp = now;
      return dbPasskey;
    }
  } catch {
    // Fall through to environment variables on database query error
  }

  const envPasskey = (process.env.ADMIN_PASSKEY || process.env.SUPERADMIN_PASSKEY)?.trim() || null;
  return envPasskey;
}

/**
 * Shared admin auth verification for admin API routes.
 * 1. Checks server-side admin passkey header (dynamic platform_settings.root_passkey or env vars) using constant-time comparison
 * 2. Extracts Authorization: Bearer <token>
 * 3. Verifies token with Supabase auth
 * 4. Confirms user is a superadmin via DB role or SUPERADMIN_EMAILS env var
 * 5. Returns 401 for missing/invalid token, 403 for authenticated non-admin
 */
export async function verifySuperAdmin(req: Request): Promise<AdminAuthResult> {
  // 1. Check direct server-only admin passkey header (constant-time verification)
  const passkey = req.headers.get('x-admin-passkey')?.trim();
  if (passkey) {
    const configuredPasskey = await getActiveRootPasskey();
    if (configuredPasskey && timingSafeEqual(passkey, configuredPasskey)) {
      return { authorized: true };
    }
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
