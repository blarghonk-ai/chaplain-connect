-- ============================================================
-- Migration 003 — GRC Engine (Internal Tool)
-- All tables scoped to super_admin access only via RLS
-- Run in Supabase SQL editor
-- ============================================================

-- Helper: check if current user is super_admin
create or replace function is_super_admin()
returns boolean
language sql stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'super_admin'
  )
$$;

-- ─── Compliance Frameworks ────────────────────────────────────

create table if not exists grc_frameworks (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,   -- e.g. 'soc2', 'iso27001', 'cmmc2', 'fedramp'
  name        text not null,          -- e.g. 'SOC 2 Type II'
  version     text,                   -- e.g. '2017', 'Rev 5'
  description text,
  created_at  timestamptz not null default now()
);

alter table grc_frameworks enable row level security;
create policy "super_admins only" on grc_frameworks for all using (is_super_admin()) with check (is_super_admin());

-- ─── Controls Library ─────────────────────────────────────────

create table if not exists grc_controls (
  id              uuid primary key default gen_random_uuid(),
  framework_id    uuid not null references grc_frameworks(id) on delete cascade,
  control_id      text not null,   -- e.g. 'CC6.1', 'A.9.1.1', 'AC.1.001'
  title           text not null,
  description     text,
  category        text,            -- e.g. 'Access Control', 'Incident Response'
  created_at      timestamptz not null default now(),
  unique (framework_id, control_id)
);

create index grc_controls_framework_idx on grc_controls(framework_id);

alter table grc_controls enable row level security;
create policy "super_admins only" on grc_controls for all using (is_super_admin()) with check (is_super_admin());

-- ─── Control Mappings (cross-framework) ──────────────────────

create table if not exists grc_control_mappings (
  id              uuid primary key default gen_random_uuid(),
  control_id_a    uuid not null references grc_controls(id) on delete cascade,
  control_id_b    uuid not null references grc_controls(id) on delete cascade,
  relationship    text not null default 'equivalent',  -- 'equivalent', 'covers', 'partial'
  created_at      timestamptz not null default now(),
  unique (control_id_a, control_id_b)
);

alter table grc_control_mappings enable row level security;
create policy "super_admins only" on grc_control_mappings for all using (is_super_admin()) with check (is_super_admin());

-- ─── Control Implementations ──────────────────────────────────

create type grc_status as enum ('not_started', 'in_progress', 'implemented', 'evidence_collected', 'audited', 'not_applicable');

create table if not exists grc_implementations (
  id              uuid primary key default gen_random_uuid(),
  control_id      uuid not null references grc_controls(id) on delete cascade,
  status          grc_status not null default 'not_started',
  owner_id        uuid references profiles(id) on delete set null,
  due_date        date,
  notes           text,
  implementation_detail text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (control_id)
);

create index grc_impl_control_idx on grc_implementations(control_id);
create index grc_impl_status_idx on grc_implementations(status);

alter table grc_implementations enable row level security;
create policy "super_admins only" on grc_implementations for all using (is_super_admin()) with check (is_super_admin());

-- ─── Evidence ─────────────────────────────────────────────────

create type grc_evidence_source as enum (
  'github', 'supabase', 'vercel', 'stripe', 'manual',
  'trivy', 'gitleaks', 'semgrep', 'codeql', 'checkov', 'grype'
);

create table if not exists grc_evidence (
  id              uuid primary key default gen_random_uuid(),
  control_id      uuid not null references grc_controls(id) on delete cascade,
  title           text not null,
  description     text,
  source          grc_evidence_source not null default 'manual',
  source_url      text,            -- link to the artifact (GitHub run, Vercel deployment, etc.)
  source_ref      text,            -- e.g. commit SHA, run ID, deployment ID
  collected_at    timestamptz not null default now(),
  collected_by    uuid references profiles(id) on delete set null,
  file_url        text,            -- Supabase Storage URL for uploaded evidence files
  metadata        jsonb,           -- raw evidence data (scan results, etc.)
  hash            text,            -- SHA-256 of evidence content for tamper-evidence
  created_at      timestamptz not null default now()
);

create index grc_evidence_control_idx on grc_evidence(control_id);
create index grc_evidence_source_idx on grc_evidence(source);
create index grc_evidence_collected_idx on grc_evidence(collected_at desc);

