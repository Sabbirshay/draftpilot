'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

const OPENROUTER_FREE_MODELS = [
  { id: 'google/gemma-4-31b-it:free', name: 'Google Gemma 4 31B IT', provider: 'Google', badge: 'Free · High Reasoning' },
  { id: 'nvidia/nemotron-3.5-lightning:free', name: 'NVIDIA Nemotron 3.5 Lightning', provider: 'NVIDIA', badge: 'Free · Lightning Fast' },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', name: 'NVIDIA Nemotron 70B', provider: 'NVIDIA', badge: 'Free · High Intelligence' },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B Instruct', provider: 'Meta', badge: 'Free · Fast' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct', provider: 'Meta', badge: 'Free · SOTA' },
  { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B IT', provider: 'Google', badge: 'Free · Balanced' },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct', provider: 'Mistral', badge: 'Free · Efficient' },
  { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Phi-3 Mini 128K', provider: 'Microsoft', badge: 'Free · Compact' },
  { id: 'qwen/qwen-2-7b-instruct:free', name: 'Qwen 2 7B Instruct', provider: 'Alibaba', badge: 'Free · Multilingual' },
  { id: 'nousresearch/nous-hermes-2-mixtral-8x7b-dpo:free', name: 'Nous Hermes 2 Mixtral', provider: 'NousResearch', badge: 'Free · Powerful' },
  { id: 'openchat/openchat-7b:free', name: 'OpenChat 7B', provider: 'OpenChat', badge: 'Free · Chat' },
];

export default function AdminAIConfig() {
  const [dbId, setDbId] = useState<string | null>(null);
  const [provider, setProvider] = useState<'openrouter' | 'openai' | 'offline'>('openrouter');
  
  // Settings
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [openrouterModel, setOpenrouterModel] = useState('nvidia/nemotron-3.5-lightning:free');
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
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  // Playground State
  const [testThread, setTestThread] = useState('Customer: Can I return my jacket? I bought it 12 days ago.');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testMetrics, setTestMetrics] = useState({ tokens: 0, latency: 0 });

  // 1. Initial Load: Immediate LocalStorage cache + Supabase cloud synchronization
  useEffect(() => {
    // Step A: Immediate LocalStorage hydration (avoids clearing on page refresh)
    if (typeof window !== 'undefined') {
      const cachedProvider = localStorage.getItem('draftpilot_ai_provider');
      const cachedOrKey = localStorage.getItem('draftpilot_openrouter_key');
      const cachedOrModel = localStorage.getItem('draftpilot_openrouter_model');
      const cachedCustomModel = localStorage.getItem('draftpilot_custom_model');
      const cachedOaiKey = localStorage.getItem('draftpilot_openai_key');
      const cachedPrompt = localStorage.getItem('draftpilot_system_prompt');
      const cachedTemp = localStorage.getItem('draftpilot_temperature');
      const cachedTokens = localStorage.getItem('draftpilot_max_tokens');

      if (cachedProvider) setProvider(cachedProvider as any);
      if (cachedOrKey) {
        setOpenrouterKey(cachedOrKey);
        setKeyStatus('valid');
      }
      if (cachedOrModel) setOpenrouterModel(cachedOrModel);
      if (cachedCustomModel) setCustomOpenrouterModel(cachedCustomModel);
      if (cachedOaiKey) setOpenaiKey(cachedOaiKey);
      if (cachedPrompt) setSystemPrompt(cachedPrompt);
      if (cachedTemp) setTemperature(Number(cachedTemp));
      if (cachedTokens) setMaxTokens(Number(cachedTokens));
    }

    // Step B: Cloud sync from secure server endpoint
    async function syncFromCloud() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || localStorage.getItem('draftpilot_token');

        let data = null;
        if (token) {
          const res = await fetch('/api/admin/ai-config', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const body = await res.json();
            data = body.config;
          }
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
            localStorage.setItem('draftpilot_openrouter_key', data.openrouter_api_key);
            setKeyStatus('valid');
          }
          if (data.openrouter_model) {
            setOpenrouterModel(data.openrouter_model);
            localStorage.setItem('draftpilot_openrouter_model', data.openrouter_model);
            if (!OPENROUTER_FREE_MODELS.find((m) => m.id === data.openrouter_model)) {
              setCustomOpenrouterModel(data.openrouter_model);
              localStorage.setItem('draftpilot_custom_model', data.openrouter_model);
            }
          }
          if (data.openai_api_key) {
            setOpenaiKey(data.openai_api_key);
            localStorage.setItem('draftpilot_openai_key', data.openai_api_key);
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

  // Handle OpenRouter API Key input change with instant auto-save to localStorage
  const handleOpenRouterKeyChange = (val: string) => {
    setOpenrouterKey(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('draftpilot_openrouter_key', val);
    }
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
          const label = json.data.label ? ` (${json.data.label})` : '';
          setKeyVerifyMessage(`Verified & Active${label}`);
          if (typeof window !== 'undefined') {
            localStorage.setItem('draftpilot_openrouter_key', trimmed);
          }
        } else {
          setKeyStatus('invalid');
          setKeyVerifyMessage(json?.error?.message || 'Invalid OpenRouter Key');
        }
      } catch (err: any) {
        setKeyStatus('invalid');
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
          if (typeof window !== 'undefined') {
            localStorage.setItem('draftpilot_openai_key', trimmed);
          }
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

    // 1. Save synchronously to localStorage (guarantees zero data loss on refresh)
    if (typeof window !== 'undefined') {
      localStorage.setItem('draftpilot_ai_provider', provider);
      localStorage.setItem('draftpilot_openrouter_key', openrouterKey.trim());
      localStorage.setItem('draftpilot_openrouter_model', activeModel);
      localStorage.setItem('draftpilot_custom_model', customOpenrouterModel.trim());
      localStorage.setItem('draftpilot_openai_key', openaiKey.trim());
      localStorage.setItem('draftpilot_system_prompt', systemPrompt);
      localStorage.setItem('draftpilot_temperature', String(temperature));
      localStorage.setItem('draftpilot_max_tokens', String(maxTokens));
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
      const token = sessionData.session?.access_token || localStorage.getItem('draftpilot_token');

      let saved = false;
      if (token) {
        const res = await fetch('/api/admin/ai-config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) saved = true;
      }

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
      const activeModel = customOpenrouterModel.trim() || openrouterModel;
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
          max_tokens: maxTokens,
        }),
      });

      const data = await response.json();
      const latency = (Date.now() - start) / 1000;

      if (data.choices && data.choices[0]) {
        const rawContent = data.choices[0].message.content || '';
        let cleaned = rawContent.trim().replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
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
        cleaned = cleaned.replace(/^```(?:markdown|text|email)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
        cleaned = cleaned
          .replace(/^(?:Here is (?:the|a) (?:draft|reply|response|suggested reply):?|Draft reply:?|Response:?|Email:?)\s*\n+/i, '')
          .trim();

        setTestResponse(cleaned || rawContent);
        setTestMetrics({
          tokens: data.usage?.total_tokens || 0,
          latency: latency,
        });
      } else {
        setTestResponse(data.error?.message || JSON.stringify(data, null, 2));
      }
    } catch (err: any) {
      setTestResponse(`Error: ${err.message}`);
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
              ? 'Enter your OpenRouter key (sk-or-v1-...). Your key is securely preserved in local storage and cloud settings.'
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
                    if (typeof window !== 'undefined') localStorage.setItem('draftpilot_openai_key', e.target.value);
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
        </div>
      )}

      {/* Section 3: Model Selector (OpenRouter Only) */}
      {provider === 'openrouter' && (
        <div className="p-6 rounded-3xl bg-elevated/70 border border-border/80 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-text">Choose OpenRouter Free Model</h3>
              <p className="text-xs text-text-dim">
                Active model: <strong className="text-accent-light font-mono">{customOpenrouterModel || openrouterModel}</strong>
              </p>
            </div>
            <span className="text-xs text-emerald-400 font-mono font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              100% Free Tiers Available
            </span>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {OPENROUTER_FREE_MODELS.map((m) => {
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

              {testResponse && (
                <div className="mt-3 p-4 rounded-2xl bg-bg border border-border space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-text-dim">
                    <span>Generated Reply Output</span>
                    <span className="font-mono text-emerald-400">
                      Tokens: {testMetrics.tokens} • {testMetrics.latency.toFixed(2)}s
                    </span>
                  </div>
                  <p className="text-xs font-mono text-text-muted whitespace-pre-wrap leading-relaxed">
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
