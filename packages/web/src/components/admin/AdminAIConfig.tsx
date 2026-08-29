'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

const OPENROUTER_FREE_MODELS = [
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B Instruct', provider: 'Meta', badge: 'Free · Fast' },
  { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B IT', provider: 'Google', badge: 'Free · Balanced' },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct', provider: 'Mistral', badge: 'Free · Efficient' },
  { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Phi-3 Mini 128K', provider: 'Microsoft', badge: 'Free · Compact' },
  { id: 'qwen/qwen-2-7b-instruct:free', name: 'Qwen 2 7B Instruct', provider: 'Alibaba', badge: 'Free · Multilingual' },
  { id: 'huggingfaceh4/zephyr-7b-beta:free', name: 'Zephyr 7B Beta', provider: 'HuggingFace', badge: 'Free · Chat' },
  { id: 'openchat/openchat-7b:free', name: 'OpenChat 7B', provider: 'OpenChat', badge: 'Free · Conversational' },
  { id: 'nousresearch/nous-hermes-2-mixtral-8x7b-dpo:free', name: 'Nous Hermes 2 Mixtral', provider: 'NousResearch', badge: 'Free · Powerful' },
];

export default function AdminAIConfig() {
  const [dbId, setDbId] = useState<string | null>(null);
  const [provider, setProvider] = useState<'openrouter' | 'openai' | 'offline'>('openrouter');
  
  // Settings
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [openrouterModel, setOpenrouterModel] = useState('meta-llama/llama-3.1-8b-instruct:free');
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

  useEffect(() => {
    async function loadConfig() {
      try {
        const { data } = await supabase
          .from('platform_settings')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (data) {
          setDbId(data.id);
          if (data.ai_provider) setProvider(data.ai_provider as any);
          if (data.openrouter_api_key) setOpenrouterKey(data.openrouter_api_key);
          if (data.openrouter_model) {
            setOpenrouterModel(data.openrouter_model);
            if (!OPENROUTER_FREE_MODELS.find(m => m.id === data.openrouter_model)) {
              setCustomOpenrouterModel(data.openrouter_model);
            }
          }
          if (data.openai_api_key) setOpenaiKey(data.openai_api_key);
          if (data.system_prompt) setSystemPrompt(data.system_prompt);
          if (data.temperature !== null) setTemperature(Number(data.temperature));
          if (data.max_tokens !== null) setMaxTokens(Number(data.max_tokens));
        }
      } catch (err) {
        console.error('Error loading config:', err);
      }
    }
    loadConfig();
  }, []);

  const handleVerifyKey = async () => {
    if (provider === 'openrouter') {
      if (!openrouterKey) {
        setKeyStatus('invalid');
        return;
      }
      setKeyStatus('testing');
      try {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${openrouterKey}` }
        });
        if (res.ok) setKeyStatus('valid');
        else setKeyStatus('invalid');
      } catch {
        setKeyStatus('invalid');
      }
    } else if (provider === 'openai') {
      if (!openaiKey) {
        setKeyStatus('invalid');
        return;
      }
      setKeyStatus('testing');
      try {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${openaiKey}` }
        });
        if (res.ok) setKeyStatus('valid');
        else setKeyStatus('invalid');
      } catch {
        setKeyStatus('invalid');
      }
    }
  };

  const handleSaveConfig = async () => {
    try {
      const activeModel = customOpenrouterModel.trim() || openrouterModel;
      const payload: any = {
        ai_provider: provider,
        openrouter_api_key: openrouterKey,
        openrouter_model: activeModel,
        selected_model: activeModel,
        openai_api_key: openaiKey,
        system_prompt: systemPrompt,
        temperature: temperature,
        max_tokens: maxTokens,
        updated_at: new Date().toISOString()
      };

      if (dbId) {
        payload.id = dbId;
      } else {
        payload.id = crypto.randomUUID();
        setDbId(payload.id);
      }

      const { error } = await supabase.from('platform_settings').upsert(payload);
      if (error) throw error;
      
      setSaveBanner('Configuration successfully deployed to Supabase! 🚀');
      setTimeout(() => setSaveBanner(null), 4000);
    } catch (err) {
      console.error('Error saving config:', err);
      setSaveBanner('Error deploying configuration.');
      setTimeout(() => setSaveBanner(null), 4000);
    }
  };

  const handleTestDraft = async () => {
    if (provider !== 'openrouter') {
      alert('Playground currently supports live OpenRouter testing directly from your browser.');
      return;
    }
    if (!openrouterKey) {
      alert('Please enter an OpenRouter API Key first.');
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
          Authorization: `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://draftpilot-web.vercel.app',
          'X-Title': 'DraftPilot Admin Playground'
        },
        body: JSON.stringify({
          model: activeModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: testThread }
          ],
          temperature: temperature,
          max_tokens: maxTokens
        })
      });

      const data = await response.json();
      const latency = (Date.now() - start) / 1000;
      
      if (data.choices && data.choices[0]) {
        setTestResponse(data.choices[0].message.content);
        setTestMetrics({
          tokens: data.usage?.total_tokens || 0,
          latency: latency
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
          className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between shadow-lg"
        >
          <span>⚡ {saveBanner}</span>
        </motion.div>
      )}

      {/* Section 1: Provider Selection */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { id: 'openrouter', name: 'OpenRouter (Free Models)', desc: 'Llama 3.1, Gemma 2, Mistral, Qwen, Phi-3' },
          { id: 'openai', name: 'OpenAI Direct', desc: 'GPT-4o Mini / GPT-4o' },
          { id: 'offline', name: 'Offline Smart Synthesizer', desc: 'No API Key Required · Smart Fallback' }
        ].map(p => {
          const isSelected = provider === p.id;
          return (
            <div
              key={p.id}
              onClick={() => {
                setProvider(p.id as any);
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
          <h3 className="text-sm font-bold text-text mb-2">
            API Key Configuration ({provider === 'openrouter' ? 'OpenRouter' : 'OpenAI'})
          </h3>
          <p className="text-xs text-text-dim mb-4">
            {provider === 'openrouter'
              ? 'Get a free API key at https://openrouter.ai/keys to access completely free models.'
              : 'Enter your standard OpenAI API key starting with sk-...'}
          </p>
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder={provider === 'openrouter' ? 'sk-or-v1-...' : 'sk-proj-...'}
                value={provider === 'openrouter' ? openrouterKey : openaiKey}
                onChange={(e) => {
                  if (provider === 'openrouter') setOpenrouterKey(e.target.value);
                  else setOpenaiKey(e.target.value);
                  setKeyStatus('untested');
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
            {keyStatus === 'valid' && <span className="text-emerald-400 font-bold">✓ Connected</span>}
            {keyStatus === 'invalid' && <span className="text-red-400 font-bold">✗ Invalid Key</span>}
          </div>
        </div>
      )}

      {/* Section 3: Model Selector (OpenRouter Only) */}
      {provider === 'openrouter' && (
        <div className="p-6 rounded-3xl bg-elevated/70 border border-border/80 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text">Choose OpenRouter Free Model</h3>
            <span className="text-xs text-emerald-400 font-mono font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              100% Free Tiers
            </span>
          </div>
          
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {OPENROUTER_FREE_MODELS.map(m => {
              const isSelected = openrouterModel === m.id && !customOpenrouterModel;
              return (
                <div
                  key={m.id}
                  onClick={() => {
                    setOpenrouterModel(m.id);
                    setCustomOpenrouterModel('');
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-accent/20 border-accent shadow-[0_0_15px_rgba(124,58,237,0.3)]'
                      : 'bg-bg border-border/80 hover:border-accent/40'
                  }`}
                >
                  <div className="text-[10px] text-accent-light font-bold mb-1">{m.badge}</div>
                  <div className="text-xs font-bold text-text mb-0.5">{m.name}</div>
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
              placeholder="e.g. meta-llama/llama-3.3-70b-instruct:free or mistralai/mistral-large"
              value={customOpenrouterModel}
              onChange={(e) => setCustomOpenrouterModel(e.target.value)}
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
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
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
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
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
              onChange={(e) => setSystemPrompt(e.target.value)}
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
                    <span className="font-mono text-emerald-400">Tokens: {testMetrics.tokens} • {testMetrics.latency.toFixed(2)}s</span>
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
