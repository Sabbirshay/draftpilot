-- Migration 003: Strict Multi-Tenant Row Level Security (RLS)
-- Ensures full isolation between teams and blocks unauthorized anon access

-- Drop previous open policies if existing
DROP POLICY IF EXISTS "Service Role Full Access on Teams" ON teams;
DROP POLICY IF EXISTS "Service Role Full Access on Users" ON users;
DROP POLICY IF EXISTS "Service Role Full Access on Macros" ON macros;
DROP POLICY IF EXISTS "Service Role Full Access on Knowledge Docs" ON knowledge_documents;
DROP POLICY IF EXISTS "Service Role Full Access on Document Chunks" ON document_chunks;
DROP POLICY IF EXISTS "Service Role Full Access on Usage" ON usage;
DROP POLICY IF EXISTS "Service Role Full Access on Draft History" ON draft_history;
DROP POLICY IF EXISTS "Service Role Full Access on Team Members" ON team_members;
DROP POLICY IF EXISTS "Service Role Full Access on Onboarding State" ON onboarding_state;

-- 1. Service Role full bypass (for backend microservices)
CREATE POLICY "Service Role Full Access on Teams" ON teams TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access on Users" ON users TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access on Macros" ON macros TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access on Knowledge Docs" ON knowledge_documents TO service_role USING (true);
CREATE POLICY "Service Role Full Access on Document Chunks" ON document_chunks TO service_role USING (true);
CREATE POLICY "Service Role Full Access on Usage" ON usage TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access on Draft History" ON draft_history TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access on Team Members" ON team_members TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access on Onboarding State" ON onboarding_state TO service_role USING (true) WITH CHECK (true);

-- 2. Authenticated User Multi-Tenant Scoped Access
CREATE POLICY "Users can access team macros" ON macros
  FOR ALL TO authenticated
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()))
  WITH CHECK (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can access team knowledge docs" ON knowledge_documents
  FOR ALL TO authenticated
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()))
  WITH CHECK (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can view team members" ON users
  FOR SELECT TO authenticated
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can view team draft history" ON draft_history
  FOR ALL TO authenticated
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()))
  WITH CHECK (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can view team onboarding state" ON onboarding_state
  FOR ALL TO authenticated
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()))
  WITH CHECK (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));
