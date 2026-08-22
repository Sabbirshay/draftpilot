import { Controller, Post, Body, Get, Patch, UseGuards, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './auth.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return await this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return await this.authService.login(dto);
  }

  /**
   * Provision endpoint — called after OAuth callback.
   * Verifies the Supabase JWT itself (no AuthGuard needed since user may not exist in DB yet).
   */
  @Post('provision')
  async provision(@Headers('authorization') authHeader: string) {
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }
    const token = authHeader.replace('Bearer ', '');
    return await this.authService.provision(token);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: any) {
    return {
      user,
      team: user.teams,
    };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('onboarding')
  async getOnboarding(@CurrentUser() user: any) {
    return await this.authService.getOnboardingState(user.team_id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch('onboarding')
  async updateOnboarding(
    @CurrentUser() user: any,
    @Body() body: Partial<{
      gmail_connected: boolean;
      first_macro_added: boolean;
      extension_installed: boolean;
      viewed_demo: boolean;
    }>,
  ) {
    return await this.authService.updateOnboardingState(user.team_id, body);
  }
}