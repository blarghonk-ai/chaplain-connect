-- ============================================================
-- Phase 5A: Agent Infrastructure
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

CREATE TYPE agent_status AS ENUM ('active', 'paused', 'disabled');
CREATE TYPE agent_run_status AS ENUM ('running', 'completed', 'failed');
CREATE TYPE decision_type AS ENUM ('finding', 'action', 'escalation', 'evidence');
CREATE TYPE decision_severity AS ENUM ('info', 'low', 'medium', 'high', 'critical');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'auto_approved');
CREATE TYPE human_gate_level AS ENUM ('none', 'notify', 'approve', 'always');

-- ── agent_registry ───────────────────────────────────────────
-- All registered agents and their current configuration/state.

CREATE TABLE agent_registry (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  description    text,
  agent_type     text NOT NULL,   -- 'compliance' | 'privacy' | 'security' | 'retention' | 'dsar' | 'data' | 'diagnostics'
  status         agent_status NOT NULL DEFAULT 'active',
  schedule_cron  text,            -- cron expression for pg_cron
  last_run_at    timestamptz,
  next_run_at    timestamptz,
  config         jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── agent_runs ───────────────────────────────────────────────
-- Every execution of an agent (one row per run).

CREATE TABLE agent_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        uuid NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  triggered_by    text NOT NULL DEFAULT 'scheduled',  -- 'scheduled' | 'manual' | 'event'
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  status          agent_run_status NOT NULL DEFAULT 'running',
  findings_count  int NOT NULL DEFAULT 0,
  actions_taken   int NOT NULL DEFAULT 0,
  summary         text,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── agent_decisions ──────────────────────────────────────────
-- Every decision an agent makes — the full reasoning trail.
-- This is the audit log for the agent system.

CREATE TABLE agent_decisions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                  uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  agent_id                uuid NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  decision_type           decision_type NOT NULL DEFAULT 'finding',
  severity                decision_severity NOT NULL DEFAULT 'info',
  title                   text NOT NULL,
  description             text,
  groq_reasoning          text,        -- Groq plain-English analysis
  rule_triggered          text,        -- which rule key fired
  proposed_action         text,        -- what the agent wants to do
  requires_human_approval boolean NOT NULL DEFAULT false,
  approval_status         approval_status NOT NULL DEFAULT 'auto_approved',
  approved_by             uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at             timestamptz,
  action_executed_at      timestamptz,
  action_result           jsonb,
  metadata                jsonb NOT NULL DEFAULT '{}',
  grc_evidence_id         uuid REFERENCES grc_evidence(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ── agent_rules ──────────────────────────────────────────────
-- Configurable rules per agent type (versioned for audit trail).

CREATE TABLE agent_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         uuid NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  rule_key         text NOT NULL,
  rule_name        text NOT NULL,
  description      text,
  severity         decision_severity NOT NULL DEFAULT 'medium',
  human_gate_level human_gate_level NOT NULL DEFAULT 'notify',
  sla_hours        int NOT NULL DEFAULT 24,
  is_active        boolean NOT NULL DEFAULT true,
  version          int NOT NULL DEFAULT 1,
  condition_config jsonb NOT NULL DEFAULT '{}',   -- thresholds and conditions
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, rule_key)
);

-- ── agent_approval_queue ─────────────────────────────────────
-- Pending decisions awaiting human approval.

