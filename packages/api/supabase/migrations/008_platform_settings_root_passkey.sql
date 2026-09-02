-- Migration 008: Add root_passkey column to platform_settings singleton table
-- Allows dynamic in-panel viewing and changing of the Super Admin Root Passkey without server restarts.

ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS root_passkey TEXT;

COMMENT ON COLUMN platform_settings.root_passkey IS 'Dynamic Root Passkey for Super Admin access. Takes precedence over ADMIN_PASSKEY env var when set.';
