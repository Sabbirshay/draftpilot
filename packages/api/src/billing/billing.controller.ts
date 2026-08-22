import { Controller, Get, Post, Body, UseGuards, Req, Headers, BadRequestException } from '@nestjs/common';
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
  async handleWebhook(@Body() body: any) {
    return await this.billingService.handleWebhook(body);
  }
}