alter table grc_evidence enable row level security;
create policy "super_admins only" on grc_evidence for all using (is_super_admin()) with check (is_super_admin());

-- Prevent modification of evidence (append-only for integrity)
create policy "evidence is append-only" on grc_evidence
  for update using (false);
create policy "evidence cannot be deleted" on grc_evidence
  for delete using (false);

-- ─── Vulnerability Findings ───────────────────────────────────

create type vuln_severity as enum ('critical', 'high', 'medium', 'low', 'info');
create type vuln_status as enum ('open', 'in_remediation', 'resolved', 'accepted', 'false_positive');

create table if not exists grc_vulnerabilities (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  severity        vuln_severity not null,
  status          vuln_status not null default 'open',
  scanner         text,            -- 'trivy', 'semgrep', 'codeql', 'gitleaks', etc.
  cve_id          text,            -- e.g. 'CVE-2024-12345'
  cvss_score      numeric(4,1),
  affected_package text,
  affected_version text,
  fixed_version   text,
  file_path       text,
  line_number     integer,
  source_run_url  text,            -- GitHub Actions run URL
  source_ref      text,            -- commit SHA
  found_at        timestamptz not null default now(),
  resolved_at     timestamptz,
  resolution_notes text,
  assigned_to     uuid references profiles(id) on delete set null,
  -- Link to GRC control(s) this finding maps to
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index grc_vuln_severity_idx on grc_vulnerabilities(severity, status);
create index grc_vuln_cve_idx on grc_vulnerabilities(cve_id);

alter table grc_vulnerabilities enable row level security;
create policy "super_admins only" on grc_vulnerabilities for all using (is_super_admin()) with check (is_super_admin());

-- Link vulnerabilities to controls
create table if not exists grc_vuln_controls (
  vuln_id       uuid not null references grc_vulnerabilities(id) on delete cascade,
  control_id    uuid not null references grc_controls(id) on delete cascade,
  primary key (vuln_id, control_id)
);

alter table grc_vuln_controls enable row level security;
create policy "super_admins only" on grc_vuln_controls for all using (is_super_admin()) with check (is_super_admin());

-- ─── Risk Register ────────────────────────────────────────────

create type risk_treatment as enum ('accept', 'mitigate', 'transfer', 'avoid');
create type risk_status as enum ('open', 'in_treatment', 'resolved', 'accepted');

create table if not exists grc_risks (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  description       text,
  category          text,            -- 'operational', 'security', 'compliance', 'financial'
  likelihood        integer not null check (likelihood between 1 and 5),
  impact            integer not null check (impact between 1 and 5),
  risk_score        integer generated always as (likelihood * impact) stored,
  treatment         risk_treatment,
  treatment_plan    text,
  status            risk_status not null default 'open',
  owner_id          uuid references profiles(id) on delete set null,
  review_date       date,
  last_reviewed_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index grc_risks_score_idx on grc_risks(risk_score desc);

alter table grc_risks enable row level security;
create policy "super_admins only" on grc_risks for all using (is_super_admin()) with check (is_super_admin());

-- Link risks to controls
create table if not exists grc_risk_controls (
  risk_id       uuid not null references grc_risks(id) on delete cascade,
  control_id    uuid not null references grc_controls(id) on delete cascade,
  primary key (risk_id, control_id)
);

alter table grc_risk_controls enable row level security;
create policy "super_admins only" on grc_risk_controls for all using (is_super_admin()) with check (is_super_admin());

-- ─── Evidence Collection Jobs ─────────────────────────────────
-- Tracks automated evidence collection runs

create table if not exists grc_collection_jobs (
  id              uuid primary key default gen_random_uuid(),
  source          grc_evidence_source not null,
  status          text not null default 'pending',   -- 'pending', 'running', 'success', 'failed'
  started_at      timestamptz,
  completed_at    timestamptz,
  evidence_count  integer default 0,
  error_message   text,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

alter table grc_collection_jobs enable row level security;
create policy "super_admins only" on grc_collection_jobs for all using (is_super_admin()) with check (is_super_admin());

-- ─── Seed: Compliance Frameworks ──────────────────────────────

insert into grc_frameworks (key, name, version, description) values
  ('soc2',      'SOC 2 Type II',              '2017',      'AICPA Trust Services Criteria — Security, Availability, Confidentiality'),
  ('iso27001',  'ISO/IEC 27001',              '2022',      'Information Security Management System (ISMS)'),
  ('iso27017',  'ISO/IEC 27017',              '2015',      'Cloud Security Controls'),
  ('iso27018',  'ISO/IEC 27018',              '2019',      'Protection of PII in Public Cloud'),
  ('iso27701',  'ISO/IEC 27701',              '2019',      'Privacy Information Management System (PIMS)'),
  ('iso42001',  'ISO/IEC 42001',              '2023',      'AI Management System'),
  ('cmmc2',     'CMMC Level 2',               '2.0',       'Cybersecurity Maturity Model Certification — 110 NIST SP 800-171 controls'),
  ('fedramp',   'FedRAMP Moderate',           'Rev5',      'NIST SP 800-53 Rev 5 Moderate baseline — 800+ controls')
on conflict (key) do nothing;

-- ─── Seed: SOC 2 Controls (core CC series) ────────────────────

with fw as (select id from grc_frameworks where key = 'soc2')
insert into grc_controls (framework_id, control_id, title, category) values
  ((select id from fw), 'CC1.1',  'COSO Principle 1 — Integrity and ethical values',                'Control Environment'),
  ((select id from fw), 'CC1.2',  'COSO Principle 2 — Board independence and oversight',            'Control Environment'),
  ((select id from fw), 'CC1.3',  'COSO Principle 3 — Organizational structure',                   'Control Environment'),
  ((select id from fw), 'CC1.4',  'COSO Principle 4 — Competence of personnel',                    'Control Environment'),
  ((select id from fw), 'CC1.5',  'COSO Principle 5 — Accountability',                             'Control Environment'),
  ((select id from fw), 'CC2.1',  'COSO Principle 13 — Relevant, quality information',             'Communication'),
  ((select id from fw), 'CC2.2',  'COSO Principle 14 — Internal communication',                    'Communication'),
  ((select id from fw), 'CC2.3',  'COSO Principle 15 — External communication',                    'Communication'),
  ((select id from fw), 'CC3.1',  'COSO Principle 6 — Objectives specification',                   'Risk Assessment'),
  ((select id from fw), 'CC3.2',  'COSO Principle 7 — Risk identification and analysis',           'Risk Assessment'),
  ((select id from fw), 'CC3.3',  'COSO Principle 8 — Fraud risk assessment',                      'Risk Assessment'),
  ((select id from fw), 'CC3.4',  'COSO Principle 9 — Change identification and assessment',       'Risk Assessment'),
  ((select id from fw), 'CC4.1',  'COSO Principle 16 — Ongoing/separate evaluations',              'Monitoring'),
  ((select id from fw), 'CC4.2',  'COSO Principle 17 — Deficiency communication and remediation',  'Monitoring'),
  ((select id from fw), 'CC5.1',  'COSO Principle 10 — Control activities selection',              'Control Activities'),
  ((select id from fw), 'CC5.2',  'COSO Principle 11 — Technology general controls',               'Control Activities'),
  ((select id from fw), 'CC5.3',  'COSO Principle 12 — Policies and procedures deployment',        'Control Activities'),
  ((select id from fw), 'CC6.1',  'Logical and physical access controls',                           'Logical Access'),
  ((select id from fw), 'CC6.2',  'New user access registration and authorization',                 'Logical Access'),
  ((select id from fw), 'CC6.3',  'Role-based access and principle of least privilege',             'Logical Access'),
  ((select id from fw), 'CC6.4',  'Physical access restrictions',                                   'Logical Access'),
  ((select id from fw), 'CC6.5',  'Logical access removal upon termination',                        'Logical Access'),
  ((select id from fw), 'CC6.6',  'External threat protection',                                     'Logical Access'),
  ((select id from fw), 'CC6.7',  'Transmission and disclosure restrictions',                       'Logical Access'),
  ((select id from fw), 'CC6.8',  'Unauthorized software prevention',                               'Logical Access'),
  ((select id from fw), 'CC7.1',  'Vulnerability detection and infrastructure monitoring',          'System Operations'),
  ((select id from fw), 'CC7.2',  'Anomaly and security event monitoring',                          'System Operations'),
  ((select id from fw), 'CC7.3',  'Incident response and evaluation',                               'System Operations'),
  ((select id from fw), 'CC7.4',  'Incident response procedures',                                   'System Operations'),
  ((select id from fw), 'CC7.5',  'Incident recovery and communications',                           'System Operations'),
  ((select id from fw), 'CC8.1',  'Change management process',                                      'Change Management'),
  ((select id from fw), 'CC9.1',  'Risk mitigation activities',                                     'Risk Mitigation'),
  ((select id from fw), 'CC9.2',  'Vendor and business partner risk management',                    'Risk Mitigation')
on conflict (framework_id, control_id) do nothing;

-- ─── Seed: CMMC Level 2 domains (abbreviated) ────────────────

with fw as (select id from grc_frameworks where key = 'cmmc2')
insert into grc_controls (framework_id, control_id, title, category) values
  ((select id from fw), 'AC.L2-3.1.1',   'Authorized access control',                          'Access Control'),
  ((select id from fw), 'AC.L2-3.1.2',   'Transaction and function control',                   'Access Control'),
  ((select id from fw), 'AC.L2-3.1.3',   'Control CUI flow',                                   'Access Control'),
  ((select id from fw), 'AC.L2-3.1.5',   'Principle of least privilege',                       'Access Control'),
  ((select id from fw), 'AC.L2-3.1.6',   'Non-privileged account use',                         'Access Control'),
  ((select id from fw), 'AC.L2-3.1.12',  'Remote access control',                              'Access Control'),
  ((select id from fw), 'AU.L2-3.3.1',   'Create and retain system audit logs',                'Audit & Accountability'),
  ((select id from fw), 'AU.L2-3.3.2',   'Ensure actions of individual users traceable',       'Audit & Accountability'),
  ((select id from fw), 'CM.L2-3.4.1',   'System baseline configurations',                     'Configuration Management'),
  ((select id from fw), 'CM.L2-3.4.2',   'Establish settings for config management',           'Configuration Management'),
  ((select id from fw), 'IA.L2-3.5.3',   'Multifactor authentication',                         'Identification & Authentication'),
  ((select id from fw), 'IA.L2-3.5.7',   'Password complexity enforcement',                    'Identification & Authentication'),
  ((select id from fw), 'IR.L2-3.6.1',   'Incident response capability',                       'Incident Response'),
  ((select id from fw), 'IR.L2-3.6.2',   'Incident tracking, documentation, reporting',        'Incident Response'),
  ((select id from fw), 'MA.L2-3.7.1',   'Perform system maintenance',                         'Maintenance'),
  ((select id from fw), 'MP.L2-3.8.1',   'Protect system media',                               'Media Protection'),
  ((select id from fw), 'PS.L2-3.9.1',   'Screen individuals prior to access',                 'Personnel Security'),
  ((select id from fw), 'RA.L2-3.11.1',  'Risk assessments',                                   'Risk Assessment'),
  ((select id from fw), 'RA.L2-3.11.2',  'Vulnerability scanning',                             'Risk Assessment'),
  ((select id from fw), 'RA.L2-3.11.3',  'Remediate vulnerabilities',                          'Risk Assessment'),
  ((select id from fw), 'SA.L2-3.12.1',  'Periodically assess security controls',              'Security Assessment'),
  ((select id from fw), 'SC.L2-3.13.1',  'Monitor, control, protect communications',           'System & Comm. Protection'),
  ((select id from fw), 'SC.L2-3.13.8',  'Implement cryptographic mechanisms',                 'System & Comm. Protection'),
  ((select id from fw), 'SI.L2-3.14.1',  'Identify and correct system flaws',                  'System & Info. Integrity'),
  ((select id from fw), 'SI.L2-3.14.2',  'Malicious code protection',                          'System & Info. Integrity'),
  ((select id from fw), 'SI.L2-3.14.6',  'Monitor systems for attacks',                        'System & Info. Integrity'),
  ((select id from fw), 'SR.L2-3.17.1',  'Supply chain risk management plan',                  'Supply Chain Risk Mgmt')
on conflict (framework_id, control_id) do nothing;

-- ─── Auto-create implementations for all seeded controls ──────

insert into grc_implementations (control_id, status)
select id, 'not_started'
from grc_controls
where id not in (select control_id from grc_implementations)
on conflict (control_id) do nothing;
