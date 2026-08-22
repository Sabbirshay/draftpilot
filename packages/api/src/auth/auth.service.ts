import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private supabase: SupabaseService) {}

  /**
   * Provision a user after OAuth or signup.
   * If the user doesn't exist in our DB yet, create user + team + team_members + onboarding_state.
   * If they do exist, return their existing data.
   */
  async provision(token: string) {
    const client = this.supabase.getClient();

    // Verify the JWT and get the Supabase auth user
    const { data: authData, error: authError } = await client.auth.getUser(token);
    if (authError || !authData.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const authUser = authData.user;
    const email = authUser.email || '';
    const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || email.split('@')[0];
    const avatarUrl = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null;

    // Check if user already exists in our DB
    const { data: existingUser } = await client
      .from('users')
      .select('*, teams(*)')
      .eq('id', authUser.id)
      .single();

    if (existingUser) {
      // Returning user — fetch onboarding state
      const { data: onboardingState } = await client
        .from('onboarding_state')
        .select('*')
        .eq('team_id', existingUser.team_id)
        .single();

      return {
        user: existingUser,
        team: existingUser.teams,
        onboardingState: onboardingState || null,
        isFirstLogin: false,
      };
    }

    // --- First-time user: auto-provision everything ---

    // 1. Create team
    const teamName = `${fullName}'s Team`;
    const { data: team, error: teamError } = await client
      .from('teams')
      .insert({ name: teamName })
      .select()
      .single();

    if (teamError) throw new BadRequestException(`Error creating team: ${teamError.message}`);

    // 2. Create user record
    const { data: user, error: userError } = await client
      .from('users')
      .insert({
        id: authUser.id,
        team_id: team.id,
        email,
        full_name: fullName,
        avatar_url: avatarUrl,
        role: 'owner',
      })
      .select()
      .single();

    if (userError) throw new BadRequestException(`Error creating user: ${userError.message}`);

    // 3. Create team_members junction
    await client.from('team_members').insert({
      team_id: team.id,
      user_id: user.id,
      role: 'owner',
    });

    // 4. Create onboarding_state
    const { data: onboardingState } = await client
      .from('onboarding_state')
      .insert({ team_id: team.id })
      .select()
      .single();

    return {
      user: { ...user, teams: team },
      team,
      onboardingState: onboardingState || { gmail_connected: false, first_macro_added: false, extension_installed: false, viewed_demo: false },
      isFirstLogin: true,
    };
  }

  /**
   * Get onboarding state for a team
   */
  async getOnboardingState(teamId: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('onboarding_state')
      .select('*')
      .eq('team_id', teamId)
      .single();

    if (error) throw new BadRequestException('Onboarding state not found');
    return data;
  }

  /**
   * Update onboarding state flags
   */
  async updateOnboardingState(teamId: string, updates: Partial<{
    gmail_connected: boolean;
    first_macro_added: boolean;
    extension_installed: boolean;
    viewed_demo: boolean;
  }>) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('onboarding_state')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('team_id', teamId)
      .select()
      .single();

    if (error) throw new BadRequestException('Error updating onboarding state');
    return data;
  }

  // --- Keep existing register() and login() methods below ---
  
  async register(dto: RegisterDto) {
    const client = this.supabase.getClient();
    
    const { data: authData, error: authError } = await client.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
    });

    if (authError) throw new BadRequestException(authError.message);

    const { data: team, error: teamError } = await client
      .from('teams')
      .insert({ name: dto.teamName })
      .select()
      .single();

    if (teamError) throw new BadRequestException('Error creating team');

    const { data: user, error: userError } = await client
      .from('users')
      .insert({
        id: authData.user.id,
        team_id: team.id,
        email: dto.email,
        role: 'owner',
      })
      .select()
      .single();

    if (userError) throw new BadRequestException('Error creating user record');

    // Also create team_members and onboarding_state
    await client.from('team_members').insert({ team_id: team.id, user_id: user.id, role: 'owner' });
    await client.from('onboarding_state').insert({ team_id: team.id });

    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (signInError) throw new BadRequestException('Error auto-login after register');

    return {
      user,
      team,
      accessToken: signInData.session?.access_token,
    };
  }

  async login(dto: LoginDto) {
    const client = this.supabase.getClient();
    
    const { data, error } = await client.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { data: user, error: userError } = await client
      .from('users')
      .select('*, teams(*)')
      .eq('id', data.user.id)
      .single();

    if (userError || !user) {
      throw new UnauthorizedException('User record not found');
    }

    return {
      user,
      team: user.teams,
      accessToken: data.session?.access_token,
    };
  }
}