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
  async generateText(prompt: string, customerName = 'there'): Promise<string> {
    const settings = await this.getSettings();
    const provider = settings?.ai_provider || 'offline';
    const temp = settings?.temperature !== undefined ? Number(settings.temperature) : 0.4;
    const maxTokens = settings?.max_tokens || 300;
    const model = settings?.selected_model || 'meta-llama/llama-3.1-8b-instruct:free';
    const baseSystemPrompt =
      settings?.system_prompt?.trim() ||
      'You are a helpful customer support assistant. Draft a professional, friendly reply. Be concise.';

    const systemPrompt = `${baseSystemPrompt}

CRITICAL INSTRUCTIONS:
1. Output ONLY the raw final email reply text ready to send.
2. Absolutely DO NOT output any thinking process, analysis, reasoning steps, or markdown bullets.
3. Start directly with "Hi ${customerName}," and end with "Best regards,\\nCustomer Support Team".
4. Do NOT wrap in markdown code blocks.`;

    this.logger.log(`Using AI Provider: ${provider}`);

    if (provider === 'openrouter' && settings?.openrouter_api_key) {
      const activeModel = settings?.selected_model || settings?.openrouter_model || 'google/gemma-4-26b-a4b-it:free';
      const fallbackModel = activeModel.includes('26b') ? 'google/gemma-4-31b-it:free' : 'google/gemma-4-26b-a4b-it:free';

      try {
        // 1. Try Primary Model (with 8s timeout)
        let response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.openrouter_api_key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://draftpilot-web.vercel.app',
            'X-Title': 'DraftPilot'
          },
          body: JSON.stringify({
            model: activeModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt }
            ],
            max_tokens: maxTokens,
            temperature: temp,
            include_reasoning: false,
            reasoning: { max_tokens: 0 }
          }),
          signal: AbortSignal.timeout(8000)
        });

        let data = await response.json().catch(() => null) as any;

        // 2. If Primary fails, attempt Automatic Fallback Model (with 8s timeout)
        if ((!response.ok || !data?.choices?.[0]) && fallbackModel !== activeModel) {
          this.logger.warn(`Primary model ${activeModel} failed (${response.status}). Attempting auto-fallback to ${fallbackModel}...`);
          const fallbackRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${settings.openrouter_api_key}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://draftpilot-web.vercel.app',
              'X-Title': 'DraftPilot'
            },
            body: JSON.stringify({
              model: fallbackModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
              ],
              max_tokens: maxTokens,
              temperature: temp,
              include_reasoning: false,
              reasoning: { max_tokens: 0 }
            }),
            signal: AbortSignal.timeout(8000)
          });

          const fallbackData = await fallbackRes.json().catch(() => null) as any;
          if (fallbackRes.ok && fallbackData?.choices?.[0]) {
            response = fallbackRes;
            data = fallbackData;
          }
        }

        if (data?.choices?.[0]?.message?.content) {
          const content = data.choices[0].message.content.trim();
          const cleaned = this.cleanDraft(content, customerName);
          if (cleaned.length > 5) return cleaned;
        } else {
          this.logger.warn(`OpenRouter generation failed on all models. Falling back to Smart Simulator.`);
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
        if (content) {
          const cleaned = this.cleanDraft(content, customerName);
          if (cleaned.length > 5) return cleaned;
        }
      } catch (error: any) {
        this.logger.warn(`OpenAI API call failed (${error.message}). Falling back to Smart Simulator.`);
      }
    }

    // High-Fidelity Smart Customer Support Synthesizer Fallback
    return this.synthesizeSmartDraft(prompt, customerName);
  }

  private cleanDraft(rawText: string, customerName = 'there'): string {
    if (!rawText) return '';
    let text = rawText.trim();

    // 1. Remove XML/HTML style <think>...</think> tags (e.g. DeepSeek / Nemotron / Qwen reasoning)
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // 2. Strip Reasoning Chains & Thinking Process Headers (DeepSeek R1 / Gemma 4 / Qwen)
    if (
      /^(?:Here(?:'s| is) (?:a |the )?(?:thinking process|thought process|reasoning):?|Thinking Process:?|Thought Process:?|Reasoning:?|\d+\.\s*\*\*Analyze User Input)/i.test(
        text
      )
    ) {
      const emailMatch = text.match(
        /(?:^|\n\s*\n|\n)(?:> )?(Hi\b|Hello\b|Dear\b|Thank you\b|Thanks\b|Good morning\b|Good afternoon\b|Greetings\b)([\s\S]+)$/i
      );
      if (emailMatch) {
        text = (emailMatch[1] + emailMatch[2]).trim();
      } else {
        const splitMatch = text.split(/\*\*(?:Final Response|Reply|Draft|Email|Response):\*\*/i);
        if (splitMatch.length > 1 && splitMatch[1].trim().length > 15) {
          text = splitMatch[1].trim();
        } else {
          return '';
        }
      }
    }

    // 3. Double-check if the resulting text is still just a thinking process fragment
    if (
      /^(?:Here(?:'s| is) (?:a |the )?thinking process|\d+\.\s*\*\*Analyze User Input)/i.test(text) ||
      text.startsWith('1.  **Analyze') ||
      text.startsWith('1. **Analyze')
    ) {
      return '';
    }

    // 4. Robust Code Fence & Wrapper Removal (handles preambles and postscripts)
    const codeBlockMatch = text.match(/```(?:markdown|text|email)?\s*\n([\s\S]*?)\n```/i);
    if (codeBlockMatch && codeBlockMatch[1].trim().length > 10) {
      text = codeBlockMatch[1].trim();
    } else {
      text = text.replace(/^```(?:markdown|text|email)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
    }

    // 5. Remove Meta Headers & Label Lines (handles multiple stacked headers)
    let prevText = '';
    while (prevText !== text) {
      prevText = text;
      text = text
        .replace(/^(?:Here is (?:the|a) (?:draft|reply|response|suggested reply):?|Draft reply:?|Draft:?|Response:?|Subject:[^\n]*|Email:?|Suggested Reply:?)\s*\n+/i, '')
        .trim();
    }

    // 6. Template Variable Normalization
    text = text
      .replace(/{{name}}/gi, customerName)
      .replace(/{{customer_name}}/gi, customerName)
      .replace(/\[Customer(?:\s*Name)?\]/gi, customerName)
      .replace(/\[Name\]/gi, customerName)
      .replace(/\[Client(?:\s*Name)?\]/gi, customerName);

    // 7. Sign-off Placeholder Scrubbing
    const defaultSignoff = 'Customer Support Team';
    text = text
      .replace(/\[Your Name\]/gi, defaultSignoff)
      .replace(/\[Agent Name\]/gi, defaultSignoff)
      .replace(/\[Support Representative\]/gi, defaultSignoff)
      .replace(/\[Representative Name\]/gi, defaultSignoff)
      .replace(/\[Your Title\]/gi, defaultSignoff)
      .replace(/\[Company Name\]/gi, 'DraftPilot Support')
      .replace(/\[Support Team\]/gi, defaultSignoff)
      .replace(/{{agent_name}}/gi, defaultSignoff);

    // 8. Greeting Normalization
    if (customerName && customerName.toLowerCase() !== 'there') {
      text = text.replace(/^(?:Hi|Hello|Dear)\s+there,/im, `Hi ${customerName},`);
      text = text.replace(/^(?:Hi|Hello|Dear),/im, `Hi ${customerName},`);
      text = text.replace(/^(?:Hi|Hello|Dear)\s+\[Name\],/im, `Hi ${customerName},`);
      text = text.replace(/^(?:Hi|Hello|Dear)\s+\[Customer\],/im, `Hi ${customerName},`);
    }

    return text;
  }

  /**
   * Generates a context-aware, empathetic customer support reply across 5 key domains
   */
  private synthesizeSmartDraft(prompt: string, customerName = 'there'): string {
    const lower = (prompt || '').toLowerCase();
    const name = customerName && customerName.toLowerCase() !== 'there' ? customerName : 'there';

    // 1. Check for Refund & Return intent
    if (lower.includes('refund') || lower.includes('return') || lower.includes('money back')) {
      return `Hi ${name},

Thank you for reaching out to us. I completely understand and would be glad to help you with your return and refund request.

I have located your account and initiated the refund process in accordance with our return policy. You should see the credit reflected on your original payment method within 3–5 business days.

Please don't hesitate to reach out if you have any questions in the meantime!

Best regards,
Customer Support Team`;
    }

    // 2. Check for Order Status & Tracking intent
    if (
      lower.includes('track') ||
      lower.includes('shipping') ||
      lower.includes('where is my order') ||
      lower.includes('where is') ||
      lower.includes('delivery') ||
      lower.includes('delay') ||
      lower.includes('package')
    ) {
      return `Hi ${name},

Thanks for checking in on your order status!

Your shipment is on track and moving smoothly with our carrier. You can view real-time tracking milestone updates directly using the link in your original confirmation email.

If you encounter any transit delays or need address adjustments, just let me know and I will be happy to assist.

Warm regards,
Customer Support Team`;
    }

    // 3. Check for Password / Account Access intent
    if (
      lower.includes('password') ||
      lower.includes('login') ||
      lower.includes('2fa') ||
      lower.includes('account') ||
      lower.includes('locked') ||
      lower.includes('reset') ||
      lower.includes('sign in')
    ) {
      return `Hi ${name},

Thank you for contacting support regarding your account access.

I've generated a secure password reset link for you. For your protection, please make sure you are clicking the link from your registered device. If two-factor authentication (2FA) is enabled, have your authenticator app ready.

Let us know if you need any additional guidance getting back into your account!

Best regards,
Customer Support Team`;
    }

    // 4. Check for Billing / Invoice intent
    if (
      lower.includes('invoice') ||
      lower.includes('receipt') ||
      lower.includes('charge') ||
      lower.includes('card') ||
      lower.includes('billing') ||
      lower.includes('subscription') ||
      lower.includes('payment')
    ) {
      return `Hi ${name},

Thank you for contacting our billing department.

I've reviewed your account history and confirmed your recent billing statement. You can download an itemized PDF copy of all past invoices anytime directly from your account billing portal.

If you'd like to update your payment method or need a custom VAT/tax invoice, feel free to reply and I'll take care of it immediately.

Best regards,
Customer Support Team`;
    }

    // 5. Check for Technical Troubleshooting intent
    if (
      lower.includes('error') ||
      lower.includes('bug') ||
      lower.includes('crash') ||
      lower.includes('issue') ||
      lower.includes('not working') ||
      lower.includes('broken') ||
      lower.includes('failed') ||
      lower.includes('troubleshoot') ||
      lower.includes('glitch')
    ) {
      return `Hi ${name},

Thank you for reaching out regarding the issue you are experiencing. I apologize for the inconvenience this has caused.

To help resolve this quickly, could you please try clearing your browser cache or testing in an incognito window? If the issue persists, please reply with any relevant error codes, screenshots, or the exact steps to reproduce the problem so our technical team can investigate immediately.

We appreciate your patience and look forward to getting this sorted out for you!

Best regards,
Customer Support Team`;
    }

    // 6. Default Friendly Support Reply
    return `Hi ${name},

Thank you for getting in touch with us! I have reviewed your inquiry and would be glad to assist you.

Could you please provide a few more details so I can resolve this as quickly as possible for you?

Looking forward to hearing back from you,
Customer Support Team`;
  }
}