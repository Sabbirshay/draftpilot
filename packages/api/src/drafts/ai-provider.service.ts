import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class AiProviderService {
  private openai: OpenAI;
  private model: string;
  private maxTokens: number;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.model = this.configService.get<string>('AI_MODEL') || 'gpt-4o-mini';
    this.maxTokens = parseInt(this.configService.get<string>('AI_MAX_TOKENS') || '300', 10);
    
    if (!apiKey) {
      console.warn('OPENAI_API_KEY is not set in environment.');
    }

    this.openai = new OpenAI({ apiKey: apiKey || 'dummy-key' });
  }

  /**
   * Generate text using configured AI provider
   */
  async generateText(prompt: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'system', content: prompt }],
        max_tokens: this.maxTokens,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error: any) {
      throw new InternalServerErrorException('AI Generation failed: ' + error.message);
    }
  }
}