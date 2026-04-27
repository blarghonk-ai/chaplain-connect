-- ============================================================
-- Phase 4: Data Lineage & Privacy Governance
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

CREATE TYPE data_category AS ENUM (
  'contact_info',
  'authentication_data',
  'session_data',
  'message_content',
  'health_data',
  'financial_data',
  'behavioral_data',
  'device_data',
  'location_data',
  'media_content',
  'org_data'
);

CREATE TYPE legal_basis_type AS ENUM (
  'consent',
  'contract',
  'legal_obligation',
  'vital_interests',
  'public_task',
  'legitimate_interests'
);

CREATE TYPE storage_system_type AS ENUM (
  'postgres',
  'supabase_storage',
  'r2',
  'mux',
  'livekit'
);

CREATE TYPE assessment_type AS ENUM (
  'ropa',
  'pia',
  'dpia',
  'tia'
);

CREATE TYPE assessment_status AS ENUM (
  'draft',
  'in_review',
  'approved',
  'archived'
);

-- ── data_locations ───────────────────────────────────────────
-- The master index of every PII field in the system.
-- Populated by application hooks + OpenMetadata scans.

CREATE TABLE data_locations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid REFERENCES organizations(id) ON DELETE SET NULL,  -- NULL = platform-level data
  subject_type     text NOT NULL DEFAULT 'user',   -- 'user' | 'org' | 'external'
  data_category    data_category NOT NULL,
  storage_system   storage_system_type NOT NULL DEFAULT 'postgres',
  database_name    text NOT NULL DEFAULT 'supabase_prod',
  schema_name      text NOT NULL DEFAULT 'public',
  table_name       text NOT NULL,
  column_name      text,                            -- NULL for file-based storage
  storage_path     text,                            -- for object storage
  description      text,
  is_pii           boolean NOT NULL DEFAULT true,
  is_encrypted     boolean NOT NULL DEFAULT false,
  legal_basis      legal_basis_type NOT NULL DEFAULT 'legitimate_interests',
  retention_days   int NOT NULL DEFAULT 365,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  notes            text
);

-- ── privacy_assessments ──────────────────────────────────────
-- ROPA, PIA, DPIA, TIA records.

CREATE TABLE privacy_assessments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_type assessment_type NOT NULL,
  title           text NOT NULL,
  description     text,
  status          assessment_status NOT NULL DEFAULT 'draft',
  owner_id        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  approved_at     timestamptz,
  approved_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  due_date        date,
  linked_controls text[] DEFAULT '{}',   -- array of grc_control IDs
  metadata        jsonb NOT NULL DEFAULT '{}'
);

-- ── privacy_assessment_sections ──────────────────────────────
-- Structured Q&A / form sections for each assessment.

CREATE TABLE privacy_assessment_sections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES privacy_assessments(id) ON DELETE CASCADE,
  section_key   text NOT NULL,   -- e.g. 'purpose', 'data_categories', 'recipients'
  section_title text NOT NULL,
  content       text,
  is_complete   boolean NOT NULL DEFAULT false,
  sort_order    int NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── RLS Policies ─────────────────────────────────────────────
ALTER TABLE data_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_assessment_sections ENABLE ROW LEVEL SECURITY;

-- Only super_admins can read/write privacy data
CREATE POLICY "super_admin only" ON data_locations
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "super_admin only" ON privacy_assessments
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "super_admin only" ON privacy_assessment_sections
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_data_locations_table ON data_locations(table_name);
CREATE INDEX idx_data_locations_category ON data_locations(data_category);
CREATE INDEX idx_data_locations_org ON data_locations(org_id);
CREATE INDEX idx_privacy_assessments_type ON privacy_assessments(assessment_type);
CREATE INDEX idx_privacy_assessments_status ON privacy_assessments(status);
CREATE INDEX idx_privacy_sections_assessment ON privacy_assessment_sections(assessment_id);

-- ── Seed: Known data locations from existing schema ──────────
-- Every PII column in our platform, mapped for compliance.

INSERT INTO data_locations
  (data_category, storage_system, table_name, column_name, description,
   is_pii, is_encrypted, legal_basis, retention_days)
