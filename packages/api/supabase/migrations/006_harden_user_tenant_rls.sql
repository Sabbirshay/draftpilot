-- Migration 006: Harden User Tenant Isolation & Team Creation RLS
-- 1. Prevent authenticated users from escalating privileges or taking over other tenant workspaces by mutating team_id or role
-- 2. Prevent arbitrary plan / draft limit manipulation during team creation

-- 1. Hardened Users Table UPDATE Policy
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() 
    AND team_id = (SELECT team_id FROM users WHERE id = auth.uid())
    AND role = (SELECT role FROM users WHERE id = auth.uid())
  );

-- 2. Hardened Teams Table INSERT Policy
DROP POLICY IF EXISTS "Users can insert team" ON teams;
CREATE POLICY "Users can insert team" ON teams
  FOR INSERT TO authenticated
  WITH CHECK (
    plan = 'free' 
    AND monthly_draft_limit = 50 
    AND stripe_customer_id IS NULL 
    AND stripe_subscription_id IS NULL
  );
