import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../config/supabase.service';
import { CreateMacroDto } from './dto/create-macro.dto';
import { UpdateMacroDto } from './dto/update-macro.dto';

@Injectable()
export class MacrosService {
  constructor(private supabase: SupabaseService) {}

  async findAll(teamId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('macros')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async findOne(teamId: string, id: string) {
    const { data, error } = await this.supabase.getClient()
      .from('macros')
      .select('*')
      .eq('team_id', teamId)
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Macro not found');
    return data;
  }

  async create(teamId: string, dto: CreateMacroDto) {
    const { data, error } = await this.supabase.getClient()
      .from('macros')
      .insert({
        team_id: teamId,
        name: dto.name,
        category: dto.category || 'General',
        content: dto.content,
        tags: dto.tags || [],
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async update(teamId: string, id: string, dto: UpdateMacroDto) {
    const { data, error } = await this.supabase.getClient()
      .from('macros')
      .update({
        ...dto,
        updated_at: new Date().toISOString(),
      })
      .eq('team_id', teamId)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException('Error updating macro or not found');
    return data;
  }

  async remove(teamId: string, id: string) {
    const { error } = await this.supabase.getClient()
      .from('macros')
      .delete()
      .eq('team_id', teamId)
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }
}