VALUES
  -- auth.users (managed by Supabase, not directly accessible via RLS)
  ('contact_info', 'postgres', 'auth.users', 'email',
   'Primary email address used for authentication',
   true, false, 'contract', 2555),
  ('authentication_data', 'postgres', 'auth.users', 'encrypted_password',
   'Bcrypt-hashed password (never stored in plaintext)',
   true, true, 'contract', 2555),
  ('device_data', 'postgres', 'auth.users', 'last_sign_in_at',
   'Timestamp of most recent authentication event',
   false, false, 'legitimate_interests', 365),

  -- profiles
  ('contact_info', 'postgres', 'profiles', 'full_name',
   'User full name for display and identification',
   true, false, 'contract', 2555),
  ('contact_info', 'postgres', 'profiles', 'avatar_url',
   'Profile picture URL (stored in Supabase Storage)',
   true, false, 'consent', 2555),
  ('org_data', 'postgres', 'profiles', 'role',
   'Platform role assignment (chaplain, org_admin, etc.)',
   false, false, 'contract', 2555),

  -- invitations
  ('contact_info', 'postgres', 'invitations', 'email',
   'Email address of pending org invitation recipient',
   true, false, 'legitimate_interests', 30),

  -- messages (real-time chat)
  ('message_content', 'postgres', 'messages', 'content',
   'Real-time chat message body — may contain sensitive pastoral content',
   true, false, 'contract', 365),
  ('behavioral_data', 'postgres', 'messages', 'created_at',
   'Timestamp of chat message — used for activity analysis',
   false, false, 'legitimate_interests', 365),

  -- ai_messages
  ('message_content', 'postgres', 'ai_messages', 'content',
   'AI assistant conversation — chaplain-client pastoral content',
   true, false, 'consent', 365),

  -- sessions
  ('session_data', 'postgres', 'sessions', 'title',
   'Title of chaplain session — may include identifying context',
   false, false, 'contract', 1095),
  ('behavioral_data', 'postgres', 'sessions', 'scheduled_at',
   'Session booking timestamp — reveals user activity patterns',
   false, false, 'legitimate_interests', 1095),

  -- audit_logs
  ('behavioral_data', 'postgres', 'audit_logs', 'action',
   'Action type recorded in tamper-evident audit trail',
   false, false, 'legal_obligation', 2555),
  ('behavioral_data', 'postgres', 'audit_logs', 'metadata',
   'JSONB metadata for audited action — may contain resource identifiers',
   false, false, 'legal_obligation', 2555),
  ('device_data', 'postgres', 'audit_logs', 'user_id',
   'User identifier for audit trail — links actions to identities',
   true, false, 'legal_obligation', 2555),

  -- subscriptions (Stripe)
  ('financial_data', 'postgres', 'subscriptions', 'stripe_subscription_id',
   'Stripe subscription identifier — links to payment processor',
   true, false, 'contract', 3650),
  ('financial_data', 'postgres', 'organizations', 'stripe_customer_id',
   'Stripe customer identifier — links org to payment processor',
   true, false, 'contract', 3650),

  -- Supabase Storage
  ('media_content', 'supabase_storage', 'avatars', NULL,
   'User avatar images — linked to user identity',
   true, false, 'consent', 2555),
  ('media_content', 'supabase_storage', 'attachments', NULL,
   'Chat and post file attachments — may contain sensitive files',
   true, false, 'contract', 365);

-- ── Seed: Default ROPA assessment ────────────────────────────
INSERT INTO privacy_assessments
  (assessment_type, title, description, status, linked_controls)
VALUES (
  'ropa',
  'Chaplain Connect Platform — GDPR Article 30 ROPA',
  'Records of Processing Activities for the Chaplain Connect SaaS platform, covering all personal data processing activities across all customer organizations.',
  'draft',
  ARRAY[]::text[]
);

-- Get the ROPA id we just created
DO $$
DECLARE
  v_ropa_id uuid;
