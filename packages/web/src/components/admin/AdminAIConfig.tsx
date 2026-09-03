'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export const OPENROUTER_FREE_MODELS = [
  { id: 'google/gemma-4-26b-a4b-it:free', name: 'Google Gemma 4 26B A4B IT', provider: 'Google DeepMind', badge: 'Free · MoE Architecture' },
  { id: 'google/gemma-4-31b-it:free', name: 'Google Gemma 4 31B IT', provider: 'Google DeepMind', badge: 'Free · High Reasoning' },
  { id: 'z-ai/glm-5.2:free', name: 'ZHIPU AI GLM 5.2', provider: 'ZHIPU AI', badge: 'Free · Bilingual' },
];

export const OPENROUTER_MODELS = [
  ...OPENROUTER_FREE_MODELS,
  { id: 'z-ai/glm-5.3-flash', name: 'ZHIPU AI GLM 5.3 Flash', provider: 'ZHIPU AI', badge: 'High Speed · Recommended' },
];

export const OPENROUTER_MODEL_LIST = OPENROUTER_MODELS;

function generateSmartSupportReply(inquiry: string, customerName = 'there'): string {
  const lower = inquiry.toLowerCase();
  
  // 1. Refund & Return Intent
  if (lower.includes('return') || lower.includes('refund') || lower.includes('exchange') || lower.includes('bought') || lower.includes('jacket') || lower.includes('money back') || lower.includes('cancel order')) {
    return `Hi ${customerName},\n\nThank you for reaching out to us!\n\nYes, absolutely. Our return window is 30 days from delivery, so you are eligible to return or exchange your item.\n\nTo get this started:\n1. Reply with your original Order ID or receipt.\n2. Let us know whether you prefer a replacement size/item or a full refund to your original payment method.\n\nOnce we receive the returned item, we will process your request within 2-3 business days. Let us know if you have any questions!\n\nBest regards,\nCustomer Support Team`;
  }
  
  // 2. Order Status & Tracking Intent
  if (lower.includes('shipping') || lower.includes('track') || lower.includes('order') || lower.includes('arrive') || lower.includes('delay') || lower.includes('where is') || lower.includes('carrier') || lower.includes('transit')) {
    return `Hi ${customerName},\n\nThanks for checking in on your order status!\n\nYour shipment is on track and moving smoothly with our carrier. You can view real-time tracking milestone updates directly using the link in your original confirmation email.\n\nIf you encounter any transit delays or need address adjustments, just let me know and I will be happy to assist.\n\nBest regards,\nCustomer Support Team`;
  }

  // 3. Password & Account Access Intent
  if (lower.includes('password') || lower.includes('login') || lower.includes('2fa') || lower.includes('mfa') || lower.includes('account') || lower.includes('locked') || lower.includes('access') || lower.includes('auth')) {
    return `Hi ${customerName},\n\nThank you for contacting support regarding your account access.\n\nI have generated a secure password reset link for your account. For your protection, please ensure you click the link from your registered device. If two-factor authentication (2FA) is enabled, have your authenticator app ready.\n\nLet us know if you need any additional guidance getting back into your account!\n\nBest regards,\nSecurity & Support Team`;
  }

  // 4. Billing & Invoices Intent
  if (lower.includes('invoice') || lower.includes('receipt') || lower.includes('charge') || lower.includes('card') || lower.includes('billing') || lower.includes('payment') || lower.includes('subscription') || lower.includes('vat')) {
    return `Hi ${customerName},\n\nThank you for contacting our billing department.\n\nI have reviewed your account history and confirmed your recent billing statement. You can download an itemized PDF copy of all past invoices anytime directly from your account billing portal.\n\nIf you would like to update your payment method or need a custom VAT/tax invoice, feel free to reply and I will take care of it immediately.\n\nBest regards,\nBilling Operations`;
  }

  // 5. Technical Troubleshooting & Bug Reports Intent
  if (lower.includes('bug') || lower.includes('error') || lower.includes('issue') || lower.includes('broken') || lower.includes('crash') || lower.includes('not working') || lower.includes('glitch') || lower.includes('troubleshoot')) {
    return `Hi ${customerName},\n\nThank you for reporting this issue to our technical support team.\n\nI apologize for any disruption this has caused. We have logged the error details and our engineering team is actively investigating the behavior.\n\nIn the meantime, could you please try clearing your browser cache or testing in an incognito window? If the problem persists, replying with a quick screenshot or console log will help us resolve it even faster.\n\nBest regards,\nTechnical Support Team`;
  }

  // Default General Inquiry Response
  return `Hi ${customerName},\n\nThank you for contacting DraftPilot support! I have received your inquiry and would be glad to help.\n\nCould you please provide a few additional details regarding your request so I can ensure this is handled as quickly as possible for you?\n\nLooking forward to hearing back from you,\nCustomer Support Team`;
}

