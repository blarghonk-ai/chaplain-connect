# Chaplain Connect — Master Design Spec

> **Status:** Pre-implementation. All phases require individual implementation plans before coding begins.

**Goal:** A multi-tenant B2B SaaS platform that delivers remote chaplaincy and ministry services to enterprise customers (hospitals, nonprofits, DoD, government agencies), backed by a full internal compliance, data governance, and AIOps stack that enables SOC 2 Type II, ISO 27001/17/18/701/42001, CMMC Level 2, and FedRAMP Moderate certification.

---

## Table of Contents

1. [Business Model](#1-business-model)
2. [User Types & Roles](#2-user-types--roles)
3. [Architecture Overview](#3-architecture-overview)
4. [Full Tech Stack](#4-full-tech-stack)
5. [Phase 1 — Foundation](#5-phase-1--foundation)
6. [Phase 2 — Ministry Platform](#6-phase-2--ministry-platform)
7. [Phase 3 — GRC Engine](#7-phase-3--grc-engine)
8. [Phase 4 — Data Lineage & Privacy Governance](#8-phase-4--data-lineage--privacy-governance)
9. [Phase 5 — Data Lifecycle Management](#9-phase-5--data-lifecycle-management)
10. [Phase 6 — AIOps & Self-Diagnostics](#10-phase-6--aiops--self-diagnostics)
11. [Compliance Roadmap](#11-compliance-roadmap)
12. [Infrastructure & Deployment](#12-infrastructure--deployment)
13. [Open Decisions](#13-open-decisions)

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
- **Super Admin** — Chaplain Connect team. Full access to all orgs, internal GRC/DevOps tools.

### Organization-level (per customer org)
- **Org Admin** — Manages their org's chaplains, users, settings, billing.
- **Chaplain** — Service provider. Conducts sessions, posts content, manages calendar.
- **End User / Client** — Person receiving ministry services. Books sessions, joins video calls, uses chat.

### Data scope rule
Every piece of data in the system is scoped to an org via Row Level Security (RLS) in Supabase. A chaplain from Org A cannot see anything from Org B. Super Admins can see cross-org data only through audited internal tools.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    chaplain-connect.com                          │
│                                                                  │
│  CUSTOMER-FACING                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │               Ministry Platform  (Phase 2)                 │ │
│  │  Live Video │ Chat │ Video Library │ Scheduling │ Bible    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  INTERNAL (Chaplain Connect team only)                           │
│  ┌──────────────────────┐  ┌─────────────────────────────────┐ │
│  │   GRC Engine         │  │  Data Lineage & Privacy         │ │
│  │   (Phase 3)          │  │  Governance  (Phase 4)          │ │
│  │  Controls │ Evidence │  │  Lineage │ PIAs │ DPIAs │ ROPAs │ │
│  └──────────────────────┘  └─────────────────────────────────┘ │
│  ┌──────────────────────┐  ┌─────────────────────────────────┐ │
│  │  Data Lifecycle Mgmt │  │  AIOps & Self-Diagnostics       │ │
│  │  (Phase 5)           │  │  (Phase 6)                      │ │
│  │  Deletion │ SBOM     │  │  OTel │ Prometheus │ Ollama     │ │
│  └──────────────────────┘  └─────────────────────────────────┘ │
│                                                                  │
│  FOUNDATION  (Phase 1)                                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Next.js (App Router) │ Supabase │ Stripe │ Payload CMS   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Key architectural principles:**
- Multi-tenancy enforced at the database layer via Supabase RLS — not application logic
- Every service emits OpenTelemetry traces, metrics, and logs from day one
- Ollama runs locally/self-hosted — no sensitive data sent to external AI APIs
- All PII encrypted at rest (AES-256) and in transit (TLS 1.3)
- Audit logs are append-only and tamper-evident (hash-chained)

---

## 4. Full Tech Stack

### Core Application
| Layer | Technology | Reason |
|---|---|---|
| Frontend framework | Next.js 15 (App Router) | Vercel-native, React Server Components |
| Hosting | Vercel | Serverless, global CDN, preview deployments |
| Database | Supabase (PostgreSQL) | Auth + DB + Realtime + Storage in one, RLS for multi-tenancy |
| Auth | Supabase Auth | Built-in, integrates with RLS, supports OAuth + MFA |
| CMS / Admin panel | Payload CMS | Next.js-native, runs in same app, Postgres-backed |
| UI components | shadcn/ui + Radix UI | Accessible, Tailwind-based, code-owned |
| Styling | Tailwind CSS | Utility-first, consistent design system |
| Rich text editor | Tiptap | Extensible, React-first, ProseMirror-based |
| Payments | Stripe | Subscriptions, invoicing, HIPAA-eligible |
| Email | Resend + React Email | React component templates, 3k/mo free |
| File storage | Supabase Storage | Integrated auth/RLS, S3-compatible |
| Large media storage | Cloudflare R2 | Zero egress fees for large video files |
| Push notifications | Novu (self-hosted) | Multi-channel, open source, MIT |
| Scheduling | Cal.com (self-hosted) | Open source, white-label, API-driven |
| Language | TypeScript | Type safety across full stack |
| Package manager | Bun | Fast installs and runtime |

### Ministry Services
| Feature | Technology |
|---|---|
| Live video/audio | LiveKit (self-hosted or cloud free tier) |
| Video upload + streaming | Mux (free tier: 100k delivery min/mo) |
| Real-time chat | Supabase Realtime (Postgres + WebSockets) |
| Bible content | bible.helloao.org API (free, no key, 1000+ translations) |
| AI chat assistant | Ollama (local/self-hosted, llama3.2 or mistral) |

### GRC & Compliance
| Feature | Technology |
|---|---|
| GRC controls framework | OpenRMF (DoD-focused, MIT) |
| Risk management | SimpleRisk (MPL 2.0, self-hosted) |
| Vulnerability scanning | Trivy (containers + code) + Nuclei (web) |
| IaC scanning | Checkov |
| Secret scanning | Gitleaks |
| SBOM generation | Syft + Grype |
| Web app scanning | OWASP ZAP |

### Data Governance
| Feature | Technology |
|---|---|
| Data catalog + lineage | OpenMetadata (Apache 2.0, self-hosted) |
| Metadata collection | OpenMetadata connectors (Postgres, S3, etc.) |
| PIA/DPIA/ROPA builder | Custom (Next.js + Supabase) |
| Data anomaly detection | Custom rules engine + Ollama analysis |

### AIOps & Observability
| Feature | Technology |
|---|---|
| Instrumentation standard | OpenTelemetry SDK |
| Metrics | Prometheus |
| Logs | Grafana Loki |
| Traces | Grafana Tempo |
| Dashboards | Grafana |
| Infrastructure monitoring | Netdata |
| Dependency updates | Renovate |
| AI diagnostic engine | Ollama (llama3.2) |

### Infrastructure
| Layer | Technology |
|---|---|
| Containerization | Docker + Docker Compose |
| Container registry | GitHub Container Registry (ghcr.io) |
| CI/CD | GitHub Actions |
| Self-hosted services | Railway or Fly.io (LiveKit, Cal.com, Novu, OpenMetadata, observability stack) |
| Secrets management | Doppler or GitHub Secrets |
| DNS / CDN | Cloudflare |

---

## 5. Phase 1 — Foundation

**Goal:** Multi-tenant organization infrastructure, authentication, billing, and admin panel. Every subsequent phase builds on this.

### What gets built
- Organization (tenant) creation and management
- Auth: email/password, magic link, OAuth (Google), MFA
- Role-based access control: Super Admin, Org Admin, Chaplain, End User
- Supabase RLS policies enforcing org-level data isolation
- Stripe subscription billing (Starter / Professional / Enterprise tiers)
- Payload CMS admin panel (org management, user management, content)
- Org onboarding flow (sign up → create org → invite chaplains)
- Basic org settings (name, logo, timezone, billing)
- Audit log foundation (append-only, every action recorded with user + timestamp)

### Database schema (core tables)
```sql
organizations        -- tenant root
  id, name, slug, logo_url, tier, stripe_customer_id, created_at

users                -- platform users (linked to Supabase Auth)
  id, org_id, email, role, full_name, avatar_url, created_at

invitations          -- pending org invites
  id, org_id, email, role, token, expires_at

subscriptions        -- Stripe subscription state
  id, org_id, stripe_subscription_id, tier, status, period_end

audit_logs           -- append-only, hash-chained
  id, org_id, user_id, action, resource_type, resource_id,
  metadata (jsonb), prev_hash, hash, created_at
```

### Key files to create
```
app/
  (auth)/
    login/page.tsx
    signup/page.tsx
    onboarding/page.tsx
  (dashboard)/
    layout.tsx
    page.tsx
  (admin)/           ← Payload CMS admin
    [[...segments]]/page.tsx

lib/
  supabase/
    client.ts        ← browser client
    server.ts        ← server client
    middleware.ts    ← session refresh
  stripe/
    client.ts
    webhooks.ts
  audit/
    logger.ts        ← hash-chained audit log writer

middleware.ts        ← org resolution, auth guard, RLS context

payload.config.ts    ← Payload CMS config
```

---

## 6. Phase 2 — Ministry Platform

**Goal:** The customer-facing product. Everything a chaplain organization needs to deliver remote ministry services.

### Features

#### Live Video Sessions (LiveKit)
- Chaplain creates a session (scheduled or instant)
- Unique room per session, scoped to org
- Waiting room, host controls (mute, remove, end)
- Session recording (stored to Supabase Storage → Mux for playback)
- Breakout rooms for group sessions
- Closed captioning (Whisper via Ollama or LiveKit's built-in)

#### Video Library (Mux)
- Chaplains upload sermon videos, devotionals, teaching content
- Mux handles transcoding + adaptive HLS streaming
- Taggable, searchable, org-scoped
- Thumbnail generation, video chapters
- Tiptap-based description editor

#### Real-Time Chat (Supabase Realtime)
- 1:1 chat between chaplain and client
- Group chat per session or org
- Message history (stored in Postgres)
- Typing indicators, read receipts, presence
- File attachments (Supabase Storage)

#### Scheduling / Booking (Cal.com)
- Chaplain connects their availability calendar
- Clients book sessions directly
- Zoom OR LiveKit as the meeting link (org configurable)
- Reminders via Resend (email) + Novu (push)
- Org admin sees all chaplain calendars

#### Bible Content (bible.helloao.org)
- Scripture search and insertion into chat/content
- Daily verse widget on dashboard
- Multi-language scripture (1000+ translations)
- Chaplain can attach scripture references to sessions/posts
- Ollama-powered RAG: query sermon archives against Bible passages

#### Content / Posts
- Chaplains publish written devotionals, prayer guides, announcements
- Tiptap rich text editor (images, embeds, scripture references)
- Draft / scheduled / published states
- Org-scoped content feed for clients

#### AI Chaplain Assistant (Ollama)
- Chat assistant available to clients
- Powered by llama3.2 or mistral running locally/self-hosted
- Grounded in Bible content via RAG (nomic-embed-text embeddings)
- Escalates to human chaplain when needed
- No conversation data sent to external AI APIs

---

## 7. Phase 3 — GRC Engine

**Goal:** Internal tool for the Chaplain Connect team to manage compliance certifications, track controls, collect evidence automatically, and generate audit artifacts for SOC 2, ISO, CMMC, and FedRAMP.

### Compliance Frameworks Supported
- SOC 2 Type II (Security, Availability, Confidentiality)
- ISO 27001:2022 (ISMS)
- ISO 27017 (Cloud security controls)
- ISO 27018 (PII in public cloud)
- ISO 27701 (Privacy information management — PIMS)
- ISO 42001 (AI management system — covers Ollama usage)
- CMMC Level 2 (110 NIST SP 800-171 controls)
- FedRAMP Moderate (800+ controls, NIST SP 800-53 Rev 5)

### Features

#### Controls Library
- All controls from all frameworks imported and mapped
- Cross-framework control mapping (e.g., SOC 2 CC6.1 maps to ISO 27001 A.9.1)
- Control status: Not Started / In Progress / Implemented / Evidence Collected / Audited
- Control owner assignment, due dates, notes

#### Automated Evidence Collection
- Connects to GitHub (commit history, branch protection, PR reviews)
- Connects to Supabase (user access logs, RLS policies, backup status)
- Connects to Vercel (deployment logs, environment variable audit)
- Connects to Stripe (billing records)
- Connects to Phase 6 observability stack (uptime, incident history)
- Evidence tagged to specific controls automatically
- Evidence stored with timestamp, source, hash (tamper-evident)

#### Vulnerability Management
- Trivy scans run on every Docker build (CI/CD integration)
- Nuclei web scans run on schedule
- OWASP ZAP scans on staging deployments
- Findings automatically create GRC control findings
- CVE tracking with CVSS scoring, remediation status
- Gitleaks scans every commit

#### Risk Register
- Risks identified, scored (likelihood × impact), tracked
- Risk treatment plans (accept / mitigate / transfer / avoid)
- Linked to controls and findings
- Risk review schedule and history

#### Audit Dashboard
- Readiness score per framework (% controls implemented)
- Evidence collection status
- Outstanding findings and their age
- Auditor-exportable report packages (PDF + JSON)
- SOC 2 bridge letters, ISO statement of applicability

---

## 8. Phase 4 — Data Lineage & Privacy Governance

**Goal:** Know exactly where every piece of data is, at all times, down to the database/table/row/column level. Feed PIAs, DPIAs, TIAs, and ROPAs automatically from real lineage data.

### Data Lineage Engine (OpenMetadata)

OpenMetadata connects to every data source and builds an automatic graph of:
- What data exists (tables, columns, data types, sample values)
- Where data comes from (ingestion sources, API integrations)
- Where data flows (services that read/write it, pipelines)
- Who has accessed it (query history, API call logs)
- What it's classified as (PII, sensitive, regulated)

**Connectors configured for our stack:**
- Supabase PostgreSQL (primary database)
- Supabase Storage (file metadata)
- Cloudflare R2 (media file metadata)
- Mux (video asset metadata)
- LiveKit (session participant metadata)

**PII auto-classification:**
- Column-level tagging: `email`, `full_name`, `phone`, `ip_address`, `location`, etc.
- Confidence scoring on classification
- Human review queue for uncertain classifications

### Cell/Row/Column Level Data Tracking

Beyond OpenMetadata's schema-level lineage, we build a **Data Location Index** in Postgres:

```sql
data_locations
  id
  org_id                -- which customer org
  subject_id            -- the person this data is about (user_id or external ref)
  data_category         -- e.g. 'contact_info', 'health_data', 'session_recording'
  database_name         -- e.g. 'supabase_prod'
  schema_name           -- e.g. 'public'
  table_name            -- e.g. 'users'
  column_name           -- e.g. 'email'
  row_identifier        -- e.g. the UUID of the row
  storage_system        -- 'postgres' | 'supabase_storage' | 'r2' | 'mux'
  storage_path          -- full path for file-based storage
  legal_basis           -- GDPR lawful basis for this processing
  retention_days        -- how long this data should be kept
  created_at
  last_verified_at
```

This index is populated automatically by:
1. Application-level hooks (every write to a PII column triggers an index update)
2. OpenMetadata scheduled scans
3. Reconciliation job that detects drift

**"Data where it shouldn't be" detection:**
- Rules engine: e.g., "email addresses should never appear in `logs` table"
- Regex scans across text/jsonb columns for PII patterns
- Anomaly alerts when data is found outside expected locations
- Findings surfaced in GRC control dashboard

### Privacy Assessment Tools

All assessments are structured forms that auto-populate from the Data Location Index and lineage graph. They require human review and sign-off but never start blank.

#### ROPA (Records of Processing Activities)
- Auto-generated from data_locations + processing history
- Per org, exportable as GDPR Article 30 compliant document
- Covers: purpose, legal basis, data categories, recipients, retention, transfers, security measures

#### PIA (Privacy Impact Assessment)
- Triggered when a new feature or data flow is introduced
- Pre-filled with data categories, flows, and volumes from lineage
- Risk scoring matrix
- Mitigation recommendations
- Sign-off workflow (DPO approval gate)

#### DPIA (Data Protection Impact Assessment)
- Required for high-risk processing (health data, large-scale profiling)
- Auto-triggered when new PII columns are added to schema
- Structured around GDPR Article 35 requirements
- Linked to GRC controls for ISO 27701

#### TIA (Transfer Impact Assessment)
- Triggered when data flows cross jurisdictions (detected via IP geolocation of services)
- Assesses adequacy decisions, SCCs, BCRs for each transfer
- Required for data leaving EU/UK to non-adequate countries

---

## 9. Phase 5 — Data Lifecycle Management

**Goal:** Secure, auditable deletion of customer data with cryptographic receipts. Full DSAR handling. Retention policy enforcement.

### Features

#### Retention Policy Engine
- Per data category retention rules (e.g., "session recordings: 90 days", "chat messages: 1 year")
- Configurable per org (within platform minimums)
- Automated expiry jobs run nightly
- Deletion of expired data triggers deletion receipt generation
- Retention schedule documented and linked to ROPA

#### DSAR (Data Subject Access Requests)
- End users can submit "show me my data" requests
- System queries data_locations index for all records matching subject_id
- Generates a structured export (JSON + human-readable PDF)
- 30-day SLA tracking, escalation alerts

#### Secure Deletion Workflow
When data is deleted (by retention policy, DSAR erasure request, or org offboarding):

1. **Discovery** — query data_locations index to find all locations for this subject/org
2. **Deletion** — cascade delete from Postgres, purge from Supabase Storage, Cloudflare R2, Mux, LiveKit recordings
3. **Verification** — re-scan all locations to confirm absence
4. **Receipt generation** — create cryptographically signed deletion receipt

#### Data Deletion Receipt (Data SBOM)

```json
{
  "receipt_id": "del_01HXYZ...",
  "org_id": "org_abc123",
  "subject_id": "user_xyz789",
  "requested_by": "admin@hospital.org",
  "request_type": "erasure_request",
  "initiated_at": "2026-04-26T14:00:00Z",
  "completed_at": "2026-04-26T14:00:47Z",
  "deleted_records": [
    {
      "system": "postgres",
      "table": "users",
      "row_id": "user_xyz789",
      "columns_deleted": ["email", "full_name", "phone"],
      "deleted_at": "2026-04-26T14:00:12Z",
      "confirmation_hash": "sha256:abc123..."
    },
    {
      "system": "supabase_storage",
      "bucket": "avatars",
      "path": "org_abc123/user_xyz789/avatar.jpg",
      "deleted_at": "2026-04-26T14:00:18Z",
      "confirmation_hash": "sha256:def456..."
    },
    {
      "system": "mux",
      "asset_id": "mux_asset_789",
      "deleted_at": "2026-04-26T14:00:31Z",
      "confirmation_hash": "sha256:ghi789..."
    }
  ],
  "verification_scan_completed_at": "2026-04-26T14:00:47Z",
  "verification_result": "all_locations_clear",
  "receipt_hash": "sha256:jkl012...",
  "signed_by": "chaplain-connect-deletion-service",
  "signature": "ed25519:..."
}
```

Receipt is stored in append-only audit log and available as a signed PDF download.

---

## 10. Phase 6 — AIOps & Self-Diagnostics

**Goal:** The platform monitors itself. When something is wrong — code, infrastructure, a plugin, a build — the system knows, explains it in plain English, and recommends a fix. Findings feed back into the GRC dashboard.

### Observability Stack (self-hosted on Railway/Fly.io)

```
Application (Next.js, Supabase, LiveKit, etc.)
    │
    ▼ OpenTelemetry SDK (traces + metrics + logs)
    │
    ├──► Prometheus (metrics store)
    ├──► Grafana Loki (log aggregation)
    └──► Grafana Tempo (distributed traces)
              │
              ▼
         Grafana (unified dashboards)
              │
              ▼
    AI Diagnostic Engine (Ollama)
              │
              ▼
    Diagnosis + Fix Recommendation
    (surfaced in internal admin panel)
```

### What Gets Monitored
- **Application:** Response times, error rates, slow queries, API failures
- **Infrastructure:** Container health, memory/CPU, disk, network
- **Database:** Supabase query performance, connection pool, replication lag
- **Builds:** CI/CD pipeline health, failed deployments, test failures
- **Dependencies:** New CVEs in npm packages (Renovate + Trivy)
- **Security:** Failed auth attempts, unusual API patterns, secret exposure (Gitleaks)
- **Plugins/integrations:** LiveKit, Mux, Stripe, Resend health checks

### AI Diagnostic Engine

A background service that:
1. Subscribes to alert events from Prometheus Alertmanager
2. Pulls relevant logs from Loki and traces from Tempo (30-minute window around the alert)
3. Pulls recent deployment/commit history from GitHub API
4. Constructs a structured prompt and sends to local Ollama instance
5. Stores the diagnosis + recommendation in Postgres
6. Surfaces it in the internal admin dashboard

**Example diagnosis output:**
```
INCIDENT: High error rate on /api/sessions/join (23% errors, last 15 min)

ROOT CAUSE (confidence: high):
The LiveKit token generation is failing because the LIVEKIT_API_SECRET
environment variable is not set in the Vercel production environment.
It is present in staging but was not added to production during the
deployment on 2026-04-26 at 13:45 UTC.

EVIDENCE:
- 847 errors all share: "LiveKit API secret is undefined"
- Errors began at 13:46 UTC, 1 minute after deployment babe880
- Staging environment has no errors (secret is configured there)

RECOMMENDED FIX:
1. Go to Vercel Dashboard → chaplain-connect → Settings → Environment Variables
2. Add LIVEKIT_API_SECRET with the value from your secrets manager
3. Trigger a redeployment
4. Monitor /api/sessions/join error rate — should return to <0.1% within 2 minutes

LINKED GRC CONTROL: CC6.3 (Logical Access Controls) — secret misconfiguration
finding created in GRC dashboard.
```

### GRC Feedback Loop
Every finding from Phase 6 (vulnerability, misconfiguration, incident) automatically:
- Creates a finding in the GRC controls dashboard (Phase 3)
- Maps to the relevant compliance control(s)
- Sets severity and remediation deadline
- Closes automatically when the fix is verified

---

## 11. Compliance Roadmap

### Now (MVP / Phase 1–2)
- [ ] Encryption at rest (Supabase default AES-256) and in transit (TLS 1.3)
- [ ] MFA enforced for Org Admin and Super Admin
- [ ] Append-only audit logs from day one
- [ ] Data isolation via RLS (no cross-org data leakage)
- [ ] Privacy policy, terms of service, cookie policy
- [ ] Basic vulnerability scanning in CI/CD (Trivy)
- [ ] Secret scanning on every commit (Gitleaks)

### Phase 3 (before first enterprise contract)
- [ ] SOC 2 Type II readiness (12-month observation window starts)
- [ ] HIPAA BAA template drafted and reviewed by counsel
- [ ] ISO 27001 gap assessment
- [ ] Penetration test (annual)
- [ ] Incident response plan documented

### Phase 4–5 (before healthcare customer goes live)
- [ ] HIPAA BAA executed with Supabase, Vercel, Cloudflare, Mux, LiveKit
- [ ] GDPR Article 30 ROPA completed
- [ ] DPIA completed for health data processing
- [ ] Data retention and deletion procedures operational

### Phase 6+ (government/DoD contracts)
- [ ] SOC 2 Type II report issued
- [ ] ISO 27001 certification
- [ ] ISO 27701 certification (privacy)
- [ ] ISO 42001 certification (AI — Ollama governance)
- [ ] CMMC Level 2 assessment (C3PAO)
- [ ] FedRAMP Moderate ATO (12–18 month process, separate GovCloud environment)

---

## 12. Infrastructure & Deployment

### Vercel (customer-facing)
- Next.js app (frontend + API routes + Payload CMS admin)
- Preview deployments for every PR
- Environment: `development`, `staging`, `production`

### Supabase (managed)
- PostgreSQL database
- Auth, Realtime, Storage
- Separate projects for staging and production

### Self-hosted services (Railway or Fly.io)
- LiveKit server (video)
- Cal.com (scheduling)
- Novu (notifications)
- OpenMetadata (data catalog + lineage)
- Observability stack: Prometheus + Loki + Tempo + Grafana
- Ollama (AI engine — requires GPU instance or CPU-only for smaller models)

### Docker
- All self-hosted services run as Docker containers
- `docker-compose.yml` for local development (all services)
- Production uses Docker images pushed to `ghcr.io/blarghonk-ai/chaplain-connect`

### CI/CD (GitHub Actions)
- On every PR: lint, type-check, unit tests, Trivy scan, Gitleaks scan
- On merge to main: deploy to staging, run integration tests, Nuclei scan
- On tag: deploy to production, generate SBOM (Syft + Grype)

---

## 13. Open Decisions

The following decisions need to be made before or during Phase 1:

1. **Ollama GPU instance** — CPU-only models (phi4, llama3.2:1b) work for summaries and simple diagnostics. A GPU instance (~$50–100/mo on RunPod or Fly.io) is needed for faster/larger models. Decision needed before Phase 6.

2. **LiveKit: self-hosted vs cloud** — Self-hosted saves cost at scale but requires TURN server setup. Cloud free tier (5k min/mo) is fine for MVP. Decide before Phase 2 launch.

3. **Cal.com: self-hosted vs cloud** — Self-hosted gives full white-label. Cloud free tier has Cal.com branding. Decide before Phase 2 launch.

4. **FedRAMP environment** — FedRAMP Moderate requires a separate environment (likely AWS GovCloud). This is a future decision but the data model must support a separate deployment from day one (no hardcoded environment assumptions).

5. **HIPAA BAA vendors** — Confirm HIPAA BAA availability with: Supabase (available on Pro+), Vercel (available on Enterprise), Cloudflare (available), Mux (available), LiveKit (confirm). Must be executed before any healthcare customer data is processed.

6. **Deletion receipt signature scheme** — Ed25519 signing key management. Decide between: HSM (most secure, expensive), AWS KMS / Cloudflare KMS (managed, FIPS 140-2), or self-managed key rotation. Relevant for FedRAMP.

---

*Last updated: 2026-04-26 — Pre-implementation, all phases pending individual implementation plans.*
