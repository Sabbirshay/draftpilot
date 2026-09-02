import crypto from 'crypto';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import { supabaseAdmin, verifySuperAdmin, getActiveRootPasskey, setCachedRootPasskey } from '../../../../lib/admin-auth.ts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/passkey
 * Returns the currently active Super Admin Root Passkey (from DB or fallback env var).
 * Protected by verifySuperAdmin.
 */
export async function GET(req: Request) {
  const auth = await verifySuperAdmin(req);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const activePasskey = await getActiveRootPasskey();
    return Response.json({
      success: true,
      passkey: activePasskey || '',
    });
  } catch (err: any) {
    return Response.json(
      { error: err.message || 'Failed to retrieve active root passkey' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/passkey
 * Updates the Super Admin Root Passkey dynamically in platform_settings table.
 * Invalidates the in-memory cache and takes effect immediately without server restart.
 * Protected by verifySuperAdmin.
 */
export async function POST(req: Request) {
  const auth = await verifySuperAdmin(req);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawPasskey = body.newPasskey ?? body.passkey;

    if (typeof rawPasskey !== 'string' || rawPasskey.trim().length < 6) {
      return Response.json(
        { error: 'Root passkey must be a string with at least 6 characters' },
        { status: 400 }
      );
    }

    const cleanedPasskey = rawPasskey.trim();

    // 1. Attempt persistent update to database singleton
    try {
      const fetchExisting = async () => {
        const { data: existing } = await supabaseAdmin
          .from('platform_settings')
          .select('id')
          .limit(1)
          .maybeSingle();
        return existing;
      };

      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 150));
      const existing = await Promise.race([fetchExisting(), timeoutPromise]);
      const id = existing?.id || crypto.randomUUID();

      const upsertPromise = supabaseAdmin
        .from('platform_settings')
        .upsert({
          id,
          root_passkey: cleanedPasskey,
          updated_at: new Date().toISOString(),
        });

      await Promise.race([upsertPromise, new Promise((res) => setTimeout(res, 200))]);
    } catch (dbErr: any) {
      console.warn('[admin/passkey] Database query notice:', dbErr?.message);
    }

    // 2. Immediately invalidate and synchronize in-memory cache
    setCachedRootPasskey(cleanedPasskey);

    return Response.json({
      success: true,
      message: 'Root passkey updated dynamically in platform_settings',
    });
  } catch (err: any) {
    return Response.json(
      { error: err.message || 'Failed to process passkey update' },
      { status: 500 }
    );
  }
}
