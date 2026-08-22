import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { AiProviderService } from './ai-provider.service';
import { SupabaseService } from '../config/supabase.service';
import { BillingService } from '../billing/billing.service';
import { GenerateDraftDto } from './dto/generate-draft.dto';

@Injectable()
export class DraftsService {
  constructor(
    private ai: AiProviderService,
    private supabase: SupabaseService,
    private billing: BillingService
  ) {}

  async generateDraft(user: any, dto: GenerateDraftDto) {
    const teamId = user.team_id;
    
    // 1. Check limit
    const isWithinLimit = await this.billing.checkLimit(teamId);
    if (!isWithinLimit) {
      throw new HttpException('Usage limit exceeded. Please upgrade your plan.', HttpStatus.TOO_MANY_REQUESTS);
    }

    // 2. Search macros
    let macroContent = '';
    let macroId = null;

    if (dto.macroHint) {
      const { data } = await this.supabase.getClient()
        .from('macros')
        .select('*')
        .eq('team_id', teamId)
        .ilike('name', `%${dto.macroHint}%`)
        .limit(1)
        .single();

      if (data) {
        macroContent = data.content;
        macroId = data.id;
      }
    }

    // 3. Build prompt
    const prompt = `You are a helpful customer support assistant. Draft a professional, friendly reply. Be concise.
${macroContent ? `Use this reference material: ${macroContent}` : ''}
Customer message: ${dto.threadContent}

Draft a reply:`;

    // 4. Call AI provider
    const draft = await this.ai.generateText(prompt);

    // 5. Increment usage
    await this.billing.incrementUsage(teamId);

    // 6. Store in draft history
    await this.supabase.getClient()
      .from('draft_history')
      .insert({
        team_id: teamId,
        user_id: user.id,
        thread_snippet: dto.threadContent.substring(0, 100),
        generated_draft: draft,
        macro_used_id: macroId,
      });

    // 7. Return result
    return { draft, macroUsed: macroId };
  }
}