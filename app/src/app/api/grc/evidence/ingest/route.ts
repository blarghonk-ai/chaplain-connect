/**
 * POST /api/grc/evidence/ingest
 *
 * Service-to-service endpoint called by GitHub Actions at the end of every
 * CI run. Creates grc_evidence records for each security scan tool and
 * upserts grc_vulnerability records for any CVE/SAST findings.
 *
 * Auth: Bearer token via GRC_INGEST_TOKEN env var (GitHub Secret).
 * Not user-authenticated — this is CI → GRC automation.
 */
import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

// ── Tool → GRC control keyword mapping ───────────────────────
// Maps each CI tool to the SOC 2 / ISO control it satisfies evidence for.
const TOOL_CONTROL_MAP: Record<string, { keywords: string[]; label: string; source: string }> = {
  gitleaks: {
    keywords: ['CC6.6', 'secret', 'logical access'],
    label: 'Secret Scanning (Gitleaks)',
    source: 'gitleaks',
  },
  codeql: {
    keywords: ['CC7.2', 'SAST', 'code', 'vulnerability'],
    label: 'Static Application Security Testing (CodeQL)',
    source: 'codeql',
  },
  semgrep: {
    keywords: ['CC7.2', 'SAST', 'code', 'vulnerability'],
    label: 'Static Application Security Testing (Semgrep)',
    source: 'semgrep',
  },
  checkov: {
    keywords: ['CC6.1', 'CC6.6', 'IaC', 'configuration', 'access'],
    label: 'Infrastructure-as-Code Security (Checkov)',
    source: 'checkov',
  },
  trivy: {
    keywords: ['CC7.1', 'vulnerability', 'patch', 'dependency'],
    label: 'Vulnerability Scan (Trivy)',
    source: 'trivy',
  },
  grype: {
    keywords: ['CC7.1', 'SBOM', 'vulnerability', 'dependency'],
    label: 'SBOM Vulnerability Scan (Grype)',
    source: 'grype',
  },
  build: {
    keywords: ['CC8.1', 'change', 'deployment', 'build'],
    label: 'Production Build',
    source: 'github',
  },
  lint: {
    keywords: ['CC8.1', 'CC7.2', 'code', 'quality', 'change'],
    label: 'Type Check & Lint',
    source: 'github',
  },
}

// ── Types ─────────────────────────────────────────────────────

interface IngestAlert {
  id?: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  cve_id?: string | null
  cvss_score?: number | null
  affected_package?: string | null
  affected_version?: string | null
  fixed_version?: string | null
  file_path?: string | null
  line_number?: number | null
}

interface IngestJob {
  tool: keyof typeof TOOL_CONTROL_MAP
  outcome: 'success' | 'failure' | 'cancelled' | 'skipped'
  open_alerts: number
  alerts?: IngestAlert[]
}

interface IngestPayload {
  run_id: string
  run_url: string
  commit_sha: string
  ref: string
  workflow: string
  jobs: IngestJob[]
}

