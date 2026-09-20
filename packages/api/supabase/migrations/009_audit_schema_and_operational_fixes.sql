-- Migration 009: Audit Schema Fixes, Operational Durability & Security Hardening
-- Adds missing columns, persistent global macros catalog, support tickets, and atomic usage RPC

-- 1. Missing columns on existing tables
ALTER TABLE teams ADD COLUMN IF NOT EXISTS billing_cadence TEXT DEFAULT 'monthly' CHECK (billing_cadence IN ('monthly', 'yearly'));
ALTER TABLE teams ADD COLUMN IF NOT EXISTS custom_pii_rules JSONB DEFAULT '[]';

ALTER TABLE onboarding_state ADD COLUMN IF NOT EXISTS first_draft_generated BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '[]';

-- 2. Persistent Global Macros Catalog (Admin-managed system templates)
CREATE TABLE IF NOT EXISTS global_macros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  tags TEXT[] DEFAULT '{}',
  content TEXT NOT NULL,
  adoption_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE global_macros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service Role Full Access on Global Macros"
  ON global_macros
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can read global macros"
  ON global_macros
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Persistent Support Tickets Table
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  category TEXT,
  priority TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service Role Full Access on Support Tickets"
  ON support_tickets
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Atomic Team Usage Increment Function (prevents read-then-write concurrency races)
CREATE OR REPLACE FUNCTION increment_team_usage(p_team_id UUID, p_month DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO usage (team_id, month, draft_count)
  VALUES (p_team_id, p_month, 1)
  ON CONFLICT (team_id, month)
  DO UPDATE SET draft_count = usage.draft_count + 1
  RETURNING draft_count INTO v_count;
  
  RETURN v_count;
END;
$$;

-- 5. Hardened User Profile Insertion Policy
-- Prevents clients from inserting arbitrary roles like 'superadmin' or 'admin' during client-side profile insertion
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND role IN ('owner', 'member')
  );
