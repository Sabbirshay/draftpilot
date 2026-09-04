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

      let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

      if (configuredPriceId) {
        lineItems = [
          {
            price: configuredPriceId,
            quantity: Math.max(1, seats),
          },
        ];
      } else {
        // Dynamic price data based on tier and cadence
        const unitAmount =
          tier === 'enterprise'
            ? cadence === 'yearly' ? 7900 : 9900 // $79/mo or $99/mo in cents
            : cadence === 'yearly' ? 1500 : 1900; // $15/seat/mo or $19/seat/mo in cents

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
            quantity: tier === 'enterprise' ? 1 : Math.max(1, seats),
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
          seats: String(seats),
          tier,
        },
        line_items: lineItems,
        mode: 'subscription',
        success_url: `${this.configService.get('FRONTEND_URL')}/settings/billing?success=true`,
        cancel_url: `${this.configService.get('FRONTEND_URL')}/settings/billing?canceled=true`,
      });
      return { url: session.url };
    } catch (error: any) {
      throw new InternalServerErrorException('Stripe checkout failed: ' + error.message);
    }
  }

  async createPortalSession(stripeCustomerId: string) {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${this.configService.get('FRONTEND_URL')}/settings/billing`,
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
          if (teamId) {
            await client.from('teams').update({
              plan: 'team',
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              monthly_draft_limit: 1000,
            }).eq('id', teamId);
          }
          break;
        }
        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          if (sub.status !== 'active') {
            await client.from('teams').update({
              plan: 'free',
              monthly_draft_limit: 50,
            }).eq('stripe_subscription_id', sub.id);
          } else {
            await client.from('teams').update({
              plan: 'team',
              monthly_draft_limit: 1000,
            }).eq('stripe_subscription_id', sub.id);
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          await client.from('teams').update({
            plan: 'free',
            monthly_draft_limit: 50,
          }).eq('stripe_subscription_id', sub.id);
          break;
        }
      }
    } catch (err: any) {
      throw new BadRequestException('Webhook handling failed: ' + err.message);
    }
  }
}