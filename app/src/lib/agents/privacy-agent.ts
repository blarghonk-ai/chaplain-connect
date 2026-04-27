import type { AgentFinding } from './types'
import type { createAdminClient } from '@/lib/supabase/server'

const ROPA_STALE_DAYS = 30
const ASSESSMENT_STUCK_DAYS = 30
const WITHDRAWAL_SLA_HOURS = 72

export async function privacyAgentLogic(
  _runId: string,
  admin: Awaited<ReturnType<typeof createAdminClient>>
): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = []
  const now = new Date()

  // ── Rule 1: ROPA not updated in 30+ days ─────────────────
  const ropaThreshold = new Date(now.getTime() - ROPA_STALE_DAYS * 86_400_000).toISOString()
  const { data: staleRopas } = await admin
    .from('privacy_assessments')
    .select('id, title, updated_at, status')
    .eq('assessment_type', 'ropa')
    .lt('updated_at', ropaThreshold)
    .neq('status', 'archived')

  for (const ropa of staleRopas ?? []) {
    const ageInDays = Math.floor((now.getTime() - new Date(ropa.updated_at).getTime()) / 86_400_000)
    findings.push({
      title: `ROPA not updated in ${ageInDays} days`,
      description: `The Record of Processing Activities "${ropa.title}" has not been reviewed in ${ageInDays} days. GDPR Article 30 requires the ROPA to be kept up-to-date at all times. A stale ROPA will fail a DPA audit.`,
      severity: ageInDays > 90 ? 'high' : 'medium',
      decisionType: 'finding',
      ruleTriggered: 'ropa_stale',
      requiresHumanApproval: false,
      proposedAction: 'Review the ROPA, update any changed data flows, recipients, or legal bases, and mark sections as complete.',
      metadata: { assessment_id: ropa.id, age_days: ageInDays, status: ropa.status },
      slaHours: 72,
      grcControlKeywords: ['privacy', 'personal', 'data'],
    })
  }

  // ── Rule 2: data_locations missing legal_basis ────────────
  const { data: noLegalBasis } = await admin
    .from('data_locations')
    .select('id, table_name, column_name, data_category')
    .eq('is_pii', true)
    .is('legal_basis', null)

  if ((noLegalBasis ?? []).length > 0) {
    findings.push({
      title: `${noLegalBasis!.length} PII field${noLegalBasis!.length > 1 ? 's' : ''} with no legal basis defined`,
      description: `GDPR Article 6 and equivalent laws require a documented lawful basis for every processing activity. ${noLegalBasis!.length} PII data location${noLegalBasis!.length > 1 ? 's are' : ' is'} missing a legal basis — this is a compliance violation across GDPR, UK GDPR, LGPD, and PIPL.`,
      severity: 'high',
      decisionType: 'finding',
      ruleTriggered: 'pii_no_legal_basis',
      requiresHumanApproval: false,
      proposedAction: 'Update each data_location record with the appropriate legal basis (contract, consent, legitimate_interests, legal_obligation, etc.).',
      metadata: {
        affected_fields: (noLegalBasis ?? []).map(l => `${l.table_name}.${l.column_name ?? '(bucket)'}`),
        count: noLegalBasis!.length,
      },
      slaHours: 48,
      grcControlKeywords: ['privacy', 'legal', 'basis'],
    })
  }

  // ── Rule 3: Draft assessments stuck > 30 days ─────────────
  const assessThreshold = new Date(now.getTime() - ASSESSMENT_STUCK_DAYS * 86_400_000).toISOString()
  const { data: stuckAssessments } = await admin
    .from('privacy_assessments')
    .select('id, title, assessment_type, updated_at')
    .eq('status', 'draft')
    .lt('updated_at', assessThreshold)

  for (const a of stuckAssessments ?? []) {
    const ageInDays = Math.floor((now.getTime() - new Date(a.updated_at).getTime()) / 86_400_000)
    const typeMap: Record<string, string> = { pia: 'PIA', dpia: 'DPIA', tia: 'TIA', ropa: 'ROPA' }
    findings.push({
      title: `${typeMap[a.assessment_type] ?? a.assessment_type} "${a.title}" stuck in draft for ${ageInDays} days`,
      description: `This ${typeMap[a.assessment_type] ?? 'assessment'} has been in draft status for ${ageInDays} days. Incomplete assessments provide no compliance protection — they must be completed, reviewed, and approved to satisfy regulatory requirements.`,
      severity: a.assessment_type === 'dpia' ? 'high' : 'medium',
      decisionType: 'finding',
      ruleTriggered: 'assessment_stuck_draft',
      requiresHumanApproval: false,
      proposedAction: `Complete all sections of "${a.title}", submit for review, and obtain sign-off.`,
      metadata: { assessment_id: a.id, type: a.assessment_type, age_days: ageInDays },
      slaHours: 72,
    })
  }

  // ── Rule 4: Pending consent withdrawal events ─────────────
  const withdrawalThreshold = new Date(now.getTime() - WITHDRAWAL_SLA_HOURS * 3_600_000).toISOString()
  const { data: staleWithdrawals } = await admin
    .from('consent_withdrawal_events')
    .select('id, user_id, purpose, withdrawn_at')
    .eq('status', 'pending')
    .lt('withdrawn_at', withdrawalThreshold)

  if ((staleWithdrawals ?? []).length > 0) {
    findings.push({
      title: `${staleWithdrawals!.length} consent withdrawal${staleWithdrawals!.length > 1 ? 's' : ''} not processed within ${WITHDRAWAL_SLA_HOURS}h`,
      description: `${staleWithdrawals!.length} user${staleWithdrawals!.length > 1 ? 's have' : ' has'} withdrawn consent but data deletion has not been initiated. GDPR Article 7(3) requires processing to cease immediately upon withdrawal. This breach exposes the platform to regulatory enforcement.`,
      severity: 'critical',
      decisionType: 'escalation',
      ruleTriggered: 'withdrawal_not_processed',
      requiresHumanApproval: true,
      proposedAction: 'Initiate RetentionAgent deletion workflow for each pending withdrawal immediately.',
      metadata: { withdrawal_ids: (staleWithdrawals ?? []).map(w => w.id), count: staleWithdrawals!.length },
      slaHours: 4,
      grcControlKeywords: ['privacy', 'erasure', 'consent'],
    })
  }

  // ── Rule 5: HIPAA — no BAA documentation ─────────────────
  const { data: hipaa } = await admin
    .from('privacy_regulations')
    .select('id, compliance_notes')
    .eq('regulation_short', 'HIPAA')
    .eq('applies_to_us', true)
    .single()

  // Check if there's a DPIA or assessment for HIPAA compliance
  const { count: hipaaAssessments } = await admin
    .from('privacy_assessments')
    .select('*', { count: 'exact', head: true })
    .ilike('title', '%HIPAA%')

  if (hipaa && (hipaaAssessments ?? 0) === 0) {
    findings.push({
      title: 'HIPAA — No documented compliance assessment',
      description: 'Chaplain Connect targets healthcare customers but has no HIPAA compliance assessment on record. A Business Associate Agreement (BAA) must be executed with Supabase, Vercel, Groq, and Mux before processing any Protected Health Information (PHI). This is a blocking requirement for all hospital and healthcare contracts.',
      severity: 'critical',
      decisionType: 'finding',
      ruleTriggered: 'hipaa_no_assessment',
      requiresHumanApproval: false,
      proposedAction: 'Create a HIPAA compliance assessment. Execute BAAs with: Supabase (Pro plan), Vercel (Enterprise), Groq (confirm availability), Mux (confirm availability). Do not onboard healthcare customers until complete.',
      metadata: { regulation_id: hipaa?.id },
      slaHours: 48,
      grcControlKeywords: ['HIPAA', 'health', 'PHI'],
    })
  }

  // ── Rule 6: Regulations with no compliance posture ────────
  const { data: allRegs } = await admin
    .from('privacy_regulations')
    .select('id, regulation_short, jurisdiction_name, applies_to_us')
    .eq('is_active', true)
    .eq('applies_to_us', true)

  // Check for regulations with no data in our system
  const { data: assessmentTitles } = await admin
    .from('privacy_assessments')
    .select('title')

  const assessmentText = (assessmentTitles ?? []).map(a => a.title.toLowerCase()).join(' ')

  for (const reg of allRegs ?? []) {
    const regMentioned = assessmentText.includes(reg.regulation_short.toLowerCase())
    if (!regMentioned && reg.regulation_short !== 'HIPAA') {  // HIPAA handled above
      findings.push({
        title: `${reg.regulation_short} — no compliance documentation found`,
        description: `${reg.regulation_short} (${reg.jurisdiction_name}) applies to Chaplain Connect but has no privacy assessment, ROPA section, or compliance documentation on record. Every applicable regulation requires documented compliance posture.`,
        severity: 'medium',
        decisionType: 'finding',
        ruleTriggered: 'regulation_no_documentation',
        requiresHumanApproval: false,
        proposedAction: `Create a ${reg.regulation_short} compliance section in the ROPA and document your compliance posture at /dashboard/privacy.`,
        metadata: { regulation_id: reg.id, regulation: reg.regulation_short, jurisdiction: reg.jurisdiction_name },
        slaHours: 168,  // 1 week
      })
    }
  }

  return findings
}
