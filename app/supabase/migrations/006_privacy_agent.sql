-- ============================================================
-- Phase 5B: PrivacyAgent — Regulation Registry & Consent Management
-- ============================================================

-- ── privacy_regulations ──────────────────────────────────────
-- Every privacy regulation the platform must comply with.
-- requirements jsonb is the machine-readable rule set for the PrivacyAgent.

CREATE TABLE privacy_regulations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_code     text NOT NULL,    -- 'EU', 'UK', 'US-CA', 'BR', 'CN', etc.
  jurisdiction_name     text NOT NULL,
  regulation_name       text NOT NULL,
  regulation_short      text NOT NULL,    -- 'GDPR', 'CCPA', 'LGPD', etc.
  effective_date        date,
  last_amended_date     date,
  authority_name        text,
  authority_url         text,
  source_url            text,
  requirements          jsonb NOT NULL DEFAULT '{}',
  -- key requirement fields stored at top level for easy querying:
  consent_required      boolean NOT NULL DEFAULT true,
  opt_out_model         boolean NOT NULL DEFAULT false,  -- true = opt-out (CCPA); false = opt-in (GDPR)
  right_to_erasure      boolean NOT NULL DEFAULT false,
  right_to_portability  boolean NOT NULL DEFAULT false,
  right_to_access       boolean NOT NULL DEFAULT true,
  right_to_object       boolean NOT NULL DEFAULT false,
  dpia_required         boolean NOT NULL DEFAULT false,
  ropa_required         boolean NOT NULL DEFAULT false,
  breach_hours          int,             -- notification SLA in hours (72 for GDPR)
  cookie_consent_req    boolean NOT NULL DEFAULT false,
  cookie_opt_in         boolean NOT NULL DEFAULT false,  -- true = must opt in before cookies set
  children_age          int,             -- minimum age threshold (13 COPPA, 16 GDPR)
  is_active             boolean NOT NULL DEFAULT true,
  applies_to_us         boolean NOT NULL DEFAULT false,  -- does this regulation apply to Chaplain Connect?
  compliance_notes      text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── privacy_adequacy_decisions ───────────────────────────────
-- Which country-to-country data transfers are pre-approved (GDPR adequacy decisions).

CREATE TABLE privacy_adequacy_decisions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_jurisdiction text NOT NULL,  -- e.g. 'EU'
  to_jurisdiction  text NOT NULL,   -- e.g. 'US'
  mechanism        text NOT NULL,   -- 'adequacy' | 'SCCs' | 'BCRs' | 'derogation'
  decision_name    text,            -- e.g. 'EU-US Data Privacy Framework'
  valid_from       date,
  valid_until      date,
  is_active        boolean NOT NULL DEFAULT true,
  source_url       text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── user_jurisdiction_profiles ───────────────────────────────
-- For every user, which regulations apply to them.

