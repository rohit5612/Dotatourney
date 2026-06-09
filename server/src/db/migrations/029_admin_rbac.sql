-- Season 2 Phase 6: admin RBAC and audit log

ALTER TABLE admin_users
ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY,
  admin_user_id UUID REFERENCES admin_users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON audit_log (admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity_type, entity_id);

-- Superadmins retain full access via role check; seed default permissions for approved admins
UPDATE admin_users
SET permissions = '["registrations.view","registrations.edit"]'::jsonb
WHERE role = 'admin'
  AND status = 'approved'
  AND permissions = '[]'::jsonb;
