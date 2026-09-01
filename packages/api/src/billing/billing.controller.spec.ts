import { Test, TestingModule } from '@nestjs/testing';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../config/supabase.service';
import { BadRequestException } from '@nestjs/common';

describe('BillingController Webhook Security', () => {
  let controller: BillingController;
  let billingService: Partial<BillingService>;
  let configService: Partial<ConfigService>;
  let supabaseService: Partial<SupabaseService>;

  beforeEach(async () => {
    billingService = {
      handleWebhook: jest.fn().mockResolvedValue({ received: true }),
      constructWebhookEvent: jest.fn().mockReturnValue({ type: 'checkout.session.completed', data: {} } as any),
    };
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test_secret_12345';
        return null;
      }),
    };
    supabaseService = {
      getClient: jest.fn().mockReturnValue({
        auth: { getUser: jest.fn() },
        from: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        { provide: BillingService, useValue: billingService },
        { provide: ConfigService, useValue: configService },
        { provide: SupabaseService, useValue: supabaseService },
      ],
    }).compile();

    controller = module.get<BillingController>(BillingController);
  });

  it('verifies valid stripe webhook signatures using rawBody and secret', async () => {
    const rawBody = Buffer.from('{"type":"checkout.session.completed"}');
    const req: any = { rawBody };
    const signature = 't=12345,v1=signature_hash_valid';

    const result = await controller.handleWebhook(req, signature, {});
    expect(billingService.constructWebhookEvent).toHaveBeenCalledWith(rawBody, signature, 'whsec_test_secret_12345');
    expect(billingService.handleWebhook).toHaveBeenCalled();
    expect(result).toEqual({ received: true });
  });

  it('rejects webhook requests when stripe-signature header is missing', async () => {
    const req: any = { rawBody: Buffer.from('{}') };
    await expect(controller.handleWebhook(req, '', {})).rejects.toThrow(BadRequestException);
  });

  it('rejects webhook requests when signature construction fails', async () => {
    (billingService.constructWebhookEvent as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid signature hash');
    });

    const req: any = { rawBody: Buffer.from('{}') };
    await expect(controller.handleWebhook(req, 'bad_sig', {})).rejects.toThrow(BadRequestException);
  });
});
