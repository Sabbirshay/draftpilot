import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    const { data, error } = await this.supabase.getClient().auth.getUser(token);
    
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid token');
    }

    // Fetch user with team and onboarding state
    const { data: dbUser, error: dbError } = await this.supabase.getClient()
      .from('users')
      .select('*, teams(*)')
      .eq('id', data.user.id)
      .single();

    if (dbError || !dbUser) {
      throw new UnauthorizedException('User not found in database');
    }

    request.user = dbUser;
    return true;
  }
}