BEGIN
  SELECT id INTO v_ropa_id FROM privacy_assessments
  WHERE assessment_type = 'ropa'
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO privacy_assessment_sections
    (assessment_id, section_key, section_title, content, sort_order)
  VALUES
    (v_ropa_id, 'controller', 'Data Controller',
     'Chaplain Connect, LLC (or applicable legal entity). Contact: privacy@chaplainconnect.com',
     1),
    (v_ropa_id, 'purposes', 'Purposes of Processing',
     'Delivery of remote chaplaincy and ministry services; user authentication and account management; billing and subscription management; audit logging for compliance; AI-assisted chaplain support via Groq API.',
     2),
    (v_ropa_id, 'data_categories', 'Categories of Personal Data',
     'Contact information (email, full name); authentication credentials (hashed passwords); session and appointment data; chat message content (pastoral communications); AI conversation content; behavioral data (audit logs, login history); financial identifiers (Stripe IDs); device/access data (timestamps, user agents).',
     3),
    (v_ropa_id, 'recipients', 'Categories of Recipients',
     'Supabase (database, auth, storage — HIPAA BAA available on Pro plan); Vercel (hosting — HIPAA BAA available on Enterprise); Groq (AI inference — review data processing agreement); Stripe (payment processing — PCI DSS certified); Cloudflare (CDN, DDoS protection).',
     4),
    (v_ropa_id, 'transfers', 'Transfers to Third Countries',
     'Supabase: data stored in us-east-1 (AWS). Vercel: US-based. Groq: US-based. Stripe: US-based. All transfers from EU/EEA rely on Standard Contractual Clauses (SCCs) and/or adequacy decisions where applicable.',
     5),
    (v_ropa_id, 'retention', 'Retention Periods',
     'User account data: duration of contract + 7 years (legal obligation). Chat messages: 1 year. AI conversations: 1 year. Session recordings: 90 days (configurable per org). Audit logs: 7 years. Financial records: 10 years (tax/legal). See data_locations table for per-column retention.',
     6),
    (v_ropa_id, 'security', 'Security Measures',
     'AES-256 encryption at rest (Supabase default); TLS 1.3 in transit; Row Level Security enforcing org-level data isolation; MFA for admin accounts; append-only tamper-evident audit logs; automated vulnerability scanning (Trivy, Gitleaks, Semgrep) in CI/CD; SOC 2 Type II in progress.',
     7),
    (v_ropa_id, 'legal_basis', 'Lawful Basis for Processing',
     'Contract performance (Art. 6(1)(b)): account management, service delivery. Legitimate interests (Art. 6(1)(f)): security monitoring, fraud prevention, product improvement. Legal obligation (Art. 6(1)(c)): audit logs, tax records. Consent (Art. 6(1)(a)): AI conversations, marketing communications.',
     8);
END $$;

-- ── GRC evidence: record the data mapping itself ─────────────
DO $$
DECLARE
  v_control_id uuid;
  v_loc_count  int;
BEGIN
  -- Find a privacy/data-protection related control (prefer SOC 2 CC6.1 or any available)
  SELECT id INTO v_control_id
  FROM grc_controls
  WHERE control_id ILIKE '%6.1%' OR title ILIKE '%data%' OR title ILIKE '%privacy%'
  LIMIT 1;

  -- Fall back to any control
  IF v_control_id IS NULL THEN
    SELECT id INTO v_control_id FROM grc_controls LIMIT 1;
  END IF;

  SELECT COUNT(*) INTO v_loc_count FROM data_locations;

  IF v_control_id IS NOT NULL THEN
    INSERT INTO grc_evidence
      (control_id, title, description, source, collected_at, hash)
    VALUES (
      v_control_id,
      '004_data_lineage.sql — Data Location Index seeded',
      'Phase 4 migration seeded ' || v_loc_count || ' known PII data locations across the Chaplain Connect platform schema. Covers profiles, auth, messages, ai_messages, sessions, audit_logs, subscriptions, and Supabase Storage buckets.',
      'manual',
      now(),
      encode(sha256(('004_data_lineage_seed_' || now()::text)::bytea), 'hex')
    );
  END IF;
END $$;
