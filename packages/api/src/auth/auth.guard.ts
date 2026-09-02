import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
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

    const email = (data.user.email || '').trim().toLowerCase();
    if (email) {
      const { data: bannedEntry } = await this.supabase.getClient()
        .from('banned_emails')
        .select('id, reason')
        .ilike('email', email)
        .maybeSingle();

      if (bannedEntry) {
        throw new ForbiddenException('Account deactivated. Please contact support.');
      }
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