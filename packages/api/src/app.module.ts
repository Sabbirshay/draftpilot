import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { MacrosModule } from './macros/macros.module';
import { DraftsModule } from './drafts/drafts.module';
import { BillingModule } from './billing/billing.module';
import { SupabaseModule } from './config/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SupabaseModule,
    AuthModule,
    MacrosModule,
    DraftsModule,
    BillingModule,
  ],
})
export class AppModule {}