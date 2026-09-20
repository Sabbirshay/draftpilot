import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);

    if (authErr || !authData?.user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const user = authData.user;
    const { data: dbUser } = await supabaseAdmin
      .from('users')
      .select('team_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (!dbUser?.team_id) {
      return NextResponse.json({ error: 'Forbidden: No team associated with this account' }, { status: 403 });
    }

    if (dbUser.role !== 'owner' && dbUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Only workspace owners and admins can access billing portal' }, { status: 403 });
    }

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('stripe_customer_id')
      .eq('id', dbUser.team_id)
      .maybeSingle();

    const origin = req.nextUrl.origin || 'https://draftpilot-web.vercel.app';
    const stripeCustomerId = team?.stripe_customer_id;

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'No active Stripe customer found for this workspace. Please upgrade your plan first.' },
        { status: 400 }
      );
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

    if (stripeSecretKey && !stripeSecretKey.includes('dummy')) {
      const params = new URLSearchParams();
      params.append('customer', stripeCustomerId);
      params.append('return_url', `${origin}/dashboard/billing`);

      const stripeRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const stripeData = await stripeRes.json();
      if (!stripeRes.ok || !stripeData.url) {
        return NextResponse.json(
          { error: stripeData.error?.message || 'Stripe portal initialization failed' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, url: stripeData.url });
    }

    return NextResponse.json({
      success: true,
      url: `${origin}/dashboard/billing?mock_portal=true`,
      mock: true,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
