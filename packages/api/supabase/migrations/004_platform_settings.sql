-- Platform-wide AI configuration (singleton row managed by SuperAdmin)
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_provider TEXT NOT NULL DEFAULT 'openrouter' CHECK (ai_provider IN ('openrouter', 'openai', 'anthropic', 'offline')),
  openrouter_api_key TEXT,
  openrouter_model TEXT DEFAULT 'meta-llama/llama-3.1-8b-instruct:free',
  openai_api_key TEXT,
  anthropic_api_key TEXT,
  selected_model TEXT DEFAULT 'meta-llama/llama-3.1-8b-instruct:free',
  system_prompt TEXT DEFAULT 'You are DraftPilot, an intelligent AI reply assistant for customer support. Generate a calm, polite, and concise reply based strictly on the provided thread and matched team macros. Do not make up facts or policies not in the macros. Maintain a warm, human, and professional tone. Output ONLY the reply text, no preamble or meta-commentary.',
  temperature NUMERIC(3,2) DEFAULT 0.4,
  max_tokens INTEGER DEFAULT 300,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service Role Full Access on Platform Settings" ON platform_settings TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can read platform settings" ON platform_settings FOR SELECT TO authenticated USING (true);
