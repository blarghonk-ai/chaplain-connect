-- ============================================================
-- Phase 5C: DataAgent, RetentionAgent, DSARAgent
-- ============================================================

-- ── data_violations ──────────────────────────────────────────
-- DataAgent column-level findings. One row per detected violation.
-- The agent scans data_locations metadata for dangerous patterns —
-- CVV/PAN column names, unencrypted PII, missing legal basis, etc.

CREATE TABLE data_violations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id     uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  data_location_id uuid REFERENCES data_locations(id) ON DELETE SET NULL,
  violation_type   text NOT NULL,
  -- 'cvv_column' | 'pan_column' | 'ssn_column' | 'unencrypted_pii'
  -- | 'missing_legal_basis' | 'pii_in_logs' | 'excessive_retention'
  severity         decision_severity NOT NULL DEFAULT 'high',
  table_name       text,
  column_name      text,
  description      text NOT NULL,
  status           text NOT NULL DEFAULT 'open',
  -- 'open' | 'in_remediation' | 'resolved' | 'dismissed'
  resolution_notes text,
  resolved_at      timestamptz,
  resolved_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  detected_at      timestamptz NOT NULL DEFAULT now(),
  metadata         jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE data_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin only" ON data_violations
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE INDEX idx_data_violations_status ON data_violations(status) WHERE status = 'open';
CREATE INDEX idx_data_violations_severity ON data_violations(severity, status);
CREATE INDEX idx_data_violations_location ON data_violations(data_location_id);

-- ── retention_policies ────────────────────────────────────────
-- Per data-category retention rules. RetentionAgent reads these
-- to identify data past its retention window.

CREATE TABLE retention_policies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_category  text NOT NULL UNIQUE,
  retention_days int NOT NULL,
  legal_basis    text,
  regulation_refs text[] DEFAULT '{}',
  auto_delete    boolean NOT NULL DEFAULT false,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin only" ON retention_policies
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Seed retention policies for every data_category enum value
INSERT INTO retention_policies (data_category, retention_days, legal_basis, regulation_refs, notes) VALUES
  ('contact_info',        1095, 'contract',            ARRAY['GDPR','CCPA'],             'Standard 3-year retention for active user accounts'),
  ('authentication_data', 365,  'legitimate_interests', ARRAY['GDPR','HIPAA'],            'Passwords/tokens rotated annually; logs purged at 1 year'),
  ('session_data',        90,   'legitimate_interests', ARRAY['GDPR'],                    'Session logs retained 90 days for debugging then purged'),
  ('message_content',     730,  'contract',            ARRAY['GDPR','HIPAA'],            'Chaplain conversations retained 2 years per ministry policy'),
  ('health_data',         2190, 'legal_obligation',    ARRAY['HIPAA','GDPR'],            'HIPAA mandates 6-year minimum; retain 6 years from creation'),
  ('financial_data',      2555, 'legal_obligation',    ARRAY['GDPR','CCPA','SOX'],       'PCI-DSS + tax records: 7 years minimum'),
  ('behavioral_data',     180,  'consent',             ARRAY['GDPR','CCPA'],             'Analytics data retained 6 months with consent'),
  ('device_data',         365,  'legitimate_interests', ARRAY['GDPR'],                    'Device fingerprints and UA strings purged after 1 year'),
  ('location_data',       90,   'consent',             ARRAY['GDPR','CCPA'],             'Precise location data purged at 90 days'),
  ('media_content',       1825, 'contract',            ARRAY['GDPR'],                    'Video/audio uploaded by users retained 5 years'),
  ('org_data',            3650, 'contract',            ARRAY['GDPR','HIPAA'],            'Organization-level records retained 10 years for audit trail');

-- ── data_deletion_proposals ───────────────────────────────────
-- RetentionAgent proposes deletion batches. Humans approve.
-- No data is ever deleted without an approved proposal.

CREATE TABLE data_deletion_proposals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id     uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  data_location_id uuid REFERENCES data_locations(id) ON DELETE SET NULL,
  data_category    text NOT NULL,
  description      text NOT NULL,
  record_count     int,
  oldest_record_at timestamptz,
  policy_days      int NOT NULL,
  status           text NOT NULL DEFAULT 'pending',
  -- 'pending' | 'approved' | 'rejected' | 'executed'
  approved_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at      timestamptz,
  rejected_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  rejected_at      timestamptz,
  rejection_reason text,
  executed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE data_deletion_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin only" ON data_deletion_proposals
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE INDEX idx_deletion_proposals_status ON data_deletion_proposals(status) WHERE status = 'pending';

-- ── data_deletion_receipts ────────────────────────────────────
-- Cryptographically signed proof that data was deleted.
-- Required for GDPR Art.17, HIPAA, and DSARs.

CREATE TABLE data_deletion_receipts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id      uuid REFERENCES data_deletion_proposals(id) ON DELETE SET NULL,
  dsar_request_id  uuid,
  data_category    text NOT NULL,
  table_name       text,
  record_count     int NOT NULL DEFAULT 0,
  deleted_at       timestamptz NOT NULL DEFAULT now(),
  deletion_hash    text NOT NULL,
  -- SHA-256 of: proposal_id + deleted_at.toISO() + record_count
  signed_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  receipt_data     jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE data_deletion_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin only" ON data_deletion_receipts
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ── dsar_requests ─────────────────────────────────────────────
-- Data Subject Access Requests (GDPR Art.15-22, CCPA, etc.)
-- DSARAgent monitors SLAs and escalates approaching/overdue requests.

CREATE TABLE dsar_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES organizations(id) ON DELETE SET NULL,
  subject_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  subject_email   text NOT NULL,
  request_type    text NOT NULL DEFAULT 'access',
  -- 'access' | 'erasure' | 'portability' | 'correction' | 'restriction' | 'objection'
  regulation_ref  text,              -- 'GDPR' | 'CCPA' | 'LGPD' etc.
  status          text NOT NULL DEFAULT 'pending',
  -- 'pending' | 'in_progress' | 'completed' | 'rejected' | 'overdue'
  received_at     timestamptz NOT NULL DEFAULT now(),
  due_at          timestamptz NOT NULL DEFAULT now() + interval '30 days',
  completed_at    timestamptz,
  notes           text,
  rejection_reason text,
  assigned_to     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dsar_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin only" ON dsar_requests
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE INDEX idx_dsar_status ON dsar_requests(status, due_at);
CREATE INDEX idx_dsar_due ON dsar_requests(due_at) WHERE status NOT IN ('completed', 'rejected');

-- ── dsar_exports ──────────────────────────────────────────────
-- Generated data export packages per DSAR request.

CREATE TABLE dsar_exports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dsar_request_id  uuid NOT NULL REFERENCES dsar_requests(id) ON DELETE CASCADE,
  export_format    text NOT NULL DEFAULT 'json',
  data_categories  text[] DEFAULT '{}',
  record_count     int NOT NULL DEFAULT 0,
  export_url       text,
  export_hash      text,
  generated_at     timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz DEFAULT now() + interval '7 days',
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dsar_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin only" ON dsar_exports
  USING (is_super_admin()) WITH CHECK (is_super_admin());
