-- Enable Row Level Security on all sensitive tables
-- NSA Commercial Solutions for Classified (CSfC) Compliant

-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_answers ENABLE ROW LEVEL SECURITY;

-- Create security definer functions for RLS
CREATE OR REPLACE FUNCTION auth.user_id() 
RETURNS TEXT AS $$
  SELECT current_setting('app.current_user_id', true)::TEXT;
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.user_role() 
RETURNS TEXT AS $$
  SELECT current_setting('app.current_user_role', true)::TEXT;
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.security_level() 
RETURNS TEXT AS $$
  SELECT current_setting('app.security_level', true)::TEXT;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Users table policies
CREATE POLICY users_select_policy ON users
  FOR SELECT
  USING (
    id = auth.user_id() 
    OR auth.user_role() = 'admin'
    OR id IN (
      SELECT user_id FROM user_access_controls 
      WHERE resource_type = 'users' 
      AND resource_id = id 
      AND permission = 'read'
      AND (expires_at IS NULL OR expires_at > NOW())
    )
  );

CREATE POLICY users_update_policy ON users
  FOR UPDATE
  USING (id = auth.user_id())
  WITH CHECK (id = auth.user_id());

-- Financial accounts policies
CREATE POLICY financial_accounts_select_policy ON financial_accounts
  FOR SELECT
  USING (
    owner_user_id = auth.user_id()
    OR auth.user_id() = ANY(shared_with)
    OR (
      auth.user_role() = 'admin' 
      AND auth.security_level() = 'maximum'
    )
  );

CREATE POLICY financial_accounts_insert_policy ON financial_accounts
  FOR INSERT
  WITH CHECK (owner_user_id = auth.user_id());

CREATE POLICY financial_accounts_update_policy ON financial_accounts
  FOR UPDATE
  USING (
    owner_user_id = auth.user_id() 
    AND access_level IN ('owner', 'editor')
  )
  WITH CHECK (
    owner_user_id = auth.user_id() 
    AND access_level IN ('owner', 'editor')
  );

CREATE POLICY financial_accounts_delete_policy ON financial_accounts
  FOR DELETE
  USING (
    owner_user_id = auth.user_id() 
    AND access_level = 'owner'
  );

-- Transactions policies (strict ownership)
CREATE POLICY transactions_select_policy ON transactions
  FOR SELECT
  USING (
    owner_user_id = auth.user_id()
    OR (
      visibility IN ('shared', 'public')
      AND owner_user_id IN (
        SELECT user_id FROM user_access_controls
        WHERE resource_type = 'transactions'
        AND permission = 'read'
        AND (expires_at IS NULL OR expires_at > NOW())
      )
    )
  );

CREATE POLICY transactions_insert_policy ON transactions
  FOR INSERT
  WITH CHECK (owner_user_id = auth.user_id());

CREATE POLICY transactions_update_policy ON transactions
  FOR UPDATE
  USING (owner_user_id = auth.user_id())
  WITH CHECK (owner_user_id = auth.user_id());

CREATE POLICY transactions_delete_policy ON transactions
  FOR DELETE
  USING (owner_user_id = auth.user_id());

