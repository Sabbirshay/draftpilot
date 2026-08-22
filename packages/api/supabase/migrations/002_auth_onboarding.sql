-- Migration 002: Auth & Onboarding Schema
-- Add profile columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Team Members junction table (supports multi-team in future)
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Onboarding State (per team)
CREATE TABLE IF NOT EXISTS onboarding_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE UNIQUE,
  gmail_connected BOOLEAN NOT NULL DEFAULT false,
  first_macro_added BOOLEAN NOT NULL DEFAULT false,
  extension_installed BOOLEAN NOT NULL DEFAULT false,
  viewed_demo BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_state_team ON onboarding_state(team_id);

-- RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service Role Full Access on Team Members" ON team_members FOR ALL USING (true);
CREATE POLICY "Service Role Full Access on Onboarding State" ON onboarding_state FOR ALL USING (true);

-- Backfill: create team_members rows for existing users
INSERT INTO team_members (team_id, user_id, role)
SELECT team_id, id, role FROM users
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Backfill: create onboarding_state for existing teams
INSERT INTO onboarding_state (team_id)
SELECT id FROM teams
ON CONFLICT (team_id) DO NOTHING;