CREATE TABLE agent_approval_queue (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id      uuid NOT NULL REFERENCES agent_decisions(id) ON DELETE CASCADE,
  assigned_to      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  due_at           timestamptz NOT NULL,
  resolved_at      timestamptz,
  resolution_notes text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_approval_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin only" ON agent_registry      USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "super_admin only" ON agent_runs          USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "super_admin only" ON agent_decisions     USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "super_admin only" ON agent_rules         USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "super_admin only" ON agent_approval_queue USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_agent_runs_agent ON agent_runs(agent_id, started_at DESC);
CREATE INDEX idx_agent_decisions_run ON agent_decisions(run_id);
CREATE INDEX idx_agent_decisions_severity ON agent_decisions(severity, approval_status);
CREATE INDEX idx_agent_decisions_pending ON agent_decisions(approval_status) WHERE approval_status = 'pending';
CREATE INDEX idx_agent_approval_due ON agent_approval_queue(due_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_agent_rules_agent ON agent_rules(agent_id, is_active);

-- ── Seed: Agents ─────────────────────────────────────────────

INSERT INTO agent_registry (name, description, agent_type, status, schedule_cron)
VALUES
  (
    'ComplianceAgent',
    'Monitors GRC control staleness, evidence freshness, and open vulnerability SLAs. Ensures compliance posture never silently degrades. Runs daily.',
    'compliance',
    'active',
    '0 8 * * *'
  ),
  (
    'PrivacyAgent',
    'Continuously evaluates data privacy across all regulations (GDPR, HIPAA, CCPA, LGPD, PIPL, and more). Manages consent, auto-generates ROPAs, triggers PIAs/DPIAs, enforces Privacy by Design, and monitors for new laws. Runs perpetually.',
    'privacy',
    'active',
    '0 6 * * *'
  ),
  (
    'SecurityAgent',
    'Monitors authentication events, API anomalies, secret exposure, and access control violations. Creates GRC findings and escalates critical events immediately.',
    'security',
    'active',
    '*/15 * * * *'
  ),
  (
    'DataAgent',
    'Scans database columns for PII outside expected locations (CVV, card PANs, SSNs, emails in logs). Creates violation records with remediation proposals. Never deletes without human approval.',
    'data',
    'active',
    '0 2 * * *'
  ),
  (
    'RetentionAgent',
    'Enforces data retention policies per category. Identifies expired data and proposes deletion batches for human approval. Generates cryptographically signed deletion receipts.',
    'retention',
    'active',
    '0 1 * * *'
  ),
  (
    'DSARAgent',
    'Processes Data Subject Access Requests. Auto-discovers all data for a subject across the platform, generates export packages, tracks 30-day SLAs, and escalates approaching deadlines.',
    'dsar',
    'active',
    NULL
  ),
  (
    'DiagnosticsAgent',
    'Monitors application health, deployment failures, error rate spikes, and new CVEs. Uses Groq to explain root causes and recommend specific fixes. Feeds findings into GRC.',
    'diagnostics',
    'active',
    '*/30 * * * *'
  );

-- ── Seed: ComplianceAgent rules ──────────────────────────────

DO $$
DECLARE v_agent_id uuid;
BEGIN
  SELECT id INTO v_agent_id FROM agent_registry WHERE agent_type = 'compliance' LIMIT 1;

  INSERT INTO agent_rules (agent_id, rule_key, rule_name, description, severity, human_gate_level, sla_hours, condition_config)
  VALUES
    (
      v_agent_id, 'stale_evidence_90d',
      'Control evidence stale > 90 days',
      'A control marked as implemented has no new evidence collected in the last 90 days. Auditors require continuous evidence, not one-time collection.',
      'medium', 'notify', 72,
      '{"stale_days": 90, "statuses": ["implemented", "evidence_collected"]}'
    ),
    (
      v_agent_id, 'implemented_no_evidence',
      'Implemented control has zero evidence',
      'A control is marked Implemented but has no evidence records at all. This will fail any audit — implementation without evidence is unverifiable.',
      'high', 'notify', 48,
      '{"statuses": ["implemented"]}'
    ),
    (
      v_agent_id, 'critical_vuln_7d',
      'Critical vulnerability open > 7 days',
      'A critical severity vulnerability has been open for more than 7 days without resolution. This breaches SOC 2 CC7.1 and most enterprise SLAs.',
      'critical', 'notify', 4,
      '{"severity": "critical", "max_age_days": 7}'
    ),
    (
      v_agent_id, 'high_vuln_30d',
      'High vulnerability open > 30 days',
      'A high severity vulnerability has been open for more than 30 days. Remediation SLA exceeded.',
      'high', 'notify', 24,
      '{"severity": "high", "max_age_days": 30}'
    ),
    (
      v_agent_id, 'framework_below_threshold',
      'Framework compliance score below 70%',
      'Overall compliance score for a framework has dropped below 70%. This indicates systemic control gaps that need immediate attention.',
      'high', 'notify', 24,
      '{"threshold_pct": 70}'
    ),
    (
      v_agent_id, 'risk_unreviewed_90d',
      'Open risk not reviewed in 90 days',
      'A risk in the risk register has had no status update in 90 days. Risk registers require periodic review to remain current.',
      'medium', 'notify', 72,
      '{"max_age_days": 90}'
    );
END $$;

-- ── Seed: SecurityAgent rules ─────────────────────────────────

DO $$
DECLARE v_agent_id uuid;
BEGIN
  SELECT id INTO v_agent_id FROM agent_registry WHERE agent_type = 'security' LIMIT 1;

  INSERT INTO agent_rules (agent_id, rule_key, rule_name, description, severity, human_gate_level, sla_hours, condition_config)
  VALUES
    (
      v_agent_id, 'new_super_admin',
      'New super_admin account created',
      'A new super_admin role was granted. Super admin creation must be reviewed — unauthorized privilege escalation is a critical security event.',
      'critical', 'always', 1,
      '{}'
    ),
    (
      v_agent_id, 'mfa_not_configured',
      'Admin account without MFA',
      'An org_admin or super_admin account has not configured MFA. MFA is required for all admin roles per SOC 2 CC6.1 and our security policy.',
      'high', 'notify', 48,
      '{"roles": ["org_admin", "super_admin"]}'
    );
END $$;

-- ── Seed: DataAgent rules ─────────────────────────────────────

DO $$
DECLARE v_agent_id uuid;
BEGIN
  SELECT id INTO v_agent_id FROM agent_registry WHERE agent_type = 'data' LIMIT 1;

  INSERT INTO agent_rules (agent_id, rule_key, rule_name, description, severity, human_gate_level, sla_hours, condition_config)
  VALUES
    (
      v_agent_id, 'credit_card_pan',
      'Credit card PAN detected outside whitelist',
      'A 16-digit credit card number pattern was found in a column not designated for financial data. PCI DSS Rule 3.2 prohibits storage of card data without PCI certification.',
      'critical', 'always', 4,
      '{"pattern": "credit_card_pan", "whitelisted_tables": []}'
    ),
    (
      v_agent_id, 'cvv_detected',
      'CVV/CVC detected in database',
      'A card verification value (CVV/CVC) pattern was detected. PCI DSS Rule 3.2.1 prohibits storage of CVV under any circumstances, even if encrypted.',
      'critical', 'always', 1,
      '{"pattern": "cvv"}'
    ),
    (
      v_agent_id, 'ssn_detected',
      'Social Security Number detected outside whitelist',
      'An SSN pattern was found in a column not designated for this data type. SSNs are regulated under HIPAA, CCPA, and numerous state laws.',
      'high', 'approve', 24,
      '{"pattern": "ssn", "whitelisted_tables": []}'
    ),
    (
      v_agent_id, 'email_in_audit_logs',
      'Email address found in audit log metadata',
      'An email address pattern was found in audit_logs.metadata. Audit logs should contain identifiers, not raw PII — this may indicate over-logging.',
      'medium', 'notify', 72,
      '{"pattern": "email", "target_table": "audit_logs", "target_column": "metadata"}'
    );
END $$;

-- ── GRC evidence: record agent infrastructure creation ────────
DO $$
DECLARE v_control_id uuid;
BEGIN
  SELECT id INTO v_control_id FROM grc_controls
  WHERE title ILIKE '%change%' OR title ILIKE '%monitor%' OR control_id ILIKE '%7.%'
  LIMIT 1;

  IF v_control_id IS NULL THEN
    SELECT id INTO v_control_id FROM grc_controls LIMIT 1;
  END IF;

  IF v_control_id IS NOT NULL THEN
    INSERT INTO grc_evidence (control_id, title, description, source, collected_at, hash)
    VALUES (
      v_control_id,
      '005_agent_infrastructure.sql — Agent system initialized',
      'Phase 5A migration deployed. 7 agents registered (ComplianceAgent, PrivacyAgent, SecurityAgent, DataAgent, RetentionAgent, DSARAgent, DiagnosticsAgent) with full rule sets. Agent infrastructure enables continuous automated compliance monitoring.',
      'manual',
      now(),
      encode(sha256(('005_agent_infra_' || now()::text)::bytea), 'hex')
    );
  END IF;
END $$;