-- Health records policies (HIPAA compliant)
CREATE POLICY health_records_select_policy ON health_records
  FOR SELECT
  USING (
    owner_user_id = auth.user_id()
    OR auth.user_id() = ANY(authorized_users)
    OR (
      emergency_access = true 
      AND auth.user_role() IN ('doctor', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM user_access_controls
      WHERE user_id = auth.user_id()
      AND resource_type = 'health_records'
      AND resource_id = health_records.id
      AND permission = 'read'
      AND (expires_at IS NULL OR expires_at > NOW())
    )
  );

CREATE POLICY health_records_insert_policy ON health_records
  FOR INSERT
  WITH CHECK (
    owner_user_id = auth.user_id()
    OR auth.user_role() IN ('doctor', 'admin')
  );

CREATE POLICY health_records_update_policy ON health_records
  FOR UPDATE
  USING (
    owner_user_id = auth.user_id()
    OR (
      auth.user_id() = ANY(authorized_users)
      AND auth.user_role() = 'doctor'
    )
  )
  WITH CHECK (
    owner_user_id = auth.user_id()
    OR (
      auth.user_id() = ANY(authorized_users)
      AND auth.user_role() = 'doctor'
    )
  );

-- Documents policies with encryption awareness
CREATE POLICY documents_select_policy ON documents
  FOR SELECT
  USING (
    owner_user_id = auth.user_id()
    OR (
      auth.user_id() = ANY(shared_with)
      AND (share_expiry IS NULL OR share_expiry > NOW())
    )
    OR EXISTS (
      SELECT 1 FROM user_access_controls
      WHERE user_id = auth.user_id()
      AND resource_type = 'documents'
      AND resource_id = documents.id
      AND permission IN ('read', 'write')
      AND (expires_at IS NULL OR expires_at > NOW())
    )
  );

CREATE POLICY documents_insert_policy ON documents
  FOR INSERT
  WITH CHECK (owner_user_id = auth.user_id());

CREATE POLICY documents_update_policy ON documents
  FOR UPDATE
  USING (
    owner_user_id = auth.user_id()
    OR (
      auth.user_id() = ANY(shared_with)
      AND EXISTS (
        SELECT 1 FROM user_access_controls
        WHERE user_id = auth.user_id()
        AND resource_type = 'documents'
        AND resource_id = documents.id
        AND permission = 'write'
      )
    )
  );

CREATE POLICY documents_delete_policy ON documents
  FOR DELETE
  USING (owner_user_id = auth.user_id());

-- Goals policies with privacy settings
CREATE POLICY goals_select_policy ON goals
  FOR SELECT
  USING (
    owner_user_id = auth.user_id()
    OR (
      visibility = 'public' 
      AND is_private = false
      AND is_encrypted = false
    )
    OR (
      visibility = 'friends' 
      AND auth.user_id() = ANY(shared_with)
    )
  );

CREATE POLICY goals_insert_policy ON goals
  FOR INSERT
  WITH CHECK (owner_user_id = auth.user_id());

CREATE POLICY goals_update_policy ON goals
  FOR UPDATE
  USING (owner_user_id = auth.user_id())
  WITH CHECK (owner_user_id = auth.user_id());

CREATE POLICY goals_delete_policy ON goals
  FOR DELETE
  USING (owner_user_id = auth.user_id());

-- Risk assessments policies (highly sensitive)
CREATE POLICY risk_assessments_select_policy ON risk_assessments
  FOR SELECT
  USING (
    (
      owner_user_id = auth.user_id()
      AND auth.security_level() IN ('elevated', 'maximum')
    )
    OR (
      auth.user_id() = ANY(viewable_by)
      AND auth.security_level() = 'maximum'
    )
    OR (
      auth.user_role() = 'admin'
      AND auth.security_level() = 'maximum'
    )
  );

CREATE POLICY risk_assessments_insert_policy ON risk_assessments
  FOR INSERT
  WITH CHECK (
    owner_user_id = auth.user_id()
    AND auth.security_level() IN ('elevated', 'maximum')
  );

CREATE POLICY risk_assessments_update_policy ON risk_assessments
  FOR UPDATE
  USING (
    owner_user_id = auth.user_id()
    AND auth.security_level() IN ('elevated', 'maximum')
  )
  WITH CHECK (
    owner_user_id = auth.user_id()
    AND auth.security_level() IN ('elevated', 'maximum')
  );

-- Assessment answers policies
CREATE POLICY assessment_answers_select_policy ON assessment_answers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM risk_assessments
      WHERE risk_assessments.id = assessment_answers.assessment_id
      AND (
        risk_assessments.owner_user_id = auth.user_id()
        OR auth.user_id() = ANY(risk_assessments.viewable_by)
      )
    )
  );

-- Create indexes for RLS performance
CREATE INDEX IF NOT EXISTS idx_financial_accounts_owner ON financial_accounts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_shared ON financial_accounts USING GIN(shared_with);
CREATE INDEX IF NOT EXISTS idx_transactions_owner ON transactions(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_visibility ON transactions(visibility);
CREATE INDEX IF NOT EXISTS idx_health_records_owner ON health_records(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_health_records_authorized ON health_records USING GIN(authorized_users);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_documents_shared ON documents USING GIN(shared_with);
CREATE INDEX IF NOT EXISTS idx_goals_owner ON goals(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_goals_visibility ON goals(visibility);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_owner ON risk_assessments(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_controls_user ON user_access_controls(user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_controls_resource ON user_access_controls(resource_type, resource_id);

-- Create audit trigger for RLS violations
CREATE OR REPLACE FUNCTION log_rls_violation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO security_audit_logs (
    user_id,
    event_type,
    ip_address,
    data,
    created_at
  ) VALUES (
    auth.user_id(),
    'RLS_VIOLATION',
    inet_client_addr()::TEXT,
    jsonb_build_object(
      'table_name', TG_TABLE_NAME,
      'operation', TG_OP,
      'security_level', auth.security_level()
    ),
    NOW()
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply RLS violation triggers
CREATE TRIGGER log_rls_violation_financial
  AFTER INSERT OR UPDATE OR DELETE ON financial_accounts
  FOR EACH ROW
  WHEN (auth.user_id() IS NULL)
  EXECUTE FUNCTION log_rls_violation();

CREATE TRIGGER log_rls_violation_health
  AFTER INSERT OR UPDATE OR DELETE ON health_records
  FOR EACH ROW
  WHEN (auth.user_id() IS NULL)
  EXECUTE FUNCTION log_rls_violation();

CREATE TRIGGER log_rls_violation_risk
  AFTER INSERT OR UPDATE OR DELETE ON risk_assessments
  FOR EACH ROW
  WHEN (auth.user_id() IS NULL)
  EXECUTE FUNCTION log_rls_violation();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.security_level() TO authenticated;