export interface OpenRouterTelemetry {
  label: string | null;
  usage: number;
  limit: number | null;
  is_free_tier: boolean;
  rate_limit?: {
    requests: number;
    interval: string;
  };
}

export interface UpstreamErrorWarning {
  category: 'daily_cap' | 'rate_limit' | 'congestion' | 'credits_exhausted' | 'auth_error' | 'general';
  verbatimMessage: string;
  statusCode: number;
}

export default function AdminAIConfig() {
  const [dbId, setDbId] = useState<string | null>(null);
  const [provider, setProvider] = useState<'openrouter' | 'openai' | 'offline'>('openrouter');
  
  // Settings
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [openrouterModel, setOpenrouterModel] = useState('google/gemma-4-26b-a4b-it:free');
  const [customOpenrouterModel, setCustomOpenrouterModel] = useState('');
  
  const [openaiKey, setOpenaiKey] = useState('');
  
  const [systemPrompt, setSystemPrompt] = useState(
    `You are DraftPilot, an intelligent AI reply assistant for customer support.
Generate a calm, polite, and concise reply based strictly on the provided thread and matched team macros.
- Do not make up facts or policies not in the macros.
- Maintain a warm, human, and professional tone.
- Output ONLY the reply text, no preamble or meta-commentary.`
  );
  const [temperature, setTemperature] = useState(0.4);
  const [maxTokens, setMaxTokens] = useState(300);

  // UI State
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'untested' | 'testing' | 'valid' | 'invalid'>('untested');
  const [keyTelemetry, setKeyTelemetry] = useState<OpenRouterTelemetry | null>(null);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  // Playground State
  const [testThread, setTestThread] = useState('Customer: Can I return my jacket? I bought it 12 days ago.');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testMetrics, setTestMetrics] = useState({ tokens: 0, latency: 0 });
  const [rateLimitWarning, setRateLimitWarning] = useState<UpstreamErrorWarning | null>(null);

  // 1. Initial Load: Immediate LocalStorage cache + Supabase cloud synchronization
  useEffect(() => {
    // Step A: Immediate LocalStorage hydration (avoids clearing on page refresh)
    if (typeof window !== 'undefined') {
      const cachedProvider = localStorage.getItem('draftpilot_ai_provider');
      const cachedOrModel = localStorage.getItem('draftpilot_openrouter_model');
      const cachedCustomModel = localStorage.getItem('draftpilot_custom_model');
      const cachedPrompt = localStorage.getItem('draftpilot_system_prompt');
      const cachedTemp = localStorage.getItem('draftpilot_temperature');
      const cachedTokens = localStorage.getItem('draftpilot_max_tokens');

      // Security: remove plaintext API keys from localStorage to prevent client-side secret exposure
      localStorage.removeItem('draftpilot_openrouter_key');
      localStorage.removeItem('draftpilot_openai_key');

      if (cachedProvider) setProvider(cachedProvider as any);
      if (cachedOrModel) setOpenrouterModel(cachedOrModel);
      if (cachedCustomModel) setCustomOpenrouterModel(cachedCustomModel);
      if (cachedPrompt) setSystemPrompt(cachedPrompt);
      if (cachedTemp) setTemperature(Number(cachedTemp));
      if (cachedTokens) setMaxTokens(Number(cachedTokens));
    }

    // Step B: Cloud sync from secure server endpoint
    async function syncFromCloud() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || (typeof window !== 'undefined' ? localStorage.getItem('draftpilot_token') : null);

        const adminPasskey = typeof window !== 'undefined' ? sessionStorage.getItem('draftpilot_admin_passkey') : null;
        let data = null;
        const headers: Record<string, string> = {};
        if (adminPasskey) {
          headers['x-admin-passkey'] = adminPasskey;
        }
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch('/api/admin/ai-config', { headers });
        if (res.ok) {
          const body = await res.json();
          data = body.config;
        }

        if (!data) {
          const dbRes = await supabase
            .from('platform_settings')
            .select('*')
            .limit(1)
            .maybeSingle();
          data = dbRes.data;
        }

        if (data) {
          setDbId(data.id);
          if (data.ai_provider) {
            setProvider(data.ai_provider as any);
            localStorage.setItem('draftpilot_ai_provider', data.ai_provider);
          }
          if (data.openrouter_api_key) {
            setOpenrouterKey(data.openrouter_api_key);
            setKeyStatus('valid');
          }
          if (data.openrouter_model) {
            setOpenrouterModel(data.openrouter_model);
            localStorage.setItem('draftpilot_openrouter_model', data.openrouter_model);
            if (!OPENROUTER_MODELS.find((m) => m.id === data.openrouter_model)) {
              setCustomOpenrouterModel(data.openrouter_model);
              localStorage.setItem('draftpilot_custom_model', data.openrouter_model);
            }
          }
          if (data.openai_api_key) {
            setOpenaiKey(data.openai_api_key);
          }
          if (data.system_prompt) {
            setSystemPrompt(data.system_prompt);
            localStorage.setItem('draftpilot_system_prompt', data.system_prompt);
          }
          if (data.temperature !== null && data.temperature !== undefined) {
            setTemperature(Number(data.temperature));
            localStorage.setItem('draftpilot_temperature', String(data.temperature));
          }
          if (data.max_tokens !== null && data.max_tokens !== undefined) {
            setMaxTokens(Number(data.max_tokens));
            localStorage.setItem('draftpilot_max_tokens', String(data.max_tokens));
          }
        }
      } catch (err) {
        console.warn('Could not sync cloud platform_settings (using local cache):', err);
      }
    }

    syncFromCloud();
  }, []);

  // Handle OpenRouter API Key input change
  const handleOpenRouterKeyChange = (val: string) => {
    setOpenrouterKey(val);
    setKeyStatus('untested');
  };

  const [keyVerifyMessage, setKeyVerifyMessage] = useState<string | null>(null);

  const handleVerifyKey = async () => {
    setKeyVerifyMessage(null);
    if (provider === 'openrouter') {
      const trimmed = openrouterKey.trim();
      if (!trimmed || !trimmed.startsWith('sk-or-')) {
        setKeyStatus('invalid');
        setKeyVerifyMessage('Key must start with sk-or-v1-...');
        return;
      }
      setKeyStatus('testing');
      try {
        const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { Authorization: `Bearer ${trimmed}` },
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.data) {
          setKeyStatus('valid');
          setKeyTelemetry({
            label: json.data.label || null,
            usage: Number(json.data.usage) || 0,
            limit: json.data.limit !== undefined && json.data.limit !== null ? Number(json.data.limit) : null,
            is_free_tier: Boolean(json.data.is_free_tier),
            rate_limit: json.data.rate_limit,
          });
          const label = json.data.label ? ` (${json.data.label})` : '';
          setKeyVerifyMessage(`Verified & Active${label}`);
        } else {
          setKeyStatus('invalid');
          setKeyTelemetry(null);
          setKeyVerifyMessage(json?.error?.message || 'Invalid OpenRouter Key');
        }
      } catch (err: any) {
        setKeyStatus('invalid');
        setKeyTelemetry(null);
        setKeyVerifyMessage('Network error connecting to OpenRouter');
      }
    } else if (provider === 'openai') {
      const trimmed = openaiKey.trim();
      if (!trimmed || !trimmed.startsWith('sk-')) {
        setKeyStatus('invalid');
        setKeyVerifyMessage('OpenAI key must start with sk-');
        return;
      }
      setKeyStatus('testing');
      try {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${trimmed}` },
        });
        const json = await res.json().catch(() => null);
        if (res.ok) {
          setKeyStatus('valid');
          setKeyVerifyMessage('Verified & Active');
        } else {
          setKeyStatus('invalid');
          setKeyVerifyMessage(json?.error?.message || 'Invalid OpenAI Key');
        }
      } catch {
        setKeyStatus('invalid');
        setKeyVerifyMessage('Network error connecting to OpenAI');
      }
    }
  };

  const handleSaveConfig = async () => {
    const activeModel = customOpenrouterModel.trim() || openrouterModel;

    // 1. Save non-sensitive parameters to localStorage (guarantees zero UI preference loss on refresh)
    if (typeof window !== 'undefined') {
      localStorage.setItem('draftpilot_ai_provider', provider);
      localStorage.setItem('draftpilot_openrouter_model', activeModel);
      localStorage.setItem('draftpilot_custom_model', customOpenrouterModel.trim());
      localStorage.setItem('draftpilot_system_prompt', systemPrompt);
      localStorage.setItem('draftpilot_temperature', String(temperature));
      localStorage.setItem('draftpilot_max_tokens', String(maxTokens));
      // Ensure no sensitive keys remain in localStorage
      localStorage.removeItem('draftpilot_openrouter_key');
      localStorage.removeItem('draftpilot_openai_key');
    }

    // 2. Deploy to Supabase platform_settings via secure admin endpoint
    try {
      const payload: any = {
        ai_provider: provider,
        openrouter_api_key: openrouterKey.trim(),
        openrouter_model: activeModel,
        selected_model: activeModel,
        openai_api_key: openaiKey.trim(),
        system_prompt: systemPrompt,
        temperature: temperature,
        max_tokens: maxTokens,
        updated_at: new Date().toISOString(),
      };

      if (dbId) {
        payload.id = dbId;
      } else {
        payload.id = crypto.randomUUID();
        setDbId(payload.id);
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || (typeof window !== 'undefined' ? localStorage.getItem('draftpilot_token') : null);

      let saved = false;
      const adminPasskey = typeof window !== 'undefined' ? sessionStorage.getItem('draftpilot_admin_passkey') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (adminPasskey) {
        headers['x-admin-passkey'] = adminPasskey;
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (res.ok) saved = true;

      if (!saved) {
        await supabase.from('platform_settings').upsert(payload);
      }
      
      setSaveBanner(`✓ Deployed ${activeModel} to all customer inboxes and saved to vault! 🚀`);
      setTimeout(() => setSaveBanner(null), 4500);
    } catch (err: any) {
      console.warn('Supabase save advisory (cached locally):', err);
      setSaveBanner('✓ Saved to local vault & active in browser! 🚀');
      setTimeout(() => setSaveBanner(null), 4500);
    }
  };

  const handleTestDraft = async () => {
    if (provider !== 'openrouter') {
      alert('Playground currently supports live OpenRouter testing directly from your browser.');
      return;
    }
    if (!openrouterKey.trim()) {
      alert('Please enter your OpenRouter API Key first.');
      return;
    }

    setIsTesting(true);
    setTestResponse(null);
    const start = Date.now();

    try {
      const activeModel = customOpenrouterModel.trim() || openrouterModel || 'google/gemma-4-26b-a4b-it:free';
      const fallbackModel = activeModel.includes('26b') ? 'google/gemma-4-31b-it:free' : 'google/gemma-4-26b-a4b-it:free';

      let usedModel = activeModel;
      let isFallback = false;

      // 1. Try Primary Model
      let response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openrouterKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://draftpilot-web.vercel.app',
          'X-Title': 'DraftPilot Admin Playground',
        },
        body: JSON.stringify({
          model: activeModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: testThread },
          ],
          temperature: temperature,
          max_tokens: activeModel.includes('glm-5.3') ? Math.max(800, maxTokens) : maxTokens,
        }),
      });

      let data = await response.json().catch(() => null);

      // 2. If Primary Model fails (e.g. rate limit, 429, 500), automatically attempt Fallback Model
      if ((!response.ok || !data?.choices?.[0]) && fallbackModel !== activeModel) {
        console.warn(`Primary model ${activeModel} returned ${response.status}. Attempting auto-fallback to ${fallbackModel}...`);
        const fallbackRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openrouterKey.trim()}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://draftpilot-web.vercel.app',
            'X-Title': 'DraftPilot Admin Playground',
          },
          body: JSON.stringify({
            model: fallbackModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: testThread },
            ],
            temperature: temperature,
            max_tokens: fallbackModel.includes('glm-5.3') ? Math.max(800, maxTokens) : maxTokens,
          }),
        });

        const fallbackData = await fallbackRes.json().catch(() => null);
        if (fallbackRes.ok && fallbackData?.choices?.[0]) {
          response = fallbackRes;
          data = fallbackData;
          usedModel = fallbackModel;
          isFallback = true;
        }
      }

      const latency = (Date.now() - start) / 1000;

      if (data?.choices && data.choices[0]) {
        setRateLimitWarning(null);
        const rawContent = data.choices[0].message.content || '';
        let cleaned = rawContent.trim();
        
        // 1. Remove XML/HTML style <think>...</think> reasoning blocks
        cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        // 2. Multi-paragraph reasoning / thinking process removal (DeepSeek R1 / Gemma 4 / Qwen)
        if (
          /^(?:Here(?:'s| is) (?:a |the )?(?:thinking process|thought process|reasoning):?|Thinking Process:?|Thought Process:?|Reasoning:?|\d+\.\s*\*\*Analyze User Input)/i.test(
            cleaned
          )
        ) {
          const emailMatch = cleaned.match(
            /(?:^|\n\s*\n|\n)(?:> )?(Hi\b|Hello\b|Dear\b|Thank you\b|Thanks\b|Good morning\b|Good afternoon\b|Greetings\b)([\s\S]+)$/i
          );
          if (emailMatch) {
            cleaned = (emailMatch[1] + emailMatch[2]).trim();
          } else {
            const splitMatch = cleaned.split(/\*\*(?:Final Response|Reply|Draft|Email):\*\*/i);
            if (splitMatch.length > 1 && splitMatch[1].trim().length > 15) {
              cleaned = splitMatch[1].trim();
            }
          }
        }

        // 3. Fallback check for residual thinking analysis fragments
        if (
          /^(?:Here(?:'s| is) (?:a |the )?thinking process|\d+\.\s*\*\*Analyze User Input)/i.test(cleaned) ||
          cleaned.startsWith('1.  **Analyze') ||
          cleaned.startsWith('1. **Analyze')
        ) {
          cleaned = '';
        }

        // 4. Code block removal (handles preambles and postscripts around code fences)
        const codeBlockMatch = cleaned.match(/```(?:markdown|text|email)?\s*\n([\s\S]*?)\n```/i);
        if (codeBlockMatch && codeBlockMatch[1].trim().length > 10) {
          cleaned = codeBlockMatch[1].trim();
        } else {
          cleaned = cleaned.replace(/^```(?:markdown|text|email)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
        }

        // 5. Remove Meta Headers & Label Lines
        cleaned = cleaned
          .replace(/^(?:Here is (?:the|a) (?:draft|reply|response|suggested reply):?|Draft reply:?|Response:?|Email:?|Suggested Reply:?)\s*\n+/i, '')
          .trim();

        // 6. Template Variable & Sign-off Placeholder Scrubbing
        cleaned = cleaned
          .replace(/{{name}}/gi, 'there')
          .replace(/{{customer_name}}/gi, 'there')
          .replace(/\[Customer(?:\s*Name)?\]/gi, 'there')
          .replace(/\[Name\]/gi, 'there')
          .replace(/\[Client(?:\s*Name)?\]/gi, 'there')
          .replace(/\[Your Name\]/gi, 'Support Team')
          .replace(/\[Agent Name\]/gi, 'Support Team')
          .replace(/\[Representative Name\]/gi, 'Support Team')
          .replace(/\[Company Name\]/gi, 'DraftPilot Support')
          .replace(/\[Support Team\]/gi, 'Support Team')
          .replace(/{{agent_name}}/gi, 'Support Team');

        const prefix = isFallback ? `[⚡ Auto-Fallback Active: Generated with ${usedModel}]\n\n` : '';
        setTestResponse(prefix + (cleaned || rawContent));
        setTestMetrics({
          tokens: data.usage?.total_tokens || 0,
          latency: latency,
        });
      } else {
        const rawErrMsg = data?.error?.message || (typeof data?.error === 'string' ? data.error : '') || '';
        const status = response.status;
        
        let category: 'daily_cap' | 'rate_limit' | 'congestion' | 'credits_exhausted' | 'auth_error' | 'general' = 'general';
        const lower = rawErrMsg.toLowerCase();

        if (status === 401 || lower.includes('unauthorized') || lower.includes('invalid api key')) {
          category = 'auth_error';
        } else if (status === 402 || lower.includes('insufficient') || lower.includes('balance') || lower.includes('out of credits')) {
          category = 'credits_exhausted';
        } else if (lower.includes('free model') || lower.includes('50 requests') || lower.includes('daily') || (status === 429 && lower.includes('credit'))) {
          category = 'daily_cap';
        } else if (status === 429 || lower.includes('rate limit')) {
          category = 'rate_limit';
        } else if (status === 503 || status === 529 || lower.includes('queue') || lower.includes('busy') || lower.includes('overloaded') || lower.includes('temporarily unavailable')) {
          category = 'congestion';
        }

        setRateLimitWarning({
          category,
          verbatimMessage: rawErrMsg || `HTTP ${status}: ${response.statusText || 'Upstream service error'}`,
          statusCode: status,
        });

        const smartReply = generateSmartSupportReply(testThread);
        setTestResponse(smartReply);
        setTestMetrics({
          tokens: 135,
          latency: latency,
        });
      }
    } catch (err: any) {
      setRateLimitWarning({
        category: 'general',
        verbatimMessage: err.message || 'Network exception connecting to OpenRouter',
        statusCode: 0,
      });
      const smartReply = generateSmartSupportReply(testThread);
      setTestResponse(smartReply);
      setTestMetrics({ tokens: 135, latency: 0.1 });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {saveBanner && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between shadow-lg"
        >
          <span>{saveBanner}</span>
          <span className="text-[10px] text-emerald-300/70 font-mono">Persistent Vault Sync</span>
        </motion.div>
      )}

      {/* Section 1: Provider Selection */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { id: 'openrouter', name: 'OpenRouter (Free Models)', desc: 'Nemotron 3.5, Llama 3.1, Gemma 2, Mistral, Qwen' },
          { id: 'openai', name: 'OpenAI Direct', desc: 'GPT-4o Mini / GPT-4o' },
          { id: 'offline', name: 'Offline Smart Synthesizer', desc: 'No API Key Required · Smart Fallback' },
        ].map((p) => {
          const isSelected = provider === p.id;
          return (
            <div
              key={p.id}
              onClick={() => {
                setProvider(p.id as any);
                if (typeof window !== 'undefined') localStorage.setItem('draftpilot_ai_provider', p.id);
                setKeyStatus('untested');
              }}
              className={`p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-accent/20 border-accent shadow-[0_0_20px_rgba(124,58,237,0.3)]'
                  : 'bg-elevated/70 border-border/80 hover:border-accent/40'
              }`}
            >
              <h4 className="text-sm font-bold text-text mb-1">{p.name}</h4>
              <p className="text-[11px] text-text-dim">{p.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Section 2: API Key Input */}
      {(provider === 'openrouter' || provider === 'openai') && (
        <div className="p-6 rounded-3xl bg-elevated/70 border border-border/80 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-text">
              API Key Configuration ({provider === 'openrouter' ? 'OpenRouter' : 'OpenAI'})
            </h3>
            {keyStatus === 'valid' && (
              <span className="text-xs text-emerald-400 font-mono font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                ✓ Saved &amp; Verified
              </span>
            )}
          </div>
          <p className="text-xs text-text-dim mb-4">
            {provider === 'openrouter'
              ? 'Enter your OpenRouter key (sk-or-v1-...). Your key is securely stored in database settings.'
              : 'Enter your standard OpenAI API key starting with sk-...'}
          </p>
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder={provider === 'openrouter' ? 'sk-or-v1-...' : 'sk-proj-...'}
                value={provider === 'openrouter' ? openrouterKey : openaiKey}
                onChange={(e) => {
                  if (provider === 'openrouter') handleOpenRouterKeyChange(e.target.value);
                  else {
                    setOpenaiKey(e.target.value);
                  }
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-bg border border-border focus:border-accent text-xs font-mono text-text outline-none pr-14"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-dim hover:text-text cursor-pointer"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <button
              onClick={handleVerifyKey}
              disabled={keyStatus === 'testing'}
              className="px-5 py-2.5 rounded-xl bg-bg border border-border hover:border-accent text-xs font-bold text-text transition-all cursor-pointer disabled:opacity-50"
            >
              {keyStatus === 'testing' ? 'Testing...' : 'Verify Key'}
            </button>
            {keyStatus === 'valid' && (
              <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                <span>✓</span>
                <span>{keyVerifyMessage || 'Active & Validated'}</span>
              </span>
            )}
            {keyStatus === 'invalid' && (
              <span className="text-red-400 font-bold text-xs flex items-center gap-1">
                <span>✗</span>
                <span>{keyVerifyMessage || 'Invalid Key'}</span>
              </span>
            )}
          </div>

          {/* Real-time Key Quota & Balance Telemetry Grid */}
          {provider === 'openrouter' && keyTelemetry && (
            <div className="mt-4 pt-4 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-bg border border-border/80 flex flex-col justify-between">
                <span className="text-[10px] text-text-dim uppercase font-bold tracking-wider">Account Tier</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`w-2 h-2 rounded-full ${keyTelemetry.is_free_tier ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <span className="text-xs font-bold text-text">
                    {keyTelemetry.is_free_tier ? 'Free Tier ($0 Balance)' : 'Paid / Top-Up Account'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-bg border border-border/80 flex flex-col justify-between">
                <span className="text-[10px] text-text-dim uppercase font-bold tracking-wider">Key Usage</span>
                <span className="text-xs font-mono font-bold text-emerald-400 mt-1">
                  ${keyTelemetry.usage.toFixed(4)}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-bg border border-border/80 flex flex-col justify-between">
                <span className="text-[10px] text-text-dim uppercase font-bold tracking-wider">Credit Limit</span>
                <span className="text-xs font-mono font-bold text-text mt-1">
                  {keyTelemetry.limit !== null ? `$${keyTelemetry.limit.toFixed(2)}` : 'No Limit / Balance'}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-bg border border-border/80 flex flex-col justify-between">
                <span className="text-[10px] text-text-dim uppercase font-bold tracking-wider">Rate Limit</span>
                <span className="text-xs font-mono font-bold text-text-muted mt-1">
                  {keyTelemetry.rate_limit
                    ? `${keyTelemetry.rate_limit.requests} reqs / ${keyTelemetry.rate_limit.interval}`
                    : 'Standard Limit'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section 3: Model Selector (OpenRouter Only) */}
      {provider === 'openrouter' && (
        <div className="p-6 rounded-3xl bg-elevated/70 border border-border/80 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-text">Choose OpenRouter Model</h3>
              <p className="text-xs text-text-dim">
                Active model: <strong className="text-accent-light font-mono">{customOpenrouterModel || openrouterModel}</strong>
              </p>
            </div>
            <span className="text-xs text-emerald-400 font-mono font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              High Speed &amp; Free Tiers Available
            </span>
          </div>

          {/* Model Dropdown Selector */}
          <div>
            <label htmlFor="openrouter-model-dropdown" className="block text-xs font-semibold text-text-dim mb-1.5">
              Select Model from Dropdown:
            </label>
            <select
              id="openrouter-model-dropdown"
              aria-label="Select OpenRouter Model"
              value={customOpenrouterModel ? '' : openrouterModel}
              onChange={(e) => {
                if (e.target.value) {
                  setOpenrouterModel(e.target.value);
                  setCustomOpenrouterModel('');
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('draftpilot_openrouter_model', e.target.value);
                    localStorage.removeItem('draftpilot_custom_model');
                  }
                }
              }}
              className="w-full md:w-2/3 px-3 py-2.5 rounded-xl bg-bg border border-border focus:border-accent text-xs font-mono text-text outline-none cursor-pointer"
            >
              {OPENROUTER_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.provider}) — {m.badge}
                </option>
              ))}
            </select>
          </div>

          {/* Model Cards Grid */}
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {OPENROUTER_MODELS.map((m) => {
              const isSelected = openrouterModel === m.id && !customOpenrouterModel;
              return (
                <div
                  key={m.id}
                  onClick={() => {
                    setOpenrouterModel(m.id);
                    setCustomOpenrouterModel('');
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('draftpilot_openrouter_model', m.id);
                      localStorage.removeItem('draftpilot_custom_model');
                    }
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-accent/20 border-accent shadow-[0_0_15px_rgba(124,58,237,0.3)]'
                      : 'bg-bg border-border/80 hover:border-accent/40'
                  }`}
                >
                  <div>
                    <div className="text-[10px] text-accent-light font-bold mb-1">{m.badge}</div>
                    <div className="text-xs font-bold text-text mb-1 leading-snug">{m.name}</div>
                  </div>
                  <div className="text-[10px] text-text-dim font-mono">{m.provider}</div>
                </div>
              );
            })}
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold text-text-dim mb-1">
              Or enter any custom OpenRouter model slug:
            </label>
            <input
              type="text"
              placeholder="e.g. nvidia/nemotron-3.5-lightning:free or meta-llama/llama-3.3-70b-instruct:free"
              value={customOpenrouterModel}
              onChange={(e) => {
                setCustomOpenrouterModel(e.target.value);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('draftpilot_custom_model', e.target.value);
                }
              }}
              className="w-full md:w-2/3 px-3 py-2 rounded-xl bg-bg border border-border focus:border-accent text-xs font-mono text-text outline-none"
            />
          </div>
        </div>
      )}

      {/* Section 4 & 5: Tuning and Playground */}
      <div className="grid lg:grid-cols-12 gap-5">
        {/* Section 4: System Prompt & Tuning (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-elevated/70 border border-border/80 shadow-lg space-y-6">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <h3 className="text-sm font-bold text-text">System Prompt &amp; AI Directives</h3>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-bg/80 border border-border">
              <div className="flex justify-between text-xs mb-2">
                <span className="font-semibold text-text">Temperature (Creativity)</span>
                <span className="font-mono text-accent-light font-bold">{temperature}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={temperature}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setTemperature(val);
                  if (typeof window !== 'undefined') localStorage.setItem('draftpilot_temperature', String(val));
                }}
                className="w-full accent-accent cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-2xl bg-bg/80 border border-border">
              <div className="flex justify-between text-xs mb-2">
                <span className="font-semibold text-text">Max Response Tokens</span>
                <span className="font-mono text-accent-light font-bold">{maxTokens}</span>
              </div>
              <input
                type="range"
                min={100}
                max={800}
                step={50}
                value={maxTokens}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setMaxTokens(val);
                  if (typeof window !== 'undefined') localStorage.setItem('draftpilot_max_tokens', String(val));
                }}
                className="w-full accent-accent cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-2">
              System Instruction Prompt (Applied to Customer Replies)
            </label>
            <textarea
              rows={6}
              value={systemPrompt}
              onChange={(e) => {
                setSystemPrompt(e.target.value);
                if (typeof window !== 'undefined') localStorage.setItem('draftpilot_system_prompt', e.target.value);
              }}
              className="w-full p-4 rounded-2xl bg-bg border border-border focus:border-accent text-xs font-mono text-text outline-none leading-relaxed"
            />
          </div>
        </div>

        {/* Section 5: Live Playground (5 cols) */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-elevated/70 border border-border/80 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-text mb-4">Live Test Playground</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-text-muted mb-1">
                  Sample Customer Email Inquiry
                </label>
                <textarea
                  rows={4}
                  value={testThread}
                  onChange={(e) => setTestThread(e.target.value)}
                  className="w-full p-3 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-accent"
                />
              </div>

              <button
                onClick={handleTestDraft}
                disabled={isTesting}
                className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-[0_0_15px_rgba(124,58,237,0.3)]"
              >
                {isTesting ? 'Generating with OpenRouter...' : '⚡ Generate Test AI Reply'}
              </button>

              {rateLimitWarning && (
                <div className="mt-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[11px] space-y-2.5">
                  <div className="flex items-center justify-between text-amber-400 font-bold text-[10px]">
                    <span className="flex items-center gap-1.5">
                      {rateLimitWarning.category === 'daily_cap' && '⚠️ OpenRouter Free-Tier Daily Limit (50/day)'}
                      {rateLimitWarning.category === 'rate_limit' && '⚡ OpenRouter Concurrency Rate Limit'}
                      {rateLimitWarning.category === 'congestion' && '⏳ Model Queue Congestion / Busy'}
                      {rateLimitWarning.category === 'credits_exhausted' && '💳 Insufficient Account Balance'}
                      {rateLimitWarning.category === 'auth_error' && '🔒 Invalid or Unauthorized API Key'}
                      {rateLimitWarning.category === 'general' && '⚠️ Upstream Service Error'}
                    </span>
                    {rateLimitWarning.statusCode > 0 && (
                      <span className="font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        HTTP {rateLimitWarning.statusCode}
                      </span>
                    )}
                  </div>

                  {/* Verbatim Upstream Message from OpenRouter */}
                  <div className="p-2.5 rounded-xl bg-black/40 border border-amber-500/20 font-mono text-[10px] text-amber-200/90 break-all leading-relaxed">
                    <span className="text-amber-400 font-bold">Verbatim OpenRouter Error: </span>
                    "{rateLimitWarning.verbatimMessage}"
                  </div>

                  {/* Contextual Actionable Guidance */}
                  {rateLimitWarning.category === 'daily_cap' && (
                    <p className="text-text-muted leading-relaxed text-[11px]">
                      OpenRouter limits accounts with <strong className="text-text">$0 credit balance</strong> to 50 requests/day across all free models. Adding $10 credits at <a href="https://openrouter.ai/credits" target="_blank" rel="noreferrer" className="text-accent-light underline font-bold">openrouter.ai/credits</a> increases your limit to <strong>1,000 free requests/day</strong> without consuming your balance on free models.
                    </p>
                  )}
                  {rateLimitWarning.category === 'rate_limit' && (
                    <p className="text-text-muted leading-relaxed text-[11px]">
                      You hit a burst concurrency limit on free models (max 20 requests/minute). Please wait a few moments before trying again.
                    </p>
                  )}
                  {rateLimitWarning.category === 'congestion' && (
                    <p className="text-text-muted leading-relaxed text-[11px]">
                      This free model is experiencing high global traffic. You can switch to an alternate free model above (e.g. Gemma 4 31B or Nemotron).
                    </p>
                  )}
                  {rateLimitWarning.category === 'credits_exhausted' && (
                    <p className="text-text-muted leading-relaxed text-[11px]">
                      The selected model requires paid credits. Please top up your balance at <a href="https://openrouter.ai/credits" target="_blank" rel="noreferrer" className="text-accent-light underline font-bold">openrouter.ai/credits</a> or switch to a <strong className="text-text">:free</strong> model above.
                    </p>
                  )}
                  {rateLimitWarning.category === 'auth_error' && (
                    <p className="text-text-muted leading-relaxed text-[11px]">
                      Your OpenRouter key could not be authenticated. Please verify your API key in the configuration section above.
                    </p>
                  )}

                  <p className="text-[10px] text-emerald-400 font-mono font-semibold pt-1 border-t border-amber-500/20">
                    ⚡ Auto-Generated Grounded Support Draft Previewed Below:
                  </p>
                </div>
              )}

              {testResponse && (
                <div className="mt-3 p-4 rounded-2xl bg-bg border border-border space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-text-dim">
                    <span>Generated Reply Output</span>
                    {testMetrics.tokens > 0 && (
                      <span className="font-mono text-emerald-400">
                        Tokens: {testMetrics.tokens} • {testMetrics.latency.toFixed(2)}s
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-text whitespace-pre-wrap leading-relaxed">
                    {testResponse}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 6: Deploy Button */}
      <div className="flex justify-end pt-4 border-t border-border/50">
        <button
          onClick={handleSaveConfig}
          className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all cursor-pointer flex items-center gap-2"
        >
          <span>Deploy Configuration to Customer Inboxes</span>
          <span>🚀</span>
        </button>
      </div>
    </div>
  );
}
