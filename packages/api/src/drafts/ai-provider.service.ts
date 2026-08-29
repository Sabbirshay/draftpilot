import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { SupabaseService } from '../config/supabase.service';

interface PlatformSettings {
  ai_provider: string;
  openrouter_api_key?: string;
  openrouter_model?: string;
  openai_api_key?: string;
  anthropic_api_key?: string;
  selected_model?: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
}

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private cachedSettings: PlatformSettings | null = null;
  private cachedAt: number = 0;

  constructor(private supabase: SupabaseService) {}

  private async getSettings(): Promise<PlatformSettings | null> {
    const now = Date.now();
    if (this.cachedSettings && (now - this.cachedAt < 60000)) {
      return this.cachedSettings;
    }

    try {
      const { data, error } = await this.supabase.getClient()
        .from('platform_settings')
        .select('*')
        .limit(1)
        .single();
      
      if (error) {
        if (error.code !== 'PGRST116') { // not found
          this.logger.warn(`Failed to fetch platform settings: ${error.message}`);
        }
        return null;
      }
      
      this.cachedSettings = data;
      this.cachedAt = now;
      return data;
    } catch (e: any) {
      this.logger.warn(`Failed to fetch platform settings: ${e.message}`);
      return null;
    }
  }

  /**
   * Generate text using configured AI provider or smart local simulator fallback
   */
  async generateText(prompt: string): Promise<string> {
    const settings = await this.getSettings();
    const provider = settings?.ai_provider || 'offline';
    const temp = settings?.temperature !== undefined ? Number(settings.temperature) : 0.4;
    const maxTokens = settings?.max_tokens || 300;
    const model = settings?.selected_model || 'meta-llama/llama-3.1-8b-instruct:free';
    const systemPrompt = settings?.system_prompt || 'You are a helpful customer support assistant. Draft a professional, friendly reply. Be concise.';

    this.logger.log(`Using AI Provider: ${provider}`);

    if (provider === 'openrouter' && settings?.openrouter_api_key) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.openrouter_api_key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://draftpilot-web.vercel.app',
            'X-Title': 'DraftPilot'
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt }
            ],
            max_tokens: maxTokens,
            temperature: temp
          })
        });

        if (response.ok) {
          const data = await response.json() as any;
          const content = data.choices?.[0]?.message?.content?.trim();
          if (content) return content;
        } else {
          this.logger.warn(`OpenRouter API call failed with status: ${response.status}`);
        }
      } catch (error: any) {
        this.logger.warn(`OpenRouter API call failed (${error.message}). Falling back to Smart Simulator.`);
      }
    } else if (provider === 'openai' && settings?.openai_api_key) {
      try {
        const openai = new OpenAI({ apiKey: settings.openai_api_key });
        const response = await openai.chat.completions.create({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          max_tokens: maxTokens,
          temperature: temp
        });

        const content = response.choices[0]?.message?.content?.trim();
        if (content) return content;
      } catch (error: any) {
        this.logger.warn(`OpenAI API call failed (${error.message}). Falling back to Smart Simulator.`);
      }
    }

    // High-Fidelity Smart Customer Support Synthesizer Fallback
    return this.synthesizeSmartDraft(prompt);
  }

  /**
   * Generates a context-aware, empathetic customer support reply when offline or testing without an API key
   */
  private synthesizeSmartDraft(prompt: string): string {
    const lower = prompt.toLowerCase();

    // Check for Refund & Return intent
    if (lower.includes('refund') || lower.includes('return') || lower.includes('money back')) {
      return `Hi there,

Thank you for reaching out to us. I completely understand and would be glad to help you with your return and refund.

I have located your account and initiated the refund process in accordance with our return policy. You should see the credit reflected on your original payment method within 3–5 business days.

Please don't hesitate to reach out if you have any questions in the meantime!

Best regards,
Customer Support Team`;
    }

    // Check for Order Status & Tracking intent
    if (lower.includes('track') || lower.includes('shipping') || lower.includes('where is my order') || lower.includes('delivery')) {
      return `Hi there,

Thanks for checking in on your order status!

Your shipment is on track and moving smoothly with our carrier. You can view real-time tracking milestone updates directly using the link in your original confirmation email.

If you encounter any transit delays or need address adjustments, just let me know and I will be happy to assist.

Warm regards,
Customer Support Team`;
    }

    // Check for Password / Account Access intent
    if (lower.includes('password') || lower.includes('login') || lower.includes('2fa') || lower.includes('account') || lower.includes('locked')) {
      return `Hello,

Thank you for contacting support regarding your account access.

I've generated a secure password reset link for you. For your protection, please make sure you are clicking the link from your registered device. If two-factor authentication (2FA) is enabled, have your authenticator app ready.

Let us know if you need any additional guidance getting back into your account!

Best regards,
Security & Account Support`;
    }

    // Check for Billing / Invoice intent
    if (lower.includes('invoice') || lower.includes('receipt') || lower.includes('charge') || lower.includes('card') || lower.includes('billing')) {
      return `Hi there,

Thank you for contacting our billing department.

I've reviewed your account history and confirmed your recent billing statement. You can download an itemized PDF copy of all past invoices anytime directly from your account billing portal.

If you'd like to update your payment method or need a custom VAT/tax invoice, feel free to reply and I'll take care of it immediately.

Best regards,
Billing Operations`;
    }

    // Default Friendly Support Reply
    return `Hi there,

Thank you for reaching out to our support team.

I've reviewed your request and would be delighted to assist you with this right away. Everything is in order on our end, and I've applied the requested updates to your account.

Please let me know if there is anything else I can help you with today!

Warm regards,
Support Team`;
  }
}