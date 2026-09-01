import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { AiProviderService } from './ai-provider.service';
import { SupabaseService } from '../config/supabase.service';
import { BillingService } from '../billing/billing.service';
import { GenerateDraftDto } from './dto/generate-draft.dto';

function extractSenderName(text: string): string {
  if (!text) return 'there';
  const fromMatch = text.match(/(?:from|sender):\s*([^<\n\r]+?)(?:<|\n|$)/i);
  const lineAngleMatch = text.match(/(?:^|\n)([A-Za-z][A-Za-z0-9\s._-]{1,40}?)\s*<[^>\n\r]+>/);
  const signMatch = text.match(/(?:thanks|regards|cheers|best|sincerely|thank you),?\s*\n+([A-Z][a-z]+)/i);
  const greetMatch = text.match(/(?:hi|dear|hello)\s+([A-Z][a-z]+)/i);

  if (fromMatch && fromMatch[1].trim()) {
    const clean = fromMatch[1].replace(/["']/g, '').trim();
    if (clean && !clean.toLowerCase().includes('redacted')) {
      return clean.split(' ')[0];
    }
  }
  if (lineAngleMatch && lineAngleMatch[1].trim()) {
    const clean = lineAngleMatch[1].trim();
    if (clean && !clean.toLowerCase().startsWith('subject')) {
      return clean.split(' ')[0];
    }
  }
  if (signMatch && signMatch[1]) {
    return signMatch[1].trim();
  }
  if (greetMatch && greetMatch[1]) {
    const candidate = greetMatch[1].trim();
    const blacklist = ['there', 'team', 'support', 'all', 'everyone', 'sir', 'madam', 'can', 'could', 'would', 'please'];
    if (!blacklist.includes(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return 'there';
}

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

    // 2. Search macros or preserve custom guidance
    let macroContent = '';
    let macroId = null;
    let customGuidance = '';

    if (dto.macroHint && dto.macroHint.trim()) {
      const { data } = await this.supabase.getClient()
        .from('macros')
        .select('*')
        .eq('team_id', teamId)
        .ilike('name', `%${dto.macroHint.trim()}%`)
        .limit(1)
        .single();

      if (data) {
        macroContent = data.content;
        macroId = data.id;
      } else {
        customGuidance = dto.macroHint.trim();
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

    const customerName = extractSenderName(dto.threadContent || '');

    // 4. Build prompt (clean separation without duplicating system prompt in user message)
    const promptSections: string[] = [];
    if (macroContent) {
      promptSections.push(`### Relevant Support Macro:\n${macroContent}`);
    }
    if (customGuidance) {
      promptSections.push(`### Agent Guidance / Custom Instruction:\n${customGuidance}`);
    }
    if (kbSnippets.length > 0) {
      promptSections.push(`### Knowledge Base Documentation:\n${kbSnippets.join('\n---\n')}`);
    }
    promptSections.push(`Customer message:\n${dto.threadContent}`);
    promptSections.push(`Draft a clean, friendly reply:`);

    const prompt = promptSections.join('\n\n');

    // 5. Call AI provider
    const draft = await this.ai.generateText(prompt, customerName);

    // 6. Increment usage
    await this.billing.incrementUsage(teamId);

    // 7. Store in draft history
    await this.supabase.getClient()
      .from('draft_history')
      .insert({
        team_id: teamId,
        user_id: user.id,
        thread_snippet: dto.threadContent.substring(0, 100),
        generated_draft: draft,
        macro_used_id: macroId,
      });

    // 8. Return result
    return { draft, macroUsed: macroId };
  }
}