export async function POST(request: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────
  const ingestToken = process.env.GRC_INGEST_TOKEN
  if (!ingestToken) {
    return NextResponse.json({ error: 'GRC_INGEST_TOKEN not configured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization')
  const provided = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!provided || provided !== ingestToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ───────────────────────────────────────────────
  let payload: IngestPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { run_id, run_url, commit_sha, ref, workflow, jobs } = payload
  if (!run_id || !commit_sha || !Array.isArray(jobs)) {
    return NextResponse.json({ error: 'run_id, commit_sha, and jobs required' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const collectedAt = new Date().toISOString()

  let evidenceCreated = 0
  let vulnerabilitiesUpserted = 0
  const errors: string[] = []

  // ── Process each job ─────────────────────────────────────────
  for (const job of jobs) {
    const toolConfig = TOOL_CONTROL_MAP[job.tool]
    if (!toolConfig) continue

    // Find the best matching GRC control
    let controlId: string | null = null
    for (const kw of toolConfig.keywords) {
      const { data } = await admin
        .from('grc_controls')
        .select('id')
        .or(`control_id.ilike.%${kw}%,title.ilike.%${kw}%,category.ilike.%${kw}%`)
        .limit(1)
        .single()
      if (data?.id) {
        controlId = data.id
        break
      }
    }

    // Fallback: any control
    if (!controlId) {
      const { data } = await admin.from('grc_controls').select('id').limit(1).single()
      controlId = data?.id ?? null
    }

    if (!controlId) {
      errors.push(`No GRC control found for tool: ${job.tool}`)
      continue
    }

    // Build evidence description
    const statusEmoji = job.outcome === 'success' ? '✅' : job.outcome === 'failure' ? '❌' : '⚠️'
    const description = [
      `${statusEmoji} ${toolConfig.label} completed on ${ref} at commit ${commit_sha.slice(0, 8)}.`,
      `Outcome: ${job.outcome.toUpperCase()}.`,
      job.open_alerts > 0
        ? `${job.open_alerts} open finding${job.open_alerts !== 1 ? 's' : ''} in repository.`
        : 'No open findings.',
      `CI Run: ${run_url}`,
    ].join(' ')

    // Hash for tamper-evidence
    const evidenceHash = createHash('sha256')
      .update(`${run_id}::${job.tool}::${collectedAt}::${commit_sha}`)
      .digest('hex')
      .slice(0, 64)

    // Insert evidence record
    const { error: evidenceErr } = await admin.from('grc_evidence').insert({
      control_id: controlId,
      title: `${toolConfig.label} — CI run ${run_id.slice(-8)}`,
      description,
      source: toolConfig.source as string,
      source_url: run_url,
      source_ref: commit_sha,
      collected_at: collectedAt,
      hash: evidenceHash,
      metadata: {
        run_id,
        workflow,
        ref,
        tool: job.tool,
        outcome: job.outcome,
        open_alerts: job.open_alerts,
        commit_sha,
      },
    })

    if (evidenceErr) {
      errors.push(`Evidence insert failed for ${job.tool}: ${evidenceErr.message}`)
    } else {
      evidenceCreated++
    }

    // ── Create/update vulnerability records for findings ───────
    if (job.alerts?.length) {
      for (const alert of job.alerts) {
        // Skip low/info for automatic ingestion to avoid noise
        if (alert.severity === 'low' || alert.severity === 'info') continue

        // Deduplicate by CVE ID (if present) or by title + scanner
        let existingVuln: { id: string } | null = null

        if (alert.cve_id) {
          const { data } = await admin
            .from('grc_vulnerabilities')
            .select('id')
            .eq('cve_id', alert.cve_id)
            .eq('status', 'open')
            .limit(1)
            .single()
          existingVuln = data
        }

        if (!existingVuln) {
          const { data } = await admin
            .from('grc_vulnerabilities')
            .select('id')
            .eq('title', alert.title)
            .eq('scanner', job.tool)
            .eq('status', 'open')
            .limit(1)
            .single()
          existingVuln = data
        }

        if (existingVuln) {
          // Update source_run_url to latest run that still sees it
          await admin
            .from('grc_vulnerabilities')
            .update({ source_run_url: run_url, source_ref: commit_sha, updated_at: collectedAt })
            .eq('id', existingVuln.id)
        } else {
          // Create new vulnerability record
          const { data: newVuln, error: vulnErr } = await admin
            .from('grc_vulnerabilities')
            .insert({
              title: alert.title,
              severity: alert.severity,
              status: 'open',
              scanner: job.tool,
              cve_id: alert.cve_id ?? null,
              cvss_score: alert.cvss_score ?? null,
              affected_package: alert.affected_package ?? null,
              affected_version: alert.affected_version ?? null,
              fixed_version: alert.fixed_version ?? null,
              file_path: alert.file_path ?? null,
              line_number: alert.line_number ?? null,
              source_run_url: run_url,
              source_ref: commit_sha,
            })
            .select('id')
            .single()

          if (!vulnErr && newVuln && controlId) {
            // Link vulnerability to GRC control
            await admin
              .from('grc_vuln_controls')
              .insert({ vuln_id: newVuln.id, control_id: controlId })
              .select()
          }

          if (!vulnErr) vulnerabilitiesUpserted++
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    run_id,
    commit_sha,
    evidence_created: evidenceCreated,
    vulnerabilities_upserted: vulnerabilitiesUpserted,
    errors: errors.length > 0 ? errors : undefined,
  })
}
