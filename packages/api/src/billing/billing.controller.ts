import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Headers,
  BadRequestException,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly configService: ConfigService
  ) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('usage')
  async getUsage(@CurrentUser() user: any) {
    return await this.billingService.getUsage(user.team_id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('checkout')
  async createCheckout(@CurrentUser() user: any) {
    return await this.billingService.createCheckoutSession(user.team_id, user.email);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('portal')
  async createPortal(@CurrentUser() user: any) {
    const team = user.teams;
    if (!team?.stripe_customer_id) {
      throw new BadRequestException('No billing account found');
    }
    return await this.billingService.createPortalSession(team.stripe_customer_id);
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
    @Body() body: any
  ) {
    const endpointSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    let event: any;

    if (endpointSecret) {
      if (!signature) {
        throw new BadRequestException('Missing stripe-signature header');
      }
      const rawPayload = req.rawBody || (typeof req.body === 'string' ? Buffer.from(req.body) : Buffer.from(JSON.stringify(body || {})));
      try {
        event = this.billingService.constructWebhookEvent(rawPayload, signature, endpointSecret);
      } catch (err: any) {
        throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new BadRequestException('STRIPE_WEBHOOK_SECRET is not configured in production');
      }
      event = body;
    }

    return await this.billingService.handleWebhook(event);
  }
}