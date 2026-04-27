# Contributing to Chaplain Connect

This document defines the full development lifecycle for Chaplain Connect. All contributors — including AI coding assistants — must follow these standards.

---

## Table of Contents

1. [Branching Strategy](#1-branching-strategy)
2. [Commit Conventions](#2-commit-conventions)
3. [Pull Request Workflow](#3-pull-request-workflow)
4. [Pre-Merge Checklist](#4-pre-merge-checklist)
5. [Database Migration Workflow](#5-database-migration-workflow)
6. [Agent Development Standards](#6-agent-development-standards)
7. [Dependency Management](#7-dependency-management)
8. [Environment Variables](#8-environment-variables)
9. [Architecture Rules](#9-architecture-rules)
10. [Deployment](#10-deployment)

---

## 1. Branching Strategy

`main` is always production-ready. No direct commits to `main` except for emergency hotfixes.

### Branch naming

| Type | Pattern | Example |
|------|---------|---------|
| Phase / feature | `feat/<phase>-<description>` | `feat/phase7-diagnostics-agent` |
| Bug fix | `fix/<description>` | `fix/consent-withdrawal-status` |
| Maintenance | `chore/<description>` | `chore/upgrade-typescript-6` |
| Hotfix | `hotfix/<description>` | `hotfix/dsar-sla-calculation` |
| Documentation | `docs/<description>` | `docs/agent-development-guide` |

### Rules

- Branch from `main` every time — never branch off another feature branch
- Delete branches after they are merged
- One logical change per branch — do not bundle unrelated work

---

## 2. Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/). Every commit message must have a type prefix.

### Format

```
<type>(<optional scope>): <short description>

<optional body>

Co-Authored-By: ...
```

### Types

| Type | When to use |
|------|------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `chore` | Maintenance — deps, config, tooling |
| `docs` | Documentation only |
| `refactor` | Code restructure with no behavior change |
| `perf` | Performance improvement |
| `ci` | CI/CD workflow changes |
| `build` | Build system changes |
| `migration` | Database schema changes |

### Examples

```
feat(agents): add SecurityAgent with MFA and privilege escalation rules

fix(dsar): correct 30-day SLA calculation for CCPA requests

migration: Phase 6 — security_events table and agent rules seed

chore: upgrade TypeScript 6, @types/node 25, ESLint 10
```

### Rules

- Subject line: 72 characters max, lowercase after the colon, no period at end
- Body: explain *why*, not *what* — the diff shows what
- Reference migration numbers in migration commits
- Include `Co-Authored-By` line when pairing with an AI assistant

---

## 3. Pull Request Workflow

Every change to `main` goes through a PR. No exceptions except declared hotfixes.

### Steps

1. **Create branch** from latest `main`
   ```bash
   git checkout main && git pull origin main
   git checkout -b feat/phase7-diagnostics-agent
   ```

2. **Implement** the change following architecture rules below

3. **Verify locally** before pushing (see Pre-Merge Checklist)

4. **Push branch and open PR**
   ```bash
   git push -u origin feat/phase7-diagnostics-agent
   gh pr create --title "feat: Phase 7 — DiagnosticsAgent" --body "..."
   ```

5. **PR description must include:**
   - What changed and why
   - Migration notes (if applicable)
   - New environment variables (if any)
   - Screenshot or route list for UI changes
   - Testing steps

6. **Review and merge** — for solo development, self-review using the checklist, then merge

### PR title format

PR titles follow the same Conventional Commits format as commits:
```
feat(phase7): DiagnosticsAgent, OpenTelemetry instrumentation
fix(security): resolve MFA check when auth.admin unavailable
```

---

## 4. Pre-Merge Checklist

Run through this before marking a PR ready for merge.

```
Build & Types
  [ ] bun run build passes with zero errors
  [ ] No TypeScript errors (type check runs as part of build)
  [ ] No new 'any' types introduced

Security
  [ ] No secrets or credentials committed (.env files, API keys, tokens)
  [ ] All new Supabase tables have RLS enabled
  [ ] All internal API routes have super_admin guard
  [ ] No SQL injection risk in any dynamic queries

Database
  [ ] Migration file created and named correctly (00N_description.sql)
  [ ] Migration tested against Supabase before merge
  [ ] New tables documented in migration header comment
  [ ] RLS policies included in the migration

Agents (if applicable)
  [ ] Agent returns AgentFinding[] — no side effects outside of DB writes
  [ ] All destructive actions have requiresHumanApproval: true
  [ ] Groq is used for reasoning only — no LLM compliance decisions
  [ ] Deduplication logic present (no duplicate open violations/events)
  [ ] New agent type registered in agent_registry via migration seed

Dependencies
  [ ] No unnecessary new dependencies added
  [ ] package.json and bun.lock both committed if deps changed
```

---

## 5. Database Migration Workflow

### Naming

Migrations are numbered sequentially:

```
001_foundation.sql
002_ministry_platform.sql
003_grc_engine.sql
...
009_phase7_diagnostics.sql
```

Do not skip numbers. Do not rename existing migrations.

### Structure

Every migration file must begin with a header:

```sql
-- ============================================================
-- Phase N: Short description of what this migration does
-- ============================================================
```

And follow this order:
1. Enums (if new)
2. Tables (with inline comments)
3. RLS — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + policies
4. Indexes
5. Seed data (wrapped in `DO $$ BEGIN ... END $$` for idempotency)

### Running migrations

```bash
SQL=$(cat app/supabase/migrations/00N_name.sql)
curl -s -X POST "https://api.supabase.com/v1/projects/<project-id>/database/query" \
  -H "Authorization: Bearer <management-api-key>" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}"
```

An empty `[]` response means success. Any error object means failure — fix before merging.

### Rules

- Migrations are **append-only** — never edit a migration that has been run
- All new tables must have `ENABLE ROW LEVEL SECURITY`
- Use `IF NOT EXISTS` and `ON CONFLICT DO NOTHING` for idempotent seeds
- Never drop columns or tables without an explicit deprecation plan

---

## 6. Agent Development Standards

All agents run on the shared Agent Infrastructure from Phase 5A.

### Pattern

Every agent is a single exported async function:

```typescript
export async function myAgentLogic(
  runId: string,
  admin: SupabaseClient
): Promise<AgentFinding[]>
```

It is invoked via `runAgent()` in `lib/agents/runner.ts` which handles:
- Creating the `agent_runs` record
- Calling Groq for reasoning on medium+ severity findings
- Writing `agent_decisions`
- Queuing `agent_approval_queue` entries for human-gated findings
- Emitting GRC evidence automatically
- Completing the run record

### AgentFinding fields

```typescript
interface AgentFinding {
  title: string                    // Short, actionable — shown in dashboard
  description: string              // Full explanation with regulation citations
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  decisionType: 'finding' | 'action' | 'escalation' | 'evidence'
  ruleTriggered: string            // snake_case rule key — matches agent_rules.rule_key
  requiresHumanApproval: boolean   // true = queued for approval; false = auto-resolved
  proposedAction?: string          // Specific next steps for the reviewer
  slaHours?: number                // Escalate if not addressed within N hours
  grcControlKeywords?: string[]    // Used to auto-link finding to GRC evidence
  metadata?: Record<string, unknown>
}
```

### Non-negotiable rules

| Rule | Why |
|------|-----|
| **Rules are deterministic. Groq is explanatory.** | The rules engine decides what to do. Groq explains why. LLMs never make autonomous compliance decisions. |
| **All destructive actions require human approval.** | `requiresHumanApproval: true` for anything that modifies, deletes, or restricts data. No exceptions. |
| **Deduplicate open findings.** | Always check for existing open violations/events before inserting new ones. |
| **Graceful degradation.** | Wrap per-table/per-service calls in try/catch. One failing target must not abort the entire run. |
| **Never store raw PII in findings.** | Use masked samples (e.g. `XXXX-XXXX-XXXX-1234`). Never log card numbers, SSNs, or passwords in `metadata`. |

### Adding a new agent

1. Create `app/src/lib/agents/<type>-agent.ts`
2. Create `app/src/app/api/agents/<type>/run/route.ts` (copy pattern from `compliance/run/route.ts`)
3. Add the agent type and run endpoint to `RUN_ENDPOINTS` in `agent-registry-tab.tsx`
4. Seed the agent in `agent_registry` via a migration
5. Seed its rules in `agent_rules` via the same migration
6. Add `POST /api/agents/<type>/run` to this doc's route list

---

## 7. Dependency Management

### Dependabot PRs

Dependabot opens PRs automatically for all dependency updates.

| Update type | Action |
|-------------|--------|
| **Patch** (e.g. `1.2.3 → 1.2.4`) | Merge immediately — no testing needed |
| **Minor** (e.g. `1.2.x → 1.3.0`) | Merge after confirming build passes |
| **Major** (e.g. `1.x → 2.0`) | Test locally first: update `package.json`, run `bun install && bun run build`, fix any errors, then merge |
| **GitHub Actions** (non-major) | Merge immediately |
| **GitHub Actions** (major) | Review changelog, then merge |

### Process for major version bumps

```bash
# 1. Apply the version change locally first
# Edit package.json manually

# 2. Install and test
cd app && bun install && bun run build

# 3. Fix any errors, commit the fix to main
# 4. Close the Dependabot PR (superseded by your commit)
gh pr close <PR number> --comment "Superseded by direct upgrade in <commit sha>"
```

### Adding new dependencies

- Prefer packages already in the ecosystem (shadcn/ui, Supabase, Next.js ecosystem)
- Check bundle impact for client-side dependencies
- No analytics, tracking, or telemetry packages without a corresponding `data_locations` entry and DPIA

---

## 8. Environment Variables

### Required

| Variable | Where used | Notes |
|----------|-----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Public — safe to expose |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client + Server | Public anon key |
| `SUPABASE_SECRET_KEY` | Server only | Service role key — never expose to client |
| `GROQ_API_KEY` | Server only | Agent reasoning — never expose to client |
| `GROQ_MODEL` | Server only | Defaults to `llama-3.3-70b-versatile` |

### Rules

- Variables prefixed `NEXT_PUBLIC_` are **bundled into client JavaScript** — never put secrets there
- Never commit `.env.local` — it is gitignored
- When adding a new environment variable, document it here and in the PR description
- For Vercel: add new variables in the Vercel dashboard before merging the PR that requires them

---

## 9. Architecture Rules

### Access control

- All pages under `/(dashboard)` are protected by middleware — authenticated users only
- All internal tool pages (GRC, Privacy, Agents) perform a `super_admin` role check server-side and redirect to `/dashboard` if not authorized
- All internal API routes perform a `super_admin` guard — return 403 if not authorized
- Customer-facing routes never receive `super_admin`-only data

### Supabase

- `createClient()` — uses anon/publishable key, respects RLS, for user-scoped operations
- `createAdminClient()` — uses service role key, bypasses RLS, for agent operations and admin APIs only
- Never use `createAdminClient()` in a route that can be called by non-super_admin users

### React / Next.js

- Server components for all data fetching — no `useEffect` for initial data in pages
- Client components (`'use client'`) only where state or event handlers are needed
- Never fetch from API routes in server components — query Supabase directly

### TypeScript

- No `any` types — use `unknown` and narrow, or define interfaces
- When casting through Supabase's typed client with dynamic column names, use `(row as unknown) as Record<string, unknown>`

---

## 10. Deployment

### Flow

```
feature branch → PR → review → merge to main → Vercel auto-deploys
```

Vercel watches `main`. Every merge triggers a production deployment automatically.

### Migration deployment

Migrations are **not** run automatically by Vercel. Run them manually before or immediately after merging the PR that requires them:

```bash
# Run migration against production Supabase
SQL=$(cat app/supabase/migrations/00N_name.sql)
curl -s -X POST "https://api.supabase.com/v1/projects/<project-id>/database/query" \
  -H "Authorization: Bearer <management-api-key>" \
  ...
```

**Order matters:** If your PR's code depends on a new table/column, run the migration before the Vercel deployment completes.

### Rollback

- **Code:** Revert the merge commit on `main` — Vercel will redeploy the previous build
- **Migration:** Migrations are append-only; write a corrective migration, do not reverse
- **Data:** Restore from Supabase point-in-time recovery (PITR) for data loss — this requires human action

---

## Quick reference

```bash
# Start a new feature
git checkout main && git pull origin main
git checkout -b feat/my-feature

# Verify before pushing
cd app && bun run build

# Push and open PR
git push -u origin feat/my-feature
gh pr create

# Run a migration
SQL=$(cat app/supabase/migrations/00N_name.sql)
curl -s -X POST "https://api.supabase.com/v1/projects/bfulkstmdtdwyyhzdhwt/database/query" \
  -H "Authorization: Bearer $SUPABASE_MANAGEMENT_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}"
```
