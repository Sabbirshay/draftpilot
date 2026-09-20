import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../config/supabase.service';
import Stripe from 'stripe';

@Injectable()
export class BillingService {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private supabase: SupabaseService
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY') || 'dummy-key';
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16' as any,
    });
  }

  private getCurrentMonthString(): string {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  }

  async getUsage(teamId: string) {
    const month = this.getCurrentMonthString();
    
    const { data: team } = await this.supabase.getClient()
      .from('teams')
      .select('plan, monthly_draft_limit')
      .eq('id', teamId)
      .single();

    const { data: usage } = await this.supabase.getClient()
      .from('usage')
      .select('draft_count')
      .eq('team_id', teamId)
      .eq('month', month)
      .single();

    return {
      draftsUsed: usage?.draft_count || 0,
      draftsLimit: team?.monthly_draft_limit || 50,
      plan: team?.plan || 'free',
      currentMonth: month,
    };
  }

  async checkLimit(teamId: string): Promise<boolean> {
    const usage = await this.getUsage(teamId);
    return usage.draftsUsed < usage.draftsLimit;
  }

  async incrementUsage(teamId: string) {
    const month = this.getCurrentMonthString();
    const client = this.supabase.getClient();

    // Check if usage row exists
    const { data: existing } = await client
      .from('usage')
      .select('id, draft_count')
      .eq('team_id', teamId)
      .eq('month', month)
      .single();

    if (existing) {
      await client.from('usage').update({ draft_count: existing.draft_count + 1 }).eq('id', existing.id);
    } else {
      await client.from('usage').insert({ team_id: teamId, month, draft_count: 1 });
    }
  }

  async createCheckoutSession(
    teamId: string,
    userEmail: string,
    cadence: 'monthly' | 'yearly' = 'monthly',
    seats: number = 1,
    tier: string = 'team'
  ) {
    try {
      const configuredPriceId = this.configService.get('STRIPE_PRICE_ID');
      const validSeats = Math.max(1, Math.floor(Number(seats) || 1));
      const frontendUrl = (this.configService.get('FRONTEND_URL') || 'http://localhost:3000').replace(/\/$/, '');

      let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

      if (configuredPriceId) {
        lineItems = [
          {
            price: configuredPriceId,
            quantity: tier === 'enterprise' ? 1 : validSeats,
          },
        ];
      } else {
        // Dynamic price data based on tier and cadence
        // Team: $19/seat/mo ($1900 cents) or $15/seat/mo billed annually ($18000 cents/seat/year)
        // Enterprise: $99/mo ($9900 cents) or $79/mo billed annually ($94800 cents/year)
        const unitAmount =
          tier === 'enterprise'
            ? cadence === 'yearly' ? 94800 : 9900
            : cadence === 'yearly' ? 18000 : 1900;

        lineItems = [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `DraftPilot ${tier === 'enterprise' ? 'Enterprise Dedicated' : 'Team Co-Pilot'} Plan`,
                description: `${tier === 'enterprise' ? 'Enterprise' : 'Team'} plan with AI copilot capabilities (${cadence === 'yearly' ? 'Annual - 20% discount' : 'Monthly'})`,
              },
              unit_amount: unitAmount,
              recurring: {
                interval: cadence === 'yearly' ? 'year' : 'month',
              },
            },
            quantity: tier === 'enterprise' ? 1 : validSeats,
          },
        ];
      }

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer_email: userEmail,
        client_reference_id: teamId,
        metadata: {
          teamId,
          cadence,
          seats: String(validSeats),
          tier,
        },
        line_items: lineItems,
        mode: 'subscription',
        success_url: `${frontendUrl}/dashboard/billing?success=true`,
        cancel_url: `${frontendUrl}/dashboard/billing?canceled=true`,
      });
      return { url: session.url };
    } catch (error: any) {
      throw new InternalServerErrorException('Stripe checkout failed: ' + error.message);
    }
  }

  async createPortalSession(stripeCustomerId: string) {
    try {
      const frontendUrl = (this.configService.get('FRONTEND_URL') || 'http://localhost:3000').replace(/\/$/, '');
      const session = await this.stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${frontendUrl}/dashboard/billing`,
      });
      return { url: session.url };
    } catch (error: any) {
      throw new InternalServerErrorException('Stripe portal failed: ' + error.message);
    }
  }

  constructWebhookEvent(rawBody: string | Buffer, signature: string, secret: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  async handleWebhook(event: Stripe.Event) {
    const client = this.supabase.getClient();
    
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const teamId = session.client_reference_id;
          const tier = session.metadata?.tier || 'team';
          const seats = Math.max(1, Math.floor(Number(session.metadata?.seats) || 1));
          const monthlyLimit = tier === 'enterprise' ? 5000 : seats * 1000;
          if (teamId) {
            const { error } = await client.from('teams').update({
              plan: tier,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              monthly_draft_limit: monthlyLimit,
              billing_cadence: session.metadata?.cadence || 'monthly',
            }).eq('id', teamId);
            if (error) throw error;
          }
          break;
        }
        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          if (sub.status !== 'active') {
            const { error } = await client.from('teams').update({
              plan: 'free',
              monthly_draft_limit: 50,
            }).eq('stripe_subscription_id', sub.id);
            if (error) throw error;
          } else {
            const tier = sub.metadata?.tier || 'team';
            const seats = Math.max(1, Math.floor(Number(sub.metadata?.seats) || sub.items?.data?.[0]?.quantity || 1));
            const monthlyLimit = tier === 'enterprise' ? 5000 : seats * 1000;
            const { error } = await client.from('teams').update({
              plan: tier,
              monthly_draft_limit: monthlyLimit,
            }).eq('stripe_subscription_id', sub.id);
            if (error) throw error;
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const { error } = await client.from('teams').update({
            plan: 'free',
            monthly_draft_limit: 50,
          }).eq('stripe_subscription_id', sub.id);
          if (error) throw error;
          break;
        }
      }
    } catch (err: any) {
      throw new BadRequestException('Webhook handling failed: ' + err.message);
    }
  }
}