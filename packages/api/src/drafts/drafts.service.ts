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

    // 3. Search knowledge base documentation chunks
    let kbSnippets: string[] = [];
    try {
      const { data: chunks } = await this.supabase.getClient()
        .from('document_chunks')
        .select('chunk_text')
        .eq('team_id', teamId)
        .limit(30);

      if (chunks && chunks.length > 0) {
        const lowerThread = dto.threadContent.toLowerCase();
        const keywords = lowerThread
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w: string) => w.length > 3);

        const scored = chunks.map((c: any) => {
          const lowerChunk = c.chunk_text.toLowerCase();
          let score = 0;
          for (const kw of keywords) {
            if (lowerChunk.includes(kw)) score += 1;
          }
          return { text: c.chunk_text, score };
        });

        kbSnippets = scored
          .filter((s: any) => s.score > 0)
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 3)
          .map((s: any) => s.text);
      }
    } catch {
      // Fallback
    }

    // 4. Build prompt
    const { data: settings } = await this.supabase.getClient()
      .from('platform_settings')
      .select('system_prompt')
      .limit(1)
      .single();
      
    const systemPrompt = settings?.system_prompt || 'You are a helpful customer support assistant. Draft a professional, friendly reply. Be concise.';

    const prompt = `${systemPrompt}

${macroContent ? `### Relevant Support Macro:\n${macroContent}\n\n` : ''}
${kbSnippets.length > 0 ? `### Knowledge Base Documentation:\n${kbSnippets.join('\n---\n')}\n\n` : ''}
Customer message:
${dto.threadContent}

Draft a clean, friendly reply:`;

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