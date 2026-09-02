-- Migration 007: Persistent Banned Emails Registry & Access Control
-- Prevents deleted / banned users from accessing DraftPilot, registering, logging in, or generating drafts until explicitly restored by Super Admin.

CREATE TABLE IF NOT EXISTS banned_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  reason TEXT DEFAULT 'Banned by Super Admin',
  banned_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_banned_emails_lower_email ON banned_emails (LOWER(email));

ALTER TABLE banned_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service Role Full Access on Banned Emails"
  ON banned_emails
  TO service_role
  USING (true)
  WITH CHECK (true);
