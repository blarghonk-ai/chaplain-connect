import type { AgentFinding } from './types'
import type { createAdminClient } from '@/lib/supabase/server'

const STALE_EVIDENCE_DAYS = 90
const CRITICAL_VULN_MAX_DAYS = 7
const HIGH_VULN_MAX_DAYS = 30
const RISK_REVIEW_MAX_DAYS = 90

export async function complianceAgentLogic(
  _runId: string,
  admin: Awaited<ReturnType<typeof createAdminClient>>
): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = []
  const now = new Date()

  // ── Rule 1: Implemented controls with zero evidence ───────
  const { data: implementations } = await admin
    .from('grc_implementations')
    .select('control_id, status, grc_controls(id, control_id, title)')
    .in('status', ['implemented', 'in_progress'])

  const { data: allEvidence } = await admin
    .from('grc_evidence')
    .select('control_id')

  const controlsWithEvidence = new Set(allEvidence?.map(e => e.control_id) ?? [])

  for (const impl of implementations ?? []) {
    const ctrl = Array.isArray(impl.grc_controls)
      ? impl.grc_controls[0]
      : impl.grc_controls
    if (!ctrl) continue

    if (!controlsWithEvidence.has(ctrl.id) && impl.status === 'implemented') {
      findings.push({
        title: `${ctrl.control_id}: implemented with no evidence`,
        description: `Control "${ctrl.title}" is marked Implemented but has zero evidence records. An auditor will reject this — implementation must be proven with artifacts.`,
        severity: 'high',
        decisionType: 'finding',
        ruleTriggered: 'implemented_no_evidence',
        requiresHumanApproval: false,
        proposedAction: 'Collect and upload evidence for this control, or update status to In Progress.',
        metadata: { control_id: ctrl.id, control_ref: ctrl.control_id, title: ctrl.title },
        slaHours: 48,
        grcControlKeywords: [ctrl.control_id],
      })
    }
  }

  // ── Rule 2: Stale evidence (> 90 days old) ────────────────
  const staleThreshold = new Date(now.getTime() - STALE_EVIDENCE_DAYS * 86_400_000).toISOString()

  const { data: recentEvidence } = await admin
    .from('grc_evidence')
    .select('control_id')
    .gt('collected_at', staleThreshold)

  const controlsWithRecentEvidence = new Set(
    recentEvidence?.map(e => e.control_id) ?? []
  )

  for (const impl of implementations ?? []) {
    const ctrl = Array.isArray(impl.grc_controls)
      ? impl.grc_controls[0]
      : impl.grc_controls
    if (!ctrl) continue
    if (!controlsWithEvidence.has(ctrl.id)) continue // already caught above
    if (controlsWithRecentEvidence.has(ctrl.id)) continue // has recent evidence

    findings.push({
      title: `${ctrl.control_id}: evidence stale > ${STALE_EVIDENCE_DAYS} days`,
      description: `Control "${ctrl.title}" has not had new evidence collected in over ${STALE_EVIDENCE_DAYS} days. SOC 2 requires continuous, current evidence — stale evidence undermines the observation period.`,
      severity: 'medium',
      decisionType: 'finding',
      ruleTriggered: 'stale_evidence_90d',
      requiresHumanApproval: false,
      proposedAction: `Collect fresh evidence for ${ctrl.control_id} and upload to GRC engine.`,
      metadata: { control_id: ctrl.id, control_ref: ctrl.control_id, stale_threshold: staleThreshold },
      slaHours: 72,
    })
  }

  // ── Rule 3: Critical vulns open > 7 days ─────────────────
  const criticalThreshold = new Date(now.getTime() - CRITICAL_VULN_MAX_DAYS * 86_400_000).toISOString()
  const { data: criticalVulns } = await admin
    .from('grc_vulnerabilities')
    .select('id, title, cve_id, cvss_score, found_at')
    .eq('severity', 'critical')
    .eq('status', 'open')
    .lt('found_at', criticalThreshold)

  for (const v of criticalVulns ?? []) {
    const ageInDays = Math.floor((now.getTime() - new Date(v.found_at).getTime()) / 86_400_000)
    findings.push({
      title: `Critical vulnerability open ${ageInDays} days${v.cve_id ? ` — ${v.cve_id}` : ''}`,
      description: `"${v.title}" (CVSS ${v.cvss_score ?? '?'}) has been open for ${ageInDays} days. Critical vulnerabilities must be remediated within ${CRITICAL_VULN_MAX_DAYS} days per SOC 2 CC7.1 and enterprise SLA requirements.`,
      severity: 'critical',
      decisionType: 'escalation',
      ruleTriggered: 'critical_vuln_7d',
      requiresHumanApproval: false,
      proposedAction: 'Remediate immediately or document an accepted risk with compensating controls.',
      metadata: { vuln_id: v.id, cve_id: v.cve_id, cvss_score: v.cvss_score, age_days: ageInDays },
      slaHours: 4,
      grcControlKeywords: ['7.', 'vulnerability', 'patch'],
    })
  }

  // ── Rule 4: High vulns open > 30 days ────────────────────
  const highThreshold = new Date(now.getTime() - HIGH_VULN_MAX_DAYS * 86_400_000).toISOString()
  const { data: highVulns } = await admin
    .from('grc_vulnerabilities')
    .select('id, title, cve_id, cvss_score, found_at')
    .eq('severity', 'high')
    .eq('status', 'open')
    .lt('found_at', highThreshold)

  for (const v of highVulns ?? []) {
    const ageInDays = Math.floor((now.getTime() - new Date(v.found_at).getTime()) / 86_400_000)
    findings.push({
      title: `High vulnerability open ${ageInDays} days${v.cve_id ? ` — ${v.cve_id}` : ''}`,
      description: `"${v.title}" (CVSS ${v.cvss_score ?? '?'}) has exceeded the 30-day SLA for high severity vulnerabilities.`,
      severity: 'high',
      decisionType: 'finding',
      ruleTriggered: 'high_vuln_30d',
      requiresHumanApproval: false,
      proposedAction: 'Remediate or formally accept the risk with documented compensating controls.',
      metadata: { vuln_id: v.id, cve_id: v.cve_id, age_days: ageInDays },
      slaHours: 24,
    })
  }

  // ── Rule 5: Risks not reviewed in 90 days ─────────────────
  const riskThreshold = new Date(now.getTime() - RISK_REVIEW_MAX_DAYS * 86_400_000).toISOString()
  const { data: staleRisks } = await admin
    .from('grc_risks')
    .select('id, title, risk_score, updated_at')
    .in('status', ['open', 'in_treatment'])
    .lt('updated_at', riskThreshold)

  for (const r of staleRisks ?? []) {
    const ageInDays = Math.floor((now.getTime() - new Date(r.updated_at).getTime()) / 86_400_000)
    findings.push({
      title: `Risk "${r.title}" not reviewed in ${ageInDays} days`,
      description: `This risk (score ${r.risk_score ?? '?'}) has not been reviewed in ${ageInDays} days. Risk registers require periodic review to satisfy SOC 2 CC3.2 and ISO 27001 Clause 8.2.`,
      severity: 'medium',
      decisionType: 'finding',
      ruleTriggered: 'risk_unreviewed_90d',
      requiresHumanApproval: false,
      proposedAction: 'Review the risk status, update treatment plan, and re-score if circumstances changed.',
      metadata: { risk_id: r.id, risk_score: r.risk_score, last_updated: r.updated_at },
      slaHours: 72,
    })
  }

  // ── Rule 6: Compliance score below threshold ──────────────
  const { data: allImpls } = await admin
    .from('grc_implementations')
    .select('status, grc_controls(grc_frameworks(key, name))')

  const frameworkStats: Record<string, { total: number; implemented: number }> = {}
  for (const impl of allImpls ?? []) {
    const ctrl = Array.isArray(impl.grc_controls) ? impl.grc_controls[0] : impl.grc_controls
    const fw = ctrl
      ? Array.isArray((ctrl as { grc_frameworks?: unknown }).grc_frameworks)
        ? ((ctrl as { grc_frameworks?: unknown[] }).grc_frameworks ?? [])[0]
        : (ctrl as { grc_frameworks?: unknown }).grc_frameworks
      : null
    if (!fw) continue
    const key = (fw as { key: string }).key
    if (!frameworkStats[key]) frameworkStats[key] = { total: 0, implemented: 0 }
    frameworkStats[key].total++
    if (['implemented', 'evidence_collected', 'audited'].includes(impl.status)) {
      frameworkStats[key].implemented++
    }
  }

  for (const [fwKey, stats] of Object.entries(frameworkStats)) {
    if (stats.total === 0) continue
    const pct = Math.round((stats.implemented / stats.total) * 100)
    if (pct < 70) {
      findings.push({
        title: `${fwKey.toUpperCase()} compliance at ${pct}% — below 70% threshold`,
        description: `Only ${stats.implemented} of ${stats.total} ${fwKey.toUpperCase()} controls are implemented. At ${pct}%, this framework is not audit-ready. A readiness score below 70% suggests systemic gaps.`,
        severity: pct < 40 ? 'critical' : 'high',
        decisionType: 'finding',
        ruleTriggered: 'framework_below_threshold',
        requiresHumanApproval: false,
        proposedAction: `Review all not-started controls in ${fwKey.toUpperCase()} and assign owners and due dates.`,
        metadata: { framework: fwKey, pct, implemented: stats.implemented, total: stats.total },
        slaHours: 24,
      })
    }
  }

  return findings
}
