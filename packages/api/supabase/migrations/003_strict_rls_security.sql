-- Migration 003: Strict Multi-Tenant Row Level Security (RLS)
-- Prevents infinite recursion by using non-recursive direct user matching on the users table

-- 1. Drop existing policies to cleanly replace them
DROP POLICY IF EXISTS "Service Role Full Access on Teams" ON teams;
DROP POLICY IF EXISTS "Service Role Full Access on Users" ON users;
DROP POLICY IF EXISTS "Service Role Full Access on Macros" ON macros;
DROP POLICY IF EXISTS "Service Role Full Access on Knowledge Docs" ON knowledge_documents;
DROP POLICY IF EXISTS "Service Role Full Access on Document Chunks" ON document_chunks;
DROP POLICY IF EXISTS "Service Role Full Access on Usage" ON usage;
DROP POLICY IF EXISTS "Service Role Full Access on Draft History" ON draft_history;
DROP POLICY IF EXISTS "Service Role Full Access on Team Members" ON team_members;
DROP POLICY IF EXISTS "Service Role Full Access on Onboarding State" ON onboarding_state;

DROP POLICY IF EXISTS "Users can view team members" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can access team macros" ON macros;
DROP POLICY IF EXISTS "Users can access team knowledge docs" ON knowledge_documents;
DROP POLICY IF EXISTS "Users can view team draft history" ON draft_history;
DROP POLICY IF EXISTS "Users can view team onboarding state" ON onboarding_state;

-- 2. Service Role Full Access (backend operations & serverless workers)
CREATE POLICY "Service Role Full Access on Teams" ON teams TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access on Users" ON users TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access on Macros" ON macros TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access on Knowledge Docs" ON knowledge_documents TO service_role USING (true);
CREATE POLICY "Service Role Full Access on Document Chunks" ON document_chunks TO service_role USING (true);
CREATE POLICY "Service Role Full Access on Usage" ON usage TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access on Draft History" ON draft_history TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access on Team Members" ON team_members TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access on Onboarding State" ON onboarding_state TO service_role USING (true) WITH CHECK (true);

-- 3. Users Table (Direct non-recursive matching on auth.uid())
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 4. Teams Table
DROP POLICY IF EXISTS "Users can insert team" ON teams;
DROP POLICY IF EXISTS "Users can view team" ON teams;
CREATE POLICY "Users can insert team" ON teams
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view team" ON teams
  FOR SELECT TO authenticated
  USING (id IN (SELECT team_id FROM users WHERE id = auth.uid()));

-- 5. Macros Table
CREATE POLICY "Users can access team macros" ON macros
  FOR ALL TO authenticated
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()))
  WITH CHECK (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

-- 6. Knowledge Documents Table
CREATE POLICY "Users can access team knowledge docs" ON knowledge_documents
  FOR ALL TO authenticated
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()))
  WITH CHECK (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

-- 7. Document Chunks Table
CREATE POLICY "Users can access team document chunks" ON document_chunks
  FOR ALL TO authenticated
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()))
  WITH CHECK (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

-- 8. Draft History Table
CREATE POLICY "Users can view team draft history" ON draft_history
  FOR ALL TO authenticated
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()))
  WITH CHECK (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

-- 9. Onboarding State Table
CREATE POLICY "Users can view team onboarding state" ON onboarding_state
  FOR ALL TO authenticated
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()))
  WITH CHECK (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));
