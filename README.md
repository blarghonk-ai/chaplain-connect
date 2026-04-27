# Chaplain Connect

SaaS platform providing remote ministry, chaplaincy services, and spiritual care for hospitals, nonprofits, and DoD organizations.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) on Vercel |
| Database & Auth | Supabase (PostgreSQL + RLS) |
| AI / Agents | Groq (`llama-3.3-70b-versatile`) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Package manager | Bun |
| Payments | Stripe |

## Platform Modules

### Customer-facing
- **Ministry Platform** — Chaplain sessions, scheduling, real-time chat, video, Bible library, posts
- **Org & Team management** — Multi-org support, team roles, billing per org
- **Consent management** — Cookie banner, per-purpose consent, withdrawal, DSAR submission

### Internal (super_admin only)
- **GRC Engine** — SOC 2 + CMMC Level 2 controls, evidence management, vulnerability tracking, risk register
- **Privacy Governance** — Data map, ROPA, PIAs/DPIAs, regulation registry (19 global laws), compliance scoring
- **Agent System** — 6 autonomous agents running on a shared rules engine with human approval gates:
  - `ComplianceAgent` — evidence freshness, vulnerability SLAs, audit readiness
  - `PrivacyAgent` — consent gaps, ROPA staleness, DPIA triggers, regulation compliance
  - `SecurityAgent` — new super_admins, MFA enforcement, privilege escalation, dormant accounts
  - `DataAgent` — column-name PCI violations + live content scanning (PAN, SSN, email in logs)
  - `RetentionAgent` — retention policy enforcement, deletion proposals, signed receipts
  - `DSARAgent` — 30-day SLA monitoring, erasure request processing, deletion proposals

## Project structure

```
chaplain-connect/
├── app/                          # Next.js application
│   ├── src/
│   │   ├── app/
│   │   │   ├── (dashboard)/      # All authenticated routes
│   │   │   │   ├── agents/       # Agent dashboard (super_admin)
│   │   │   │   ├── grc/          # GRC engine (super_admin)
│   │   │   │   ├── privacy/      # Privacy governance (super_admin)
│   │   │   │   └── ...           # Customer-facing dashboard pages
│   │   │   └── api/              # API routes
│   │   ├── components/           # Shared UI components
│   │   └── lib/
│   │       ├── agents/           # Agent logic + runner
│   │       └── supabase/         # Supabase client helpers
│   └── supabase/
│       └── migrations/           # Sequential SQL migrations (001–008)
├── docs/
│   └── superpowers/
│       └── specs/                # Master design document
├── CONTRIBUTING.md               # ← Development lifecycle (start here)
└── README.md
```

## Getting started

### Prerequisites

- [Bun](https://bun.sh) v1.3+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional, for local dev)
- A Supabase project with migrations applied
- Groq API key

### Setup

```bash
# Clone
git clone https://github.com/blarghonk-ai/chaplain-connect.git
cd chaplain-connect/app

# Install dependencies
bun install

# Environment
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
# SUPABASE_SECRET_KEY, GROQ_API_KEY

# Run migrations (in order, 001 → 008)
# See CONTRIBUTING.md §5 for migration commands

# Start dev server
bun dev
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full development lifecycle — branching strategy, commit conventions, PR workflow, migration process, agent development standards, and deployment procedures.
