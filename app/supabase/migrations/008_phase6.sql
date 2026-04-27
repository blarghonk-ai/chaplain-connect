-- ============================================================
-- Phase 6: SecurityAgent & Security Events
-- ============================================================

-- ── security_events ──────────────────────────────────────────
-- Audit trail for SecurityAgent findings.
-- Every rule evaluation that produces a signal writes here,
-- independent of whether it becomes an agent_decision.

CREATE TABLE security_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id    uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  event_type      text NOT NULL,
  -- 'new_super_admin'       — new account with super_admin role (24h)
  -- 'mfa_not_configured'    — super_admin has no MFA factors
  -- 'dormant_admin'         — super_admin inactive > 90 days
  -- 'privilege_escalation'  — existing user role changed to super_admin
  -- 'unowned_controls'      — GRC controls with no assigned owner
  severity        decision_severity NOT NULL DEFAULT 'medium',
  subject_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  subject_email   text,
  description     text NOT NULL,
  metadata        jsonb NOT NULL DEFAULT '{}',
  resolved        boolean NOT NULL DEFAULT false,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin only" ON security_events
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE INDEX idx_security_events_type ON security_events(event_type, resolved);
CREATE INDEX idx_security_events_severity ON security_events(severity) WHERE resolved = false;
CREATE INDEX idx_security_events_created ON security_events(created_at DESC);

-- ── Seed SecurityAgent rules in agent_rules ───────────────────
DO $$
DECLARE
  security_agent_id uuid;
BEGIN
  SELECT id INTO security_agent_id
  FROM agent_registry
  WHERE agent_type = 'security'
  LIMIT 1;

  IF security_agent_id IS NOT NULL THEN
    INSERT INTO agent_rules (agent_id, rule_key, rule_name, description, severity, human_gate_level, sla_hours, condition_config)
    VALUES
      (
        security_agent_id,
        'new_super_admin_24h',
        'New super_admin account (24h)',
        'A new profile with super_admin role was created in the last 24 hours. All super_admin role grants must be reviewed.',
        'critical',
        'approve',
        2,
        '{"window_hours": 24}'
      ),
      (
        security_agent_id,
        'mfa_not_configured',
        'Super admin without MFA',
        'A super_admin account has no multi-factor authentication configured. MFA is mandatory for all privileged accounts.',
        'high',
        'notify',
        24,
        '{}'
      ),
      (
        security_agent_id,
        'dormant_admin_90d',
        'Dormant super_admin (90 days)',
        'A super_admin account has not logged in for over 90 days. Dormant privileged accounts are a security risk.',
        'medium',
        'notify',
        72,
        '{"dormant_days": 90}'
      ),
      (
        security_agent_id,
        'privilege_escalation',
        'Potential privilege escalation',
        'An existing user profile had its role changed to super_admin within the last 7 days outside normal provisioning.',
        'high',
        'approve',
        8,
        '{"window_days": 7}'
      )
    ON CONFLICT (agent_id, rule_key) DO NOTHING;
  END IF;
END $$;
