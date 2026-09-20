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
      return NextResponse.json({ error: 'Forbidden: Only workspace owners and admins can manage billing' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const cadence = body.cadence === 'yearly' ? 'yearly' : 'monthly';
    const tier = body.tier === 'enterprise' ? 'enterprise' : 'team';
    const seats = Math.max(1, Math.floor(Number(body.seats) || 1));

    // Unit amounts in cents:
    // Team: $19/seat/mo or $180/seat/year ($15/mo)
    // Enterprise: $99/mo or $948/year ($79/mo)
    const unitAmount =
      tier === 'enterprise'
        ? cadence === 'yearly' ? 94800 : 9900
        : cadence === 'yearly' ? 18000 : 1900;

    const origin = req.nextUrl.origin || 'https://draftpilot-web.vercel.app';
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

    if (stripeSecretKey && !stripeSecretKey.includes('dummy')) {
      const params = new URLSearchParams();
      params.append('payment_method_types[0]', 'card');
      params.append('mode', 'subscription');
      if (user.email) params.append('customer_email', user.email);
      params.append('client_reference_id', dbUser.team_id);
      params.append('success_url', `${origin}/dashboard/billing?success=true`);
      params.append('cancel_url', `${origin}/dashboard/billing?canceled=true`);
      params.append('metadata[teamId]', dbUser.team_id);
      params.append('metadata[cadence]', cadence);
      params.append('metadata[seats]', String(seats));
      params.append('metadata[tier]', tier);

      params.append('line_items[0][price_data][currency]', 'usd');
      params.append('line_items[0][price_data][unit_amount]', String(unitAmount));
      params.append(
        'line_items[0][price_data][product_data][name]',
        `DraftPilot ${tier === 'enterprise' ? 'Enterprise' : 'Team'} Plan`
      );
      params.append(
        'line_items[0][price_data][product_data][description]',
        `${tier === 'enterprise' ? 'Enterprise' : 'Team'} Plan (${cadence === 'yearly' ? 'Annual - 20% savings' : 'Monthly'})`
      );
      params.append('line_items[0][price_data][recurring][interval]', cadence === 'yearly' ? 'year' : 'month');
      params.append('line_items[0][quantity]', String(tier === 'enterprise' ? 1 : seats));

      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
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
          { error: stripeData.error?.message || 'Stripe checkout initialization failed' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, url: stripeData.url });
    }

    // Fallback in environments without live Stripe credentials
    return NextResponse.json({
      success: true,
      url: `${origin}/dashboard/billing?mock_checkout=true&tier=${tier}&seats=${seats}&cadence=${cadence}`,
      mock: true,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