CREATE TABLE user_jurisdiction_profiles (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id                   uuid REFERENCES organizations(id) ON DELETE SET NULL,
  detected_country         text,      -- from IP geolocation
  declared_residency       text,      -- user-stated (overrides detection)
  applicable_regulation_ids uuid[],   -- array of privacy_regulations.id
  highest_protection_level text,      -- regulation_short of the most stringent applicable
  last_evaluated_at        timestamptz NOT NULL DEFAULT now(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- ── consent_records ──────────────────────────────────────────
-- Granular consent — legal proof that a user agreed to a specific processing purpose.

CREATE TABLE consent_records (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id               uuid REFERENCES organizations(id) ON DELETE SET NULL,
  purpose              text NOT NULL,   -- 'ai_assistance' | 'session_recording' | 'analytics' | 'marketing' | 'pastoral_chat'
  regulation_id        uuid REFERENCES privacy_regulations(id) ON DELETE SET NULL,
  consent_type         text NOT NULL DEFAULT 'explicit_opt_in',  -- 'explicit_opt_in' | 'opt_out' | 'legitimate_interests' | 'contract'
  granted_at           timestamptz NOT NULL DEFAULT now(),
  withdrawn_at         timestamptz,
  ip_address           text,
  user_agent           text,
  consent_string       text,           -- base64-signed proof
  privacy_policy_version text,
  method               text NOT NULL DEFAULT 'api',  -- 'cookie_banner' | 'signup_flow' | 'settings' | 'api'
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ── cookie_consent_records ───────────────────────────────────
-- Cookie consent per browser session (pre-auth via anonymous_id).

CREATE TABLE cookie_consent_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id     text NOT NULL,     -- UUID stored in localStorage
  user_id          uuid REFERENCES profiles(id) ON DELETE SET NULL,  -- linked after login
  org_id           uuid REFERENCES organizations(id) ON DELETE SET NULL,
  jurisdiction     text NOT NULL DEFAULT 'unknown',
  necessary        boolean NOT NULL DEFAULT true,   -- always true
  functional       boolean NOT NULL DEFAULT false,
  analytics        boolean NOT NULL DEFAULT false,
  marketing        boolean NOT NULL DEFAULT false,
  personalization  boolean NOT NULL DEFAULT false,
  consent_string   text,
  granted_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  withdrawn_at     timestamptz,
  ip_address       text,
  UNIQUE (anonymous_id)
);

-- ── consent_withdrawal_events ────────────────────────────────
-- Tracks consent withdrawal and cascades to RetentionAgent.

CREATE TABLE consent_withdrawal_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id                  uuid REFERENCES organizations(id) ON DELETE SET NULL,
  purpose                 text NOT NULL,
  withdrawn_at            timestamptz NOT NULL DEFAULT now(),
  triggered_agent_run_id  uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  deletion_receipt_id     uuid,    -- references deletion_receipts (Phase 5C)
  status                  text NOT NULL DEFAULT 'pending',  -- 'pending' | 'processing' | 'completed'
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE privacy_regulations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_adequacy_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_jurisdiction_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cookie_consent_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_withdrawal_events  ENABLE ROW LEVEL SECURITY;

-- Regulations: all authenticated users can read (needed for consent banner)
CREATE POLICY "authenticated read" ON privacy_regulations FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "super_admin write"  ON privacy_regulations FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "super_admin only" ON privacy_adequacy_decisions USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "super_admin only" ON user_jurisdiction_profiles USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Consent: users can read/write their own; super_admin can read all
CREATE POLICY "own consent" ON consent_records
  FOR ALL USING (user_id = auth.uid() OR is_super_admin())
  WITH CHECK (user_id = auth.uid() OR is_super_admin());

-- Cookie consent: anyone can write (pre-auth); super_admin reads all
CREATE POLICY "write own cookie consent" ON cookie_consent_records
  FOR INSERT WITH CHECK (true);
CREATE POLICY "update own cookie consent" ON cookie_consent_records
  FOR UPDATE USING (anonymous_id IS NOT NULL);
CREATE POLICY "read own cookie consent" ON cookie_consent_records
  FOR SELECT USING (user_id = auth.uid() OR is_super_admin());

CREATE POLICY "own withdrawal" ON consent_withdrawal_events
  FOR ALL USING (user_id = auth.uid() OR is_super_admin())
  WITH CHECK (user_id = auth.uid() OR is_super_admin());

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_privacy_regs_jurisdiction ON privacy_regulations(jurisdiction_code);
CREATE INDEX idx_privacy_regs_active ON privacy_regulations(is_active, applies_to_us);
CREATE INDEX idx_consent_user ON consent_records(user_id, purpose, is_active);
CREATE INDEX idx_consent_withdrawn ON consent_records(withdrawn_at) WHERE withdrawn_at IS NOT NULL;
CREATE INDEX idx_cookie_consent_anon ON cookie_consent_records(anonymous_id);
CREATE INDEX idx_withdrawal_status ON consent_withdrawal_events(status) WHERE status = 'pending';

-- ── Seed: 19 Privacy Regulations ─────────────────────────────

INSERT INTO privacy_regulations (
  jurisdiction_code, jurisdiction_name, regulation_name, regulation_short,
  effective_date, last_amended_date, authority_name, source_url,
  consent_required, opt_out_model, right_to_erasure, right_to_portability,
  right_to_access, right_to_object, dpia_required, ropa_required,
  breach_hours, cookie_consent_req, cookie_opt_in, children_age,
  applies_to_us, compliance_notes,
  requirements
) VALUES

-- 1. GDPR (EU)
('EU', 'European Union', 'General Data Protection Regulation', 'GDPR',
 '2018-05-25', '2022-01-01', 'European Data Protection Board', 'https://gdpr.eu',
 true, false, true, true, true, true, true, true,
 72, true, true, 16, true,
 'Applies to any org processing EU resident data regardless of org location. Highest standard globally.',
 '{"sensitive_categories":["health","biometric","ethnic_origin","political_opinion","religious_belief","sexual_orientation"],"transfer_mechanisms":["adequacy","SCCs","BCRs","derogation"],"max_fine_eur":20000000,"fine_pct_turnover":4,"dpa_required":true}'
),

-- 2. UK GDPR
('UK', 'United Kingdom', 'UK General Data Protection Regulation + Data Protection Act 2018', 'UK GDPR',
 '2021-01-01', '2023-06-01', 'Information Commissioner''s Office', 'https://ico.org.uk',
 true, false, true, true, true, true, true, true,
 72, true, true, 13, true,
 'Post-Brexit UK equivalent of GDPR. Substantively similar but separate jurisdiction. UK-US adequacy decision pending.',
 '{"sensitive_categories":["health","biometric","ethnic_origin","political_opinion","religious_belief","sexual_orientation"],"transfer_mechanisms":["adequacy","ICO_SCCs","BCRs"],"max_fine_gbp":17500000}'
),

-- 3. LGPD (Brazil)
('BR', 'Brazil', 'Lei Geral de Proteção de Dados', 'LGPD',
 '2020-09-18', '2022-08-01', 'Autoridade Nacional de Proteção de Dados', 'https://www.gov.br/anpd',
 true, false, true, true, true, true, true, false,
 72, true, true, 18, true,
 'Closely modeled on GDPR. Applies when processing data of Brazilian residents.',
 '{"sensitive_categories":["health","biometric","ethnic_origin","political_opinion","religious_belief","sexual_orientation","financial"],"max_fine_brl":50000000}'
),

-- 4. CCPA/CPRA (California)
('US-CA', 'California, United States', 'California Consumer Privacy Act + California Privacy Rights Act', 'CCPA/CPRA',
 '2020-01-01', '2023-01-01', 'California Privacy Protection Agency', 'https://oag.ca.gov/privacy/ccpa',
 false, true, true, true, true, true, false, false,
 72, false, false, 16, true,
 'Opt-out model. Right to opt-out of sale/sharing. CPRA added sensitive data category protections. Applies to orgs with >$25M revenue or >100k consumers.',
 '{"right_to_opt_out_sale":true,"right_to_limit_sensitive":true,"sensitive_categories":["health","financial","precise_location","ethnicity","religion","sexual_orientation","citizenship","genetic","biometric","login_credentials"],"max_fine_per_violation":7500}'
),

-- 5. Virginia VCDPA
('US-VA', 'Virginia, United States', 'Virginia Consumer Data Protection Act', 'VCDPA',
 '2023-01-01', NULL, 'Virginia Attorney General', 'https://law.lis.virginia.gov/vacodefull/title59.1/chapter53',
 false, true, true, true, true, true, true, false,
 NULL, false, false, 13, true,
 'Opt-out model. DPIA required for high-risk processing. No private right of action (AG enforcement only).',
 '{"right_to_opt_out_targeted_ads":true,"right_to_opt_out_profiling":true}'
),

-- 6. Colorado CPA
('US-CO', 'Colorado, United States', 'Colorado Privacy Act', 'CPA',
 '2023-07-01', NULL, 'Colorado Attorney General', 'https://coag.gov/resources/colorado-privacy-act',
 false, true, true, true, true, true, true, false,
 NULL, false, false, 13, true,
 'Opt-out model. Similar to VCDPA. DPIA required.',
 '{"right_to_opt_out_targeted_ads":true,"right_to_opt_out_profiling":true,"universal_opt_out_required":true}'
),

-- 7. Connecticut CTDPA
('US-CT', 'Connecticut, United States', 'Connecticut Data Privacy Act', 'CTDPA',
 '2023-07-01', NULL, 'Connecticut Attorney General', 'https://portal.ct.gov/AG',
 false, true, true, true, true, true, true, false,
 NULL, false, false, 13, true,
 'Opt-out model. Right to opt out of targeted advertising and profiling.',
 '{"right_to_opt_out_targeted_ads":true,"universal_opt_out_required":true}'
),

-- 8. Texas TDPSA
('US-TX', 'Texas, United States', 'Texas Data Privacy and Security Act', 'TDPSA',
 '2024-07-01', NULL, 'Texas Attorney General', 'https://capitol.texas.gov',
 false, true, true, true, true, true, true, false,
 NULL, false, false, 13, true,
 'Opt-out model. No revenue threshold — applies broadly. AG enforcement.',
 '{"right_to_opt_out_targeted_ads":true,"right_to_opt_out_sale":true}'
),

-- 9. PDPA Thailand
('TH', 'Thailand', 'Personal Data Protection Act', 'PDPA-TH',
 '2022-06-01', NULL, 'Personal Data Protection Committee', 'https://www.pdpc.or.th',
 true, false, true, false, true, true, false, false,
 72, false, false, NULL, false,
 'Closely modeled on GDPR. Applies when processing Thai resident data.',
 '{"sensitive_categories":["health","biometric","ethnic_origin","political_opinion","religious_belief","sexual_orientation"]}'
),

-- 10. PDPA Singapore
('SG', 'Singapore', 'Personal Data Protection Act', 'PDPA-SG',
 '2012-01-02', '2021-11-01', 'Personal Data Protection Commission', 'https://www.pdpc.gov.sg',
 true, false, false, true, true, false, false, false,
 72, false, false, NULL, false,
 'Amended 2021 with mandatory breach notification and increased fines.',
 '{"mandatory_data_breach_notification":true,"deemed_consent_for_legitimate_interests":true}'
),

-- 11. PIPL (China)
('CN', 'China', 'Personal Information Protection Law', 'PIPL',
 '2021-11-01', NULL, 'Cyberspace Administration of China', 'https://www.cac.gov.cn',
 true, false, true, true, true, true, true, false,
 NULL, false, false, 14, false,
 'Extraterritorial reach. Requires separate consent for each processing purpose. Cross-border transfers require CAC approval for large-scale transfers. Data localization requirements.',
 '{"cross_border_requires_approval":true,"data_localization":true,"sensitive_categories":["health","financial","location","biometric","minor_info"]}'
),

-- 12. India DPDP Act
('IN', 'India', 'Digital Personal Data Protection Act', 'DPDP',
 '2023-08-11', NULL, 'Data Protection Board of India', 'https://meity.gov.in',
 true, false, true, false, true, false, false, false,
 NULL, false, false, 18, true,
 'New 2023 regulation. Implementing rules still being finalized. Verifiable parental consent for under-18. Applies when processing Indian resident data.',
 '{"notice_required":true,"deemed_consent_allowed":true,"significant_data_fiduciary_threshold":true}'
),

-- 13. APPI (Japan)
('JP', 'Japan', 'Act on the Protection of Personal Information', 'APPI',
 '2005-04-01', '2022-04-01', 'Personal Information Protection Commission', 'https://www.ppc.go.jp',
 true, false, false, false, true, false, false, false,
 NULL, false, false, NULL, false,
 '2022 amendments strengthened consent requirements and cross-border transfer rules.',
 '{"sensitive_categories":["ideology","belief","race","ethnicity","family_origin","medical","criminal_history","disability"],"third_party_provision_opt_out":true}'
),

-- 14. PIPA (South Korea)
('KR', 'South Korea', 'Personal Information Protection Act', 'PIPA',
 '2011-09-30', '2023-09-15', 'Personal Information Protection Commission', 'https://www.pipc.go.kr',
 true, false, true, false, true, true, false, true,
 72, false, false, 14, false,
 'One of the strictest privacy laws globally. Mandatory consent for collection and each use purpose separately. Very high fines.',
 '{"sensitive_categories":["ideology","belief","criminal","health","sexual_orientation","biometric","financial_credit"],"max_fine_krw":3000000000}'
),

-- 15. Australia Privacy Act
('AU', 'Australia', 'Privacy Act 1988 (as amended)', 'APA',
 '1988-12-21', '2022-10-22', 'Office of the Australian Information Commissioner', 'https://www.oaic.gov.au',
 true, false, false, false, true, false, false, false,
 NULL, false, false, NULL, false,
 '2022 review proposed significant strengthening. Applies to orgs with >$3M annual turnover.',
 '{"13_australian_privacy_principles":true,"sensitive_data_requires_consent":true}'
),

-- 16. UAE PDPL
('AE', 'United Arab Emirates', 'Personal Data Protection Law', 'PDPL',
 '2022-01-02', NULL, 'UAE Data Office', 'https://tdra.gov.ae',
 true, false, false, false, true, false, false, false,
 72, false, false, NULL, false,
 'UAE federal data protection law. Applies to data processing in or targeting UAE.',
 '{"sensitive_categories":["health","financial","biometric","criminal","ethnic_origin","sexual_orientation"]}'
),

-- 17. PIPEDA (Canada)
('CA', 'Canada', 'Personal Information Protection and Electronic Documents Act', 'PIPEDA',
 '2000-04-13', '2019-11-01', 'Office of the Privacy Commissioner of Canada', 'https://www.priv.gc.ca',
 true, false, false, false, true, false, false, false,
 NULL, false, false, NULL, true,
 'Consent may be express or implied. Breach of security safeguards notification required. Being replaced by proposed CPPA.',
 '{"10_fair_information_principles":true,"breach_notification_required":true}'
),

-- 18. HIPAA (USA - Healthcare)
('US-HIPAA', 'United States (Healthcare)', 'Health Insurance Portability and Accountability Act', 'HIPAA',
 '1996-08-21', '2013-03-26', 'US Department of Health & Human Services', 'https://www.hhs.gov/hipaa',
 false, false, true, true, true, false, false, false,
 1440, false, false, NULL, true,
 'Applies to covered entities and business associates handling PHI. BAA required with all vendors. 60-day breach notification. Not consent-based — authorization required for certain uses.',
 '{"applies_to":"covered_entities_and_bas","phi_safeguards_required":true,"baa_required":true,"minimum_necessary_standard":true,"authorization_vs_consent":true}'
),

-- 19. COPPA (USA - Children)
('US-COPPA', 'United States (Children Online Privacy)', 'Children''s Online Privacy Protection Act', 'COPPA',
 '2000-04-21', '2013-07-01', 'Federal Trade Commission', 'https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa',
 true, false, true, false, true, false, false, false,
 NULL, false, false, 13, true,
 'Applies when collecting data from children under 13. Verifiable parental consent required. Applies to any service directed at children or with actual knowledge of collecting from under-13s.',
 '{"verifiable_parental_consent":true,"no_behavioral_advertising_to_children":true,"data_retention_limit":true}');

-- ── Seed: Adequacy Decisions ──────────────────────────────────

INSERT INTO privacy_adequacy_decisions
  (from_jurisdiction, to_jurisdiction, mechanism, decision_name, valid_from, is_active, notes)
VALUES
  ('EU', 'US', 'adequacy', 'EU-US Data Privacy Framework', '2023-07-10', true,
   'Replaces Privacy Shield (invalidated 2020). Certified US orgs only. Subject to future legal challenge.'),
  ('EU', 'UK', 'adequacy', 'EU-UK Adequacy Decision', '2021-06-28', true,
   'Valid until 2025, subject to review.'),
  ('EU', 'CH', 'adequacy', 'Switzerland Adequacy', '2000-07-26', true, NULL),
  ('EU', 'CA', 'adequacy', 'Canada PIPEDA Adequacy', '2001-12-20', true, NULL),
  ('EU', 'JP', 'adequacy', 'Japan APPI Adequacy', '2019-01-23', true, NULL),
  ('EU', 'KR', 'adequacy', 'South Korea PIPA Adequacy', '2021-12-17', true, NULL),
  ('EU', 'NZ', 'adequacy', 'New Zealand Adequacy', '2012-12-19', true, NULL),
  ('EU', 'IL', 'adequacy', 'Israel Adequacy', '2011-01-31', true, NULL),
  ('EU', 'AR', 'adequacy', 'Argentina Adequacy', '2003-07-30', true, NULL),
  ('EU', 'AU', 'SCCs', 'Standard Contractual Clauses', NULL, true,
   'No adequacy decision — transfers rely on SCCs or BCRs.');

-- ── GRC evidence ─────────────────────────────────────────────
DO $$
DECLARE v_control_id uuid;
BEGIN
  SELECT id INTO v_control_id FROM grc_controls
  WHERE title ILIKE '%privacy%' OR title ILIKE '%personal%' OR control_id ILIKE '%6.%'
  LIMIT 1;
  IF v_control_id IS NULL THEN SELECT id INTO v_control_id FROM grc_controls LIMIT 1; END IF;
  IF v_control_id IS NOT NULL THEN
    INSERT INTO grc_evidence (control_id, title, description, source, collected_at, hash)
    VALUES (
      v_control_id,
      '006_privacy_agent.sql — Regulation registry initialized',
      'Phase 5B migration deployed. 19 global privacy regulations seeded (GDPR, UK GDPR, LGPD, CCPA/CPRA, VCDPA, CPA, CTDPA, TDPSA, PDPA-TH, PDPA-SG, PIPL, DPDP, APPI, PIPA, APA, PDPL, PIPEDA, HIPAA, COPPA). 10 adequacy decisions seeded. Consent management tables created. PrivacyAgent can now evaluate cross-jurisdictional compliance.',
      'manual', now(),
      encode(sha256(('006_privacy_agent_' || now()::text)::bytea), 'hex')
    );
  END IF;
END $$;
