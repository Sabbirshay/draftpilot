import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private supabase: SupabaseService) {}

  /**
   * Register a new user and create their team
   */
  async register(dto: RegisterDto) {
    const client = this.supabase.getClient();
    
    // Create user in Auth
    const { data: authData, error: authError } = await client.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
    });

    if (authError) throw new BadRequestException(authError.message);

    // Create team
    const { data: team, error: teamError } = await client
      .from('teams')
      .insert({ name: dto.teamName })
      .select()
      .single();

    if (teamError) throw new BadRequestException('Error creating team');

    // Create user record
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

    // Generate token for immediate login
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

  /**
   * Login existing user
   */
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