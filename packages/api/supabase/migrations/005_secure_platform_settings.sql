-- Migration 005: Restrict Platform Settings RLS to Service Role Only
-- Prevents authenticated users from reading plaintext OpenRouter/OpenAI API keys.

-- 1. Remove public/authenticated SELECT policy
DROP POLICY IF EXISTS "Authenticated can read platform settings" ON platform_settings;
DROP POLICY IF EXISTS "Service Role Full Access on Platform Settings" ON platform_settings;

-- 2. Restrict full access strictly to service_role (backend servers and Next.js edge API routes)
CREATE POLICY "Service Role Full Access on Platform Settings"
  ON platform_settings
  TO service_role
  USING (true)
  WITH CHECK (true);
