# Chaplain Connect — Master Design Spec

> **Status:** Phases 1–4 complete. Phases 5–7 + Integration Sprint are the active roadmap.
> **Last updated:** 2026-04-26

**Goal:** A multi-tenant B2B SaaS platform that delivers remote chaplaincy and ministry services to enterprise customers (hospitals, nonprofits, DoD, government agencies), backed by a full internal compliance, data governance, and AIOps stack that enables SOC 2 Type II, ISO 27001/17/18/701/42001, CMMC Level 2, and FedRAMP Moderate certification.

---

## Table of Contents

1. [Business Model](#1-business-model)
2. [User Types & Roles](#2-user-types--roles)
3. [Architecture Overview](#3-architecture-overview)
4. [Full Tech Stack](#4-full-tech-stack)
5. [Phase 1 — Foundation ✅](#5-phase-1--foundation-)
6. [Phase 2 — Ministry Platform ✅](#6-phase-2--ministry-platform-)
7. [Phase 3 — GRC Engine ✅](#7-phase-3--grc-engine-)
8. [Phase 4 — Data Lineage & Privacy Governance ✅](#8-phase-4--data-lineage--privacy-governance-)
9. [Phase 5 — Agent Infrastructure & PrivacyAgent](#9-phase-5--agent-infrastructure--privacyagent)
10. [Phase 6 — Security, Compliance & Data Agents](#10-phase-6--security-compliance--data-agents)
11. [Phase 7 — AIOps & DiagnosticsAgent](#11-phase-7--aiops--diagnosticsagent)
12. [Integration Sprint](#12-integration-sprint)
13. [Compliance Roadmap](#13-compliance-roadmap)
14. [Infrastructure & Deployment](#14-infrastructure--deployment)
15. [Open Decisions](#15-open-decisions)

---

## 1. Business Model

**Model:** B2B Multi-Tenant SaaS — each customer organization (hospital, DoD unit, nonprofit) gets an isolated workspace with their own chaplains, users, branding, and data.

**Pricing tiers:**

| Tier | Price | Chaplains | Users | Notes |
|---|---|---|---|---|
| Starter | $99/mo | 3 | 50 | Nonprofits, small orgs |
| Professional | $299/mo | 10 | 500 | Mid-size hospitals, agencies |
| Enterprise | Custom | Unlimited | Unlimited | HIPAA BAA, SLA, dedicated support |

- Annual billing preferred (10–20% discount) — required for government procurement
- Enterprise contracts include HIPAA BAA, SOC 2 report access, dedicated instance option
- Platform fee model: Chaplain Connect charges the organization, not end users

**Target customers (in priority order):**
1. Hospitals & healthcare systems (HIPAA required)
2. Nonprofit chaplaincy organizations
3. DoD / military installations (CMMC + FedRAMP path)
4. Federal/state government agencies

---

## 2. User Types & Roles

### Platform-level (Chaplain Connect internal)
- **Super Admin** — Chaplain Connect team. Full access to all orgs, all internal tools (GRC, Privacy, Agents, AIOps).

### Organization-level (per customer org)
- **Org Admin** — Manages their org's chaplains, users, settings, billing.
- **Chaplain** — Service provider. Conducts sessions, posts content, manages calendar.
- **End User / Client** — Person receiving ministry services. Books sessions, joins video calls, uses chat.

### Data scope rule
Every piece of data in the system is scoped to an org via Row Level Security (RLS) in Supabase. A chaplain from Org A cannot see anything from Org B. Super Admins can see cross-org data only through audited internal tools.

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    chaplain-connect.com                           │
│                                                                   │
│  CUSTOMER-FACING                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │               Ministry Platform  (Phase 2 ✅)               │ │
│  │  Live Video │ Chat │ Video Library │ Scheduling │ Bible      │ │
│  │  Content/Posts │ AI Chaplain Assistant (Groq)               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  INTERNAL (Chaplain Connect team only — super_admin)              │
│  ┌───────────────────┐  ┌──────────────────────────────────────┐ │
│  │  GRC Engine ✅    │  │  Data Lineage & Privacy ✅           │ │
│  │  Phase 3          │  │  Phase 4                             │ │
│  │  Controls │ Vulns │  │  Data Map │ ROPA │ PIA/DPIA/TIA      │ │
│  └───────────────────┘  └──────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────┐│
│  │              Agent Infrastructure (Phase 5)                   ││
│  │  Agent Registry │ Rules Engine │ Decision Log │ Approval Queue││
│  │                                                               ││
│  │  PrivacyAgent  │ SecurityAgent │ ComplianceAgent              ││
│  │  RetentionAgent │ DSARAgent │ DataAgent │ DiagnosticsAgent    ││
│  └───────────────────────────────────────────────────────────────┘│
│  ┌──────────────────────┐  ┌──────────────────────────────────┐  │
│  │  Data Lifecycle      │  │  AIOps & Self-Diagnostics        │  │
│  │  (Phase 5C)          │  │  (Phase 7)                       │  │
│  │  DSAR │ Deletion     │  │  OTel │ Prometheus │ Grafana      │  │
│  └──────────────────────┘  └──────────────────────────────────┘  │
│                                                                   │
│  FOUNDATION  (Phase 1 ✅)                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Next.js (App Router) │ Supabase │ Stripe │ Groq            │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Key architectural principles:**
- Multi-tenancy enforced at the database layer via Supabase RLS — not application logic
- All internal tools (GRC, Privacy, Agents) are super_admin only — invisible to customers
- Every agent action is deterministic rules + Groq reasoning — LLMs explain and recommend, rules decide
- Human approval gates required for all destructive actions (deletion, access revocation)
- Every agent run, decision, and action produces GRC evidence automatically
- All PII encrypted at rest (AES-256) and in transit (TLS 1.3)
- Audit logs are append-only and tamper-evident (hash-chained)

---

## 4. Full Tech Stack

### Core Application
| Layer | Technology | Reason |
|---|---|---|
| Frontend framework | Next.js (App Router) | Vercel-native, React Server Components |
| Hosting | Vercel | Serverless, global CDN, preview deployments |
| Database | Supabase (PostgreSQL) | Auth + DB + Realtime + Storage in one, RLS for multi-tenancy |
| Auth | Supabase Auth | Built-in, integrates with RLS, supports OAuth + MFA |
| UI components | shadcn/ui + Radix UI | Accessible, Tailwind-based, code-owned |
| Styling | Tailwind CSS | Utility-first, consistent design system |
| Rich text editor | Tiptap | Extensible, React-first, ProseMirror-based |
| Payments | Stripe | Subscriptions, invoicing, HIPAA-eligible |
| Email | Resend + React Email | React component templates, 3k/mo free |
| File storage | Supabase Storage | Integrated auth/RLS, S3-compatible |
| Large media storage | Cloudflare R2 | Zero egress fees for large video files |
| Language | TypeScript | Type safety across full stack |
| Package manager | Bun | Fast installs and runtime |

### Ministry Services
| Feature | Technology |
|---|---|
| Live video/audio | LiveKit (self-hosted or cloud free tier) |
| Video upload + streaming | Mux (free tier: 100k delivery min/mo) |
| Real-time chat | Supabase Realtime (Postgres + WebSockets) |
| Bible content | bible.helloao.org API (free, no key, 1000+ translations) |
| AI chat assistant | Groq (llama-3.3-70b-versatile, 14,400 req/day free) |
| Scheduling | Cal.com (self-hosted or cloud) |

### Agent Infrastructure & AI
| Feature | Technology |
|---|---|
| Agent reasoning layer | Groq (llama-3.3-70b-versatile) |
| Agent scheduling | pg_cron (Supabase) + Next.js API webhooks |
| Rules engine | Custom deterministic JSON rules + PostgreSQL |
| Agent decision storage | Supabase PostgreSQL |
| Regulatory intelligence | Groq + web search for new law detection |

### GRC & Compliance
| Feature | Technology |
|---|---|
| Vulnerability scanning | Trivy (containers + code) |
| IaC scanning | Checkov |
| Secret scanning | Gitleaks |
| SBOM generation | Syft + Grype |
| SAST | Semgrep + CodeQL |

### Data Governance
| Feature | Technology |
|---|---|
| Data catalog + lineage | Custom (data_locations table, Phase 4 ✅) |
| Privacy assessments | Custom (privacy_assessments table, Phase 4 ✅) |
| PIA/DPIA/ROPA builder | Custom (Next.js + Supabase, Phase 4 ✅) |
| Consent management | Custom (Phase 5B — PrivacyAgent) |
| Regulation registry | Custom (Phase 5B — PrivacyAgent) |

### AIOps & Observability
| Feature | Technology |
|---|---|
| Instrumentation | OpenTelemetry SDK |
| Metrics | Prometheus |
| Logs | Grafana Loki |
| Traces | Grafana Tempo |
| Dashboards | Grafana |
| AI diagnostic engine | Groq (DiagnosticsAgent, Phase 7) |

---

## 5. Phase 1 — Foundation ✅

**Status: Complete**

Built: multi-tenant org infrastructure, Supabase Auth, RBAC (super_admin / org_admin / chaplain / end_user), RLS policies, Stripe billing scaffold, org onboarding, hash-chained audit logs, team management, profile management, settings.

---

## 6. Phase 2 — Ministry Platform ✅

**Status: Complete**

Built: real-time chat (Supabase Realtime), Bible content browser (bible.helloao.org), AI chaplain assistant (Groq llama-3.3-70b-versatile), sessions scaffold (LiveKit-ready), video library scaffold (Mux-ready), scheduling scaffold (Cal.com-ready), content/posts (Tiptap rich text editor), CI/CD pipeline (Gitleaks, Trivy, CodeQL, Semgrep, Checkov, SBOM, Dependabot).

---

## 7. Phase 3 — GRC Engine ✅

**Status: Complete**

Built: grc_frameworks (8 seeded), grc_controls (60 controls: SOC 2 + CMMC Level 2), grc_implementations, grc_evidence (append-only, SHA-256 hashed), grc_vulnerabilities, grc_risks (L×I scoring), GRC dashboard at /dashboard/grc (super_admin only) with 5-tab UI: Overview, Controls, Vulnerabilities, Risks, Evidence.

**Remaining GRC work (see Integration Sprint §12):**
- Seed ISO 27001, ISO 27017, ISO 27018, ISO 27701, ISO 42001, FedRAMP Moderate controls
- GitHub Actions → GRC evidence auto-ingestion webhook
- OWASP ZAP scheduled scan integration

---

## 8. Phase 4 — Data Lineage & Privacy Governance ✅

**Status: Complete**

Built: data_locations table (19 PII fields mapped across all platform tables), privacy_assessments + privacy_assessment_sections (ROPA, PIA, DPIA, TIA), default GDPR Article 30 ROPA pre-filled with 8 sections, Privacy dashboard at /dashboard/privacy (super_admin only) with 4-tab UI: Data Map, ROPA, Assessments, Reports. PII scan endpoint. JSON export for audit packages.

---

## 9. Phase 5 — Agent Infrastructure & PrivacyAgent

**Status: Next to build**

**Goal:** Replace passive scanners with a living, autonomous agent system. The Agent Infrastructure is the foundation every current and future agent runs on. The PrivacyAgent is the first and most comprehensive agent — a continuously operating system that knows every privacy regulation on earth, manages consent across all jurisdictions, generates and maintains all privacy assessments, enforces privacy by design in the development process, and updates itself as new regulations emerge. Forever.

---

### 9A — Agent Infrastructure (build first)

The shared foundation all agents use. No agent is built without this.

#### Database schema

```sql
-- All registered agents and their current state
agent_registry
  id, name, description, agent_type, status (active/paused/disabled),
  schedule_cron, last_run_at, next_run_at, config (jsonb), created_at

-- Every execution of an agent
agent_runs
  id, agent_id, triggered_by (scheduled/event/manual),
  started_at, completed_at, status (running/completed/failed),
  findings_count, actions_taken, error (text)

-- Every decision an agent makes (the full reasoning trail)
agent_decisions
  id, run_id, agent_id,
  decision_type (finding/action/escalation/evidence),
  severity (info/low/medium/high/critical),
  title, description,
  groq_reasoning (text),          -- Groq's plain-English analysis
  rule_triggered (text),          -- which rule fired
  proposed_action (text),         -- what the agent wants to do
  requires_human_approval (bool),
  approval_status (pending/approved/rejected/auto_approved),
  approved_by (uuid → profiles),
  approved_at,
  action_executed_at,
  action_result (jsonb),
  grc_finding_id (uuid → grc_evidence),  -- auto-linked
  created_at

-- Configurable rules per agent type (versioned)
agent_rules
  id, agent_id, rule_key, rule_name, description,
  condition (jsonb),              -- what triggers this rule
  action (jsonb),                 -- what the agent does
  severity, requires_approval,
  human_gate_level (none/notify/approve/always),
  sla_hours (int),                -- escalate if not resolved in N hours
  is_active, version, created_at

-- Human approval queue
agent_approval_queue
  id, decision_id (→ agent_decisions),
  assigned_to (uuid → profiles),
  due_at, resolved_at,
  resolution_notes, created_at
```

#### Agent base behavior

Every agent follows this loop:
1. **Trigger** — scheduled (pg_cron), event-driven (Supabase webhook), or manual
2. **Gather** — query relevant data sources
3. **Evaluate** — run deterministic rules against gathered data
4. **Reason** — for findings above LOW severity, call Groq to generate a plain-English risk narrative and recommendation
5. **Decide** — based on rule's `human_gate_level`: auto-act, notify, or queue for approval
6. **Act** — execute approved actions (update DB, create GRC finding, send notification, propose deletion)
7. **Record** — write `agent_decisions` record, emit GRC evidence automatically
8. **Report** — update agent_runs with summary

#### Key design rules
- **Rules are deterministic. Groq is explanatory.** The rules engine decides what to do. Groq explains why in plain English so humans can make fast approval decisions. LLMs never make autonomous compliance decisions.
- **Human gates are sacred.** Any action that modifies, deletes, or restricts data requires human approval. No exceptions.
- **Every action is audited.** All agent decisions, approvals, and actions write to audit_logs and grc_evidence automatically.
- **Agents are pausable.** Any agent can be paused from /dashboard/agents without code changes.
- **Rules are versioned.** Changes to agent rules are GRC events themselves (logged, linked to CC6.1).

#### Dashboard: /dashboard/agents (super_admin only)
- Agent registry: name, type, status (active/paused), last run, next run, findings this week
- Run history: per-agent timeline of every run and its outcome
- Decision queue: open decisions awaiting human approval (sortable by severity, SLA)
- Rules editor: view/edit/version rules per agent
- Evidence trail: all GRC evidence produced by agents

---

### 9B — PrivacyAgent (build second)

**The most comprehensive agent. Runs perpetually. Knows every privacy regulation on earth. Manages consent. Enforces privacy by design. Updates itself as laws change.**

#### 9B.1 — Regulation Registry

```sql
privacy_regulations
  id, jurisdiction_code,    -- 'EU', 'US-CA', 'US-VA', 'BR', 'IN', 'CN', 'UK', 'AU', 'TH', 'SG', etc.
  jurisdiction_name,        -- 'European Union', 'California, USA', 'Brazil', etc.
  regulation_name,          -- 'GDPR', 'CCPA/CPRA', 'LGPD', 'PDPA', 'PIPL', 'DPDP', etc.
  effective_date,
  last_amended_date,
  authority_name,           -- 'European Data Protection Board', 'California AG', etc.
  authority_url,
  requirements (jsonb):
    consent_required: bool           -- must obtain affirmative consent
    opt_out_model: bool              -- opt-out rather than opt-in (CCPA)
    right_to_erasure: bool
    right_to_portability: bool
    right_to_access: bool
    right_to_object: bool
    right_to_restrict: bool
    dpia_required: bool
    dpia_threshold: text             -- 'high_risk' | 'systematic' | 'large_scale'
    ropa_required: bool
    dpo_required: bool
    breach_notification_hours: int   -- 72 for GDPR, 72 for LGPD, etc.
    max_retention_days: int | null
    cookie_consent_required: bool
    cookie_opt_in: bool              -- opt-in (GDPR) vs opt-out (some US laws)
    sensitive_categories: text[]     -- health, biometric, financial, etc.
    cross_border_transfer_mechanism: text[]  -- SCCs, BCRs, adequacy, etc.
    children_age_threshold: int      -- COPPA: 13, GDPR: 16
    penalties_max_eur: bigint | null
    source_url: text
  is_active: bool
  created_at, updated_at

-- Adequacy decisions (which country-to-country transfers are pre-approved)
privacy_adequacy_decisions
  id, from_jurisdiction, to_jurisdiction, mechanism,
  valid_from, valid_until, source_url, notes
```

**Initial regulation seed (19 regulations across 4 continents):**
- EU: GDPR (2018)
- UK: UK GDPR + Data Protection Act 2018
- Brazil: LGPD (2020)
- California: CCPA (2020) + CPRA amendments (2023)
- Virginia: VCDPA (2023)
- Colorado: CPA (2023)
- Connecticut: CTDPA (2023)
- Texas: TDPSA (2024)
- Thailand: PDPA (2022)
- Singapore: PDPA (2021)
- China: PIPL (2021)
- India: DPDP Act (2023)
- Japan: APPI amended (2022)
- South Korea: PIPA (2023 amendment)
- Australia: Privacy Act 1988 (2022 amendment)
- UAE: PDPL (2022)
- Canada: PIPEDA → proposed CPPA
- USA federal: HIPAA (healthcare), COPPA (children)
- USA federal: FERPA (education records)

#### 9B.2 — Jurisdiction Mapper

```sql
-- Per-user jurisdiction profile (updated by PrivacyAgent on login/activity)
user_jurisdiction_profiles
  id, user_id, org_id,
  detected_country,        -- from IP geolocation
  declared_residency,      -- user-stated (overrides detection)
  applicable_regulations,  -- jsonb array of regulation IDs that apply
  highest_protection_level, -- the most stringent regulation applying to this user
  last_evaluated_at, created_at
```

**Jurisdiction mapping logic:**
1. IP geolocation on first login → detect country
2. User's stored location (profile) → overrides detection
3. Data type → HIPAA applies to any user whose health data is processed, regardless of location
4. Org's registered jurisdiction → adds org-level requirements
5. Result: array of all applicable regulations + the "most stringent applicable rule" for each right

For any decision (consent, erasure, portability), the agent always applies the most stringent applicable regulation to that user.

#### 9B.3 — Consent Management Platform

```sql
-- Granular consent records (the legal evidence of consent)
consent_records
  id, user_id, org_id,
  purpose,                 -- 'ai_assistance' | 'session_recording' | 'analytics' | 'marketing' | 'pastoral_chat'
  regulation_id,           -- which regulation this consent satisfies
  consent_type,            -- 'explicit_opt_in' | 'opt_out' | 'legitimate_interests' | 'contract'
  granted_at,
  withdrawn_at,            -- null if active
  ip_address,
  user_agent,
  consent_string,          -- base64-signed proof
  privacy_policy_version,  -- which version of the policy they consented to
  method,                  -- 'cookie_banner' | 'signup_flow' | 'settings' | 'api'
  is_active: bool

-- Cookie consent per user per category (mapped to IAB TCF v2.2 categories)
cookie_consent_records
  id, anonymous_id, user_id (nullable — pre-auth),
  org_id, jurisdiction_id,
  necessary: bool,         -- always true, no consent needed
  functional: bool,
  analytics: bool,
  marketing: bool,
  personalization: bool,
  consent_string,          -- TCF v2.2 compatible
  granted_at, updated_at, withdrawn_at,
  ip_address

-- Consent withdrawal cascade log
consent_withdrawal_events
  id, user_id, org_id, purpose, withdrawn_at,
  triggered_agent_run_id,  -- the RetentionAgent run that executed deletion
  deletion_receipt_id,     -- links to the deletion receipt
  status (pending/processing/completed)
```

**Consent API surface:**
- `GET /api/consent/status?userId=&purposes[]=` — what has this user consented to?
- `POST /api/consent/grant` — record consent grant
- `POST /api/consent/withdraw` — record withdrawal (triggers RetentionAgent)
- `GET /api/consent/cookie` — get cookie preferences for banner
- `POST /api/consent/cookie` — save cookie preferences
- `GET /api/consent/export?userId=` — DSAR: export all consent records for a user

**Cookie consent banner:**
- Jurisdiction-aware: EU/UK users see opt-in modal (required before any non-necessary cookies). US users see opt-out bar. Other jurisdictions mapped to their requirement.
- Per-org white-labeled: org can customize banner text, colors, and logo
- IAB TCF v2.2 compatible consent string generation
- Stores anonymous_id before user auth so consent is captured from first page load

#### 9B.4 — Continuous Assessment Engine

The PrivacyAgent continuously reconciles the ROPA, triggers PIAs/DPIAs, and maintains all privacy assessments — no manual triggering required.

**ROPA auto-maintenance:**
- Runs daily
- Queries `data_locations` for any new entries since last ROPA update
- Queries `consent_records` for new processing purposes
- Queries `user_jurisdiction_profiles` for new jurisdictions where users exist
- Updates ROPA sections automatically (data categories, recipients, transfers, legal basis)
- Flags sections that need human review (new recipient, new jurisdiction, new data type)
- Produces GRC evidence: "ROPA reviewed and updated — N changes, M sections require review"

**PIA auto-trigger rules:**
```
WHEN new API route detected (via CI/CD webhook) AND route writes to PII column
→ create PIA draft, pre-fill from context (which table/column, what data flows, who has access)
→ require human sign-off before route ships to production

WHEN new third-party service added (new env var matching known service patterns)
→ create PIA draft, flag: "confirm DPA exists with [service name]"
→ notify super_admin

WHEN data_locations adds a new entry with is_pii = true
→ evaluate: is there a legal basis? Is there a consent mechanism? Is retention period defined?
→ if any missing: create PIA, flag gaps
```

**DPIA auto-trigger rules (GDPR Art. 35 compliance):**
```
WHEN new data_locations entry has data_category = 'health_data'
→ auto-trigger DPIA (high-risk processing)

WHEN new data_locations entry has data_category = 'biometric_data'
→ auto-trigger DPIA

WHEN AI model trained on user data (ai_messages volume > 10,000 records)
→ auto-trigger DPIA (large-scale profiling)

WHEN processing involves children (user age < applicable threshold per jurisdiction)
→ auto-trigger DPIA + COPPA/GDPR Art. 8 assessment

WHEN systematic monitoring of behavior detected
→ auto-trigger DPIA
```

**TIA auto-trigger rules:**
```
WHEN new third-party service detected in env vars
→ geolocate the service's servers
→ IF servers outside EU/UK/adequate countries:
   → create TIA draft, pre-fill: from jurisdiction, to jurisdiction, data categories transferred
   → require sign-off before service is used in production
```

#### 9B.5 — Privacy by Design Enforcer

Integrates into the development process — privacy is a property of code, not an afterthought.

**CI/CD integration (GitHub Actions webhook → /api/agents/privacy/pr-check):**

When a PR is opened, the PrivacyAgent evaluates:

1. **New DB migration detected?**
   - New columns with PII-like names (email, name, phone, ssn, dob, address, ip_address, location)?
     → Require: entry in data_locations, legal_basis defined, retention_days set
   - New table with no RLS policies?
     → Block: all tables with PII must have RLS
   - New column without a corresponding consent mechanism?
     → Flag: how will users consent to this processing?

2. **New API route detected?**
   - Route writes to a PII column without a corresponding consent check?
     → Flag: ensure consent is verified before write
   - Route reads PII without appropriate access control?
     → Flag: verify RLS + role check

3. **New package/dependency added?**
   - Known data-collecting packages (analytics, tracking)?
     → Require: DPA review, consent gate, data_locations entry
   - Package with known data-sharing behavior?
     → Flag for privacy review

4. **New environment variable that looks like a third-party API key?**
   - Pattern matching against known services
   - If data-processing service: require TIA + DPA documentation

**PR comment bot posts:**
```
🔒 Privacy by Design Check — PrivacyAgent

✅ All new columns registered in data_locations
✅ RLS policies present on new tables
⚠️  New column `session_notes` has no legal_basis defined
    → Action required: add legal_basis to data_locations entry

❌ New env var ANALYTICS_KEY detected — no TIA on file for this service
    → Action required: complete TIA at /dashboard/privacy/assessments

Overall: NEEDS REVIEW — 2 items require attention before merge
```

#### 9B.6 — Perpetual Regulatory Intelligence

The PrivacyAgent doesn't just know today's laws — it learns new ones.

**Regulation monitoring (weekly scheduled run):**
1. Search for new privacy law announcements, amendments, and enforcement actions using Groq + web search
2. For each detected change: extract jurisdiction, effective date, key requirements
3. Create a draft `privacy_regulations` entry with Groq-extracted requirements
4. Route to super_admin for review: "New regulation detected: [name]. Here's what it requires. Confirm to activate."
5. Once confirmed: agent evaluates platform against the new regulation and creates a compliance gap report

**Enforcement tracker:**
- Monitor major privacy enforcement actions (GDPR fines, FTC settlements, CCPA enforcement)
- When a fine involves a practice Chaplain Connect uses: create GRC finding with remediation recommendation
- Feed into risk register automatically

**Policy version management:**
- Track privacy policy versions
- When policy changes: identify which users need re-consent under each regulation
- Generate re-consent campaign list
- Track re-consent completion rate

#### 9B.7 — Compliance Scoring Dashboard

At any moment, for any regulation:

```
GDPR        ████████░░  84%  — 3 open gaps
UK GDPR     ████████░░  82%  — derives from GDPR + 2 UK-specific gaps
HIPAA       ██████░░░░  63%  — BAA with Groq not yet executed ← CRITICAL
CCPA/CPRA   █████████░  91%  — opt-out mechanism needs testing
LGPD        ████░░░░░░  45%  — Brazilian users not yet configured
PDPA        ████░░░░░░  40%  — not yet evaluated for Thai users
PIPL        ░░░░░░░░░░   0%  — no Chinese user data, mark N/A?
India DPDP  ██░░░░░░░░  20%  — new regulation, gap assessment in progress
```

Each gap is a linked actionable item with: severity, regulation citation, remediation steps, due date.

**Delivered at /dashboard/privacy (enhanced) with new tabs:**
- Regulations (registry + compliance scores)
- Consent (live consent records, withdrawal requests, cookie analytics)
- Assessments (ROPA, PIAs, DPIAs, TIAs — auto-populated)
- Privacy by Design (PR check history, open flags)
- Agent Log (every PrivacyAgent decision with reasoning)

---

### 9C — RetentionAgent & DSARAgent

Completes the original Phase 5 data lifecycle management — now built as agents on the Agent Infrastructure.

#### Database additions

```sql
-- Data violation tracker (CVV in wrong place, PII outside expected location, etc.)
data_violations
  id, detected_by_run_id,
  violation_type,           -- 'pii_outside_expected_location' | 'prohibited_data_type' | 'policy_breach'
  severity,
  table_name, column_name, row_identifier,
  pattern_detected,         -- 'credit_card_pan' | 'cvv' | 'ssn' | 'email_in_logs' | etc.
  sample_masked,            -- e.g. '4111-XXXX-XXXX-1111' — never store the real value
  policy_violated,          -- e.g. 'PCI DSS 3.2.1 — CVV must not be stored'
  status (open/acknowledged/remediated/false_positive),
  resolution_notes,
  grc_finding_id,
  created_at, resolved_at

-- DSAR (Data Subject Access Requests)
dsar_requests
  id, org_id, subject_user_id, requested_by,
  request_type (access/erasure/portability/rectification/restriction/objection),
  status (received/processing/completed/rejected),
  received_at, due_at,      -- 30-day SLA default, 45 days CCPA
  completed_at,
  export_url,               -- signed URL to the export package
  rejection_reason,
  regulation_id,            -- which regulation governs this request
  agent_run_id,             -- the DSARAgent run that processed it
  deletion_receipt_id       -- if erasure, link to the receipt

-- Retention policy per data category (configurable per org within platform limits)
retention_policies
  id, org_id (null = platform default), data_category,
  retention_days, legal_minimum_days, legal_maximum_days,
  legal_citation,           -- e.g. 'GDPR Art. 5(1)(e) — storage limitation'
  is_active, created_at, updated_at

-- Deletion receipts (cryptographically signed proof of deletion)
deletion_receipts
  id, org_id, subject_user_id,
  request_type,             -- 'retention_expiry' | 'erasure_request' | 'org_offboarding'
  initiated_by (agent/human), initiated_at,
  completed_at,
  deleted_records (jsonb),  -- array of {system, table, row_id, columns_deleted, deleted_at, hash}
  verification_scan_at,
  verification_result,      -- 'all_locations_clear' | 'residual_data_found'
  receipt_hash,             -- SHA-256 of the entire receipt
  signature                 -- Ed25519 signature
```

**RetentionAgent rules (examples):**
```
WHEN data age > retention_days AND data_category = 'message_content'
→ severity = MEDIUM
→ human_gate = APPROVE
→ proposed_action = batch_delete + generate_receipt

WHEN data age > retention_days AND data_category = 'health_data'
→ severity = HIGH
→ human_gate = ALWAYS (never auto-delete health data)
→ proposed_action = flag_for_deletion + notify_super_admin + create_grc_finding

WHEN data age > retention_days AND data_category = 'financial_data'
→ severity = LOW
→ check: does legal_minimum override retention policy?
→ if yes: defer deletion, log deferral
→ if no: human_gate = APPROVE
```

**DataAgent (column scanner) rules:**
```
WHEN regex scan finds CVV pattern in text/jsonb column NOT in whitelist
→ severity = CRITICAL
→ human_gate = ALWAYS
→ proposed_action = create_violation, create_grc_finding (PCI DSS 3.2.1), alert_super_admin
→ SLA = 4 hours

WHEN regex scan finds credit card PAN in any column
→ severity = CRITICAL
→ same as above

WHEN regex scan finds SSN pattern outside whitelisted columns
→ severity = HIGH
→ human_gate = APPROVE
→ proposed_action = create_violation, create_grc_finding, propose_deletion

WHEN regex scan finds email in audit_logs.metadata
→ severity = MEDIUM
→ human_gate = NOTIFY
→ proposed_action = create_violation, flag_for_review
```

**DSARAgent workflow:**
1. Request received via form or API → creates `dsar_requests` record
2. Agent runs immediately: queries `data_locations` index for all records matching `subject_user_id`
3. Queries all mapped tables/columns for the subject's data
4. Generates structured export (JSON + human-readable format)
5. For erasure requests: creates deletion proposal → human approves → executes cascade deletion → generates deletion receipt
6. SLA monitoring: 30-day counter. At 25 days: escalate. At 30 days: critical GRC finding.
7. All steps produce GRC evidence (ISO 27701 compliance)

---

## 10. Phase 6 — Security, Compliance & Data Agents

**Status: Planned — builds on Phase 5 Agent Infrastructure**

**Goal:** Extend the Agent Infrastructure with agents that continuously monitor security posture, compliance health, and data integrity.

### SecurityAgent

**Watches:** auth events, API patterns, secret exposure, access anomalies

**Rules:**
```
WHEN failed_login_count > 5 from same IP in 10 minutes
→ severity = HIGH, human_gate = NOTIFY
→ proposed_action = flag IP, notify admin, suggest rate limiting

WHEN new user added with super_admin role (not via approved workflow)
→ severity = CRITICAL, human_gate = ALWAYS
→ proposed_action = alert immediately, log to GRC (CC6.2)

WHEN Gitleaks detects secret in commit
→ severity = CRITICAL, human_gate = ALWAYS
→ proposed_action = alert, link to secret rotation SOP, create GRC finding

WHEN API route accessed > 1000 times/minute from single origin (non-whitelisted)
→ severity = HIGH, human_gate = NOTIFY
→ proposed_action = flag, suggest DDoS protection review

WHEN new super_admin login from unrecognized country
→ severity = MEDIUM, human_gate = NOTIFY
→ proposed_action = MFA challenge already required, log anomaly, notify
```

**Evidence produced:** every rule evaluation, every finding → linked to SOC 2 CC6.x, ISO 27001 A.9.x controls

### ComplianceAgent

**Watches:** GRC control staleness, evidence freshness, audit deadlines, framework coverage

**Rules:**
```
WHEN grc_control has no evidence for > 90 days
→ severity = MEDIUM, human_gate = NOTIFY
→ proposed_action = mark control stale, notify control owner, generate evidence request

WHEN grc_control.status = 'implemented' but 0 evidence records
→ severity = HIGH, human_gate = NOTIFY
→ proposed_action = flag: "implemented without evidence — won't survive audit"

WHEN overall compliance score drops > 5% in any framework
→ severity = HIGH, human_gate = NOTIFY
→ proposed_action = identify which controls dropped, generate remediation plan

WHEN SOC 2 observation window < 90 days from target report date
→ severity = HIGH, human_gate = NOTIFY
→ proposed_action = generate readiness checklist, flag open controls

WHEN new vulnerability in grc_vulnerabilities with severity = critical AND age > 7 days
→ severity = CRITICAL, human_gate = NOTIFY
→ proposed_action = escalate to owner, create SLA breach finding
```

### DataAgent (enhanced from Phase 4 scanner)

The full column-level PII scanner — runs against real data, not just schema.

**Technical approach:**
- Uses Supabase admin client to run regex queries against all text/jsonb columns registered in data_locations
- For each column: SELECT rows where content matches PII patterns (email, card PAN, CVV, SSN, phone, DOB)
- Returns: count of matches + first 3 masked samples
- Never stores the raw matched value — only the pattern type, location, and masked preview
- Runs daily in off-peak hours

**PII detection patterns:**
| Pattern | Regex | Severity if found outside whitelist |
|---|---|---|
| Credit card PAN | `\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b` | CRITICAL (PCI DSS) |
| CVV | `\b\d{3,4}\b` near card context | CRITICAL (PCI DSS 3.2.1) |
| SSN | `\b\d{3}-\d{2}-\d{4}\b` | HIGH (HIPAA / CCPA) |
| Email | `[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}` | MEDIUM (GDPR) |
| US Phone | `(\+?1)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}` | MEDIUM |
| IP Address | `\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b` | LOW (GDPR — personal data) |
| DOB | `\b(0[1-9]\|1[0-2])[-/](0[1-9]\|[12]\d\|3[01])[-/]\d{4}\b` | HIGH |

**Violations tab in /dashboard/privacy:**
- List of all open violations (table/column/row/pattern/severity)
- Remediation workflow: Acknowledge → Investigate → Propose fix → Human approves → Execute → Receipt
- Each violation links to the applicable GRC control(s)

---

## 11. Phase 7 — AIOps & DiagnosticsAgent

**Status: Planned — builds on Phase 5 Agent Infrastructure + external observability stack**

**Goal:** The platform monitors itself. When something is wrong — a deployment broke an API, a CVE was published, a service is degraded — the DiagnosticsAgent knows, explains it in plain English, and recommends a specific fix. All findings feed back into the GRC dashboard.

### Observability Stack (self-hosted on Railway or Fly.io)

```
Application (Next.js, Supabase, Groq, etc.)
    │
    ▼ OpenTelemetry SDK (traces + metrics + logs)
    │
    ├──► Prometheus (metrics store + Alertmanager)
    ├──► Grafana Loki (log aggregation)
    └──► Grafana Tempo (distributed traces)
              │
              ▼
         Grafana (unified dashboards)
              │
    Alertmanager fires webhook
              │
              ▼
    DiagnosticsAgent (/api/agents/diagnostics/alert)
              │
    Groq analyzes: logs + traces + recent deployments
              │
              ▼
    agent_decisions record: root cause + recommended fix
    Surfaced in /dashboard/agents decision queue
```

### OpenTelemetry instrumentation scope
- All Next.js API routes: request duration, error rate, status codes
- All Supabase queries: query time, row count, RLS evaluation time
- Auth events: login attempts, failures, MFA challenges
- Groq API calls: latency, token usage, error rate
- Stripe webhook processing: success/failure rate
- Background agent runs: duration, findings count

### DiagnosticsAgent rules
```
WHEN API route error rate > 5% for 5 consecutive minutes
→ pull logs from Loki (30 min window), traces from Tempo
→ pull recent deployments from GitHub API
→ send structured prompt to Groq: "Here are the errors, logs, and recent changes. What broke?"
→ create agent_decision with: root_cause, confidence, recommended_fix, linked_commit
→ human_gate = NOTIFY (display in /dashboard/agents)
→ create GRC finding if linked to security/access control

WHEN Supabase query p99 > 2000ms sustained for 10 minutes
→ identify slow query, suggest index, create GRC finding (availability control)

WHEN new critical CVE published for any package in our SBOM
→ Grype scheduled scan detects new match
→ create grc_vulnerability, create agent_decision, notify super_admin
→ human_gate = NOTIFY, SLA = 24 hours for critical

WHEN a deployment to production fails
→ parse GitHub Actions failure, identify failing step, suggest fix
→ notify immediately
```

### Grafana dashboards (pre-built)
- Platform Overview: request rate, error rate, active users, response times
- Security: failed auth attempts, geographic anomalies, API abuse patterns
- Compliance: control health score over time, evidence gap trend
- Agent Activity: agent runs, decisions per day, approval queue depth
- Infrastructure: Supabase connection pool, query times, storage usage

---

## 12. Integration Sprint

**Status: Parallel work — can happen alongside Phases 5–7**

These are integrations where the scaffolding exists (pages, DB tables) but the actual service is not yet connected. Each is a focused 1–3 day effort.

### 12A — Stripe Full Integration
**Scaffold exists:** billing page, subscriptions table, webhook endpoint stub
**Remaining:**
- Wire Stripe webhooks: `customer.subscription.created/updated/deleted`, `invoice.payment_failed`
- Enforce subscription limits in middleware (Starter: 3 chaplains / 50 users)
- Subscription status displayed on billing page
- Dunning flow: payment failed → grace period → access suspended
- Org offboarding on subscription cancel: trigger RetentionAgent for data deletion proposal

### 12B — LiveKit Live Video
**Scaffold exists:** /dashboard/sessions page, sessions table
**Remaining:**
- LiveKit account setup (Cloud free tier: 5k min/mo) or self-hosted on Railway
- Token generation API (`/api/sessions/token`)
- Session room creation on session start
- Waiting room implementation
- Host controls (mute, remove, end session)
- Session recording → Supabase Storage

### 12C — Mux Video Library
**Scaffold exists:** /dashboard/videos page, videos table
**Remaining:**
- Mux account setup (free: 100k delivery min/mo)
- Upload API (`/api/videos/upload` → Mux direct upload URL)
- Webhook: `video.asset.ready` → update video status, store playback_id
- Mux Player component for HLS streaming
- Thumbnail generation, video duration display

### 12D — Cal.com Scheduling
**Scaffold exists:** /dashboard/schedule page
**Remaining:**
- Cal.com account or self-hosted instance
- OAuth connection: chaplain links their Cal.com calendar
- Embed Cal.com booking widget for clients
- Webhook: `booking.created/cancelled` → sync to sessions table
- Reminder emails via Resend on booking confirmation

### 12E — MFA Enforcement
**Status:** Supabase Auth supports TOTP/MFA, not yet enforced in app
**Remaining:**
- Enforce MFA on first login for all `org_admin` and `super_admin` accounts
- MFA setup page at /dashboard/profile (TOTP QR code, backup codes)
- Middleware guard: if MFA not configured and role is org_admin/super_admin → redirect to MFA setup
- MFA status shown in /dashboard/team (admin sees which team members have MFA enabled)
- ComplianceAgent rule: "any org_admin/super_admin without MFA → critical GRC finding (CC6.1)"

### 12F — GRC Framework Completion
**Status:** SOC 2 + CMMC Level 2 controls seeded. 6 frameworks remain.
**Remaining (005_grc_frameworks.sql migration):**
- ISO 27001:2022 — 93 controls across 4 themes, 11 clauses
- ISO 27017:2015 — 37 cloud-specific controls
- ISO 27018:2019 — 25 PII in public cloud controls
- ISO 27701:2019 — 49 privacy information management controls (PIMS)
- ISO 42001:2023 — 38 AI management system controls (covers Groq usage)
- FedRAMP Moderate — 325 NIST SP 800-53 Rev 5 controls
- Cross-framework control mapping (SOC 2 CC6.1 ↔ ISO 27001 A.9.1.1 ↔ FedRAMP AC-2)

### 12G — GitHub Actions → GRC Evidence Auto-Ingestion
**Status:** CI/CD pipeline runs (Trivy, Gitleaks, Semgrep, CodeQL, SBOM) produce SARIF but don't auto-write to GRC
**Remaining:**
- GitHub Actions job at end of each CI run: POST to `/api/grc/evidence/ingest`
- Endpoint parses: job name, outcome, SARIF finding count, run URL, commit SHA
- Maps job to GRC control (Trivy → CC7.1, Gitleaks → CC6.6, Semgrep → CC7.2, etc.)
- Creates grc_evidence records automatically
- On finding detected: creates grc_vulnerability automatically
- Result: every CI run produces auditable compliance evidence without human action

---

## 13. Compliance Roadmap

### Completed ✅
- [x] Encryption at rest (Supabase AES-256) and in transit (TLS 1.3)
- [x] Append-only tamper-evident audit logs (hash-chained)
- [x] Data isolation via RLS (no cross-org data leakage possible)
- [x] Basic vulnerability scanning in CI/CD (Trivy, Gitleaks, Semgrep, CodeQL, Checkov)
- [x] SBOM generation on every release (Syft + Grype)
- [x] GRC controls library (SOC 2 + CMMC Level 2)
- [x] Data Location Index (19 PII fields mapped)
- [x] GDPR Article 30 ROPA (pre-filled, editable)
- [x] PIA/DPIA/TIA assessment framework

### Integration Sprint (§12)
- [ ] MFA enforced for Org Admin + Super Admin
- [ ] Stripe subscription enforcement + dunning
- [ ] GitHub Actions → GRC evidence auto-ingestion
- [ ] ISO 27001 / 27017 / 27018 / 27701 / 42001 / FedRAMP controls seeded

### Phase 5 — Agent Infrastructure & PrivacyAgent
- [ ] Agent Infrastructure (registry, runs, decisions, rules, approval queue)
- [ ] PrivacyAgent: Regulation Registry (19 regulations seeded)
- [ ] PrivacyAgent: Jurisdiction Mapper
- [ ] PrivacyAgent: Consent Management Platform (cookie consent + purpose consent)
- [ ] PrivacyAgent: Continuous ROPA auto-maintenance
- [ ] PrivacyAgent: PIA/DPIA auto-trigger rules
- [ ] PrivacyAgent: TIA auto-trigger for cross-border transfers
- [ ] PrivacyAgent: Privacy by Design CI/CD hook
- [ ] PrivacyAgent: Perpetual regulatory intelligence (Groq monitors for new laws)
- [ ] PrivacyAgent: Compliance scoring per regulation
- [ ] RetentionAgent: Per-category retention policies
- [ ] RetentionAgent: Nightly expiry job + deletion proposals
- [ ] DSARAgent: Request intake + auto-discovery + 30-day SLA
- [ ] DSARAgent: Erasure workflow + deletion receipt (Ed25519 signed)
- [ ] data_violations table + DataAgent column scanner

### Phase 6 — Security, Compliance & Data Agents
- [ ] SecurityAgent: failed auth monitoring, anomaly detection, secret exposure
- [ ] ComplianceAgent: control staleness, evidence freshness, audit readiness score
- [ ] DataAgent: real column-level PII scanner (CVV, PAN, SSN, email in wrong place)
- [ ] Violations remediation workflow in /dashboard/privacy
- [ ] Privacy by Design PR review bot

### Phase 7 — AIOps & DiagnosticsAgent
- [ ] OpenTelemetry SDK instrumentation across all Next.js API routes
- [ ] Self-hosted observability stack: Prometheus + Loki + Tempo + Grafana
- [ ] DiagnosticsAgent: error rate monitoring + Groq root cause analysis
- [ ] DiagnosticsAgent: CVE detection + SBOM continuous monitoring
- [ ] DiagnosticsAgent: deployment failure analysis
- [ ] Pre-built Grafana dashboards (Platform, Security, Compliance, Agents, Infrastructure)

### Before First Enterprise Contract
- [ ] SOC 2 Type II observation window started (12 months)
- [ ] HIPAA BAA executed: Supabase, Vercel, Cloudflare, Mux, LiveKit, Groq
- [ ] ISO 27001 gap assessment completed
- [ ] Penetration test (annual, third-party)
- [ ] Incident response plan documented + tabletop exercise
- [ ] Privacy policy, terms of service, cookie policy published
- [ ] DPO / responsible privacy person designated

### Before Healthcare Customer Goes Live
- [ ] HIPAA BAA executed with all processors
- [ ] GDPR Article 30 ROPA approved
- [ ] DPIA completed for health data processing
- [ ] Data retention and deletion procedures operational (Phase 5C)
- [ ] PrivacyAgent compliance score for HIPAA > 90%

### Government / DoD Contracts
- [ ] SOC 2 Type II report issued
- [ ] ISO 27001 certification
- [ ] ISO 27701 certification (privacy)
- [ ] ISO 42001 certification (AI — Groq governance)
- [ ] CMMC Level 2 assessment (C3PAO)
- [ ] FedRAMP Moderate ATO (separate GovCloud environment, 12–18 months)

---

## 14. Infrastructure & Deployment

### Vercel (customer-facing)
- Next.js app (frontend + API routes)
- Preview deployments for every PR
- Environments: `development`, `staging`, `production`

### Supabase (managed)
- PostgreSQL database
- Auth, Realtime, Storage
- pg_cron for scheduled agent triggers
- Separate projects for staging and production

### Self-hosted services (Railway or Fly.io)
- LiveKit server (video)
- Cal.com (scheduling)
- Observability stack: Prometheus + Loki + Tempo + Grafana (Phase 7)

### Docker
- All self-hosted services run as Docker containers
- `docker-compose.yml` for local development
- Production images pushed to `ghcr.io/blarghonk-ai/chaplain-connect`

### CI/CD (GitHub Actions — already built)
- On every PR: Gitleaks, dependency-review, CodeQL, Semgrep, Checkov, Trivy, TypeScript, ESLint, build
- On merge to main: deploy to Vercel, SBOM generation
- On tag: release artifacts, Grype scan, GitHub Release
- Coming (§12G): CI run results auto-ingested as GRC evidence

---

## 15. Open Decisions

1. **Agent scheduling backend** — pg_cron (built into Supabase, no infrastructure) vs. an external job queue (Railway-hosted BullMQ). pg_cron is simpler and keeps everything in Supabase. Recommend pg_cron for Phases 5–6, evaluate BullMQ for Phase 7 if throughput demands it.

2. **Deletion receipt signing key** — Ed25519 signature for deletion receipts. Key management options: Supabase Vault (available on Pro), AWS KMS, Cloudflare KMS (FIPS 140-2, needed for FedRAMP). Decision needed before Phase 5C launches.

3. **Cookie consent TCF compliance** — IAB TCF v2.2 requires a registered CMP vendor ID. For early stages, a simple consent string implementation is sufficient. For EU enterprise customers, full TCF registration (~$2,000/year) will be required. Decision needed before first EU enterprise contract.

4. **Groq data processing agreement** — Groq processes user conversation data (AI assistant + agent reasoning). Before healthcare customers go live, confirm Groq's HIPAA BAA availability. If unavailable, evaluate: Azure OpenAI (HIPAA-eligible), AWS Bedrock (HIPAA-eligible), or self-hosted Ollama on GPU instance. This is a blocking dependency for hospital contracts.

5. **PrivacyAgent regulatory intelligence cadence** — How often should the agent scan for new regulations? Weekly is likely sufficient for most jurisdictions. However, some regions (India, China) have rapidly evolving frameworks. Consider: weekly scan for major jurisdictions, monthly for smaller ones.

6. **FedRAMP environment** — FedRAMP Moderate requires a separate environment (AWS GovCloud). The data model is environment-agnostic from day one. Dedicated instance architecture needs to be designed before any DoD contract discussions.

7. **LiveKit: self-hosted vs cloud** — Cloud free tier (5k min/mo) is sufficient for MVP. Self-hosted saves cost at scale but requires TURN server. Decision needed before first paying video customer.

8. **HIPAA BAA vendors — current status:**
   - Supabase: ✅ available on Pro plan
   - Vercel: ✅ available on Enterprise
   - Cloudflare: ✅ available
   - Mux: ✅ available
   - LiveKit: ⚠️ confirm with LiveKit directly
   - Groq: ⚠️ confirm with Groq directly — blocking for healthcare

---

*Last updated: 2026-04-26 — Phases 1–4 complete. Active work: Integration Sprint + Phase 5.*
