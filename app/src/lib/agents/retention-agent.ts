import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentFinding } from './types'
import { createHash } from 'crypto'

// How long to wait before escalating unprocessed withdrawal events
const WITHDRAWAL_ESCALATION_HOURS = 72

export async function retentionAgentLogic(
  _runId: string,
  admin: SupabaseClient
): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = []
  const now = new Date()

  // ── Rule 1: Consent withdrawal events pending > 72h ──────────
  const withdrawalCutoff = new Date(now.getTime() - WITHDRAWAL_ESCALATION_HOURS * 3_600_000).toISOString()
  const { data: pendingWithdrawals } = await admin
    .from('consent_withdrawal_events')
    .select('id, user_id, purpose, withdrawn_at, status')
    .eq('status', 'pending')
    .lt('withdrawn_at', withdrawalCutoff)

  for (const w of pendingWithdrawals ?? []) {
    const hoursOverdue = Math.round((now.getTime() - new Date(w.withdrawn_at).getTime()) / 3_600_000)
    findings.push({
      title: `Consent withdrawal unprocessed for ${hoursOverdue}h — purpose: ${w.purpose}`,
      description: `User ${w.user_id} withdrew consent for "${w.purpose}" ${hoursOverdue} hours ago. GDPR Art.17 requires prompt action following a withdrawal request. The withdrawal event has been sitting in 'pending' status since ${new Date(w.withdrawn_at).toLocaleDateString()}.`,
      severity: 'critical',
      decisionType: 'action',
      ruleTriggered: 'withdrawal_unprocessed_72h',
      requiresHumanApproval: true,
      proposedAction: `Review and initiate data deletion for purpose "${w.purpose}" for user ${w.user_id}. Create a data_deletion_proposal and generate a signed receipt on completion.`,
      slaHours: 4,
      grcControlKeywords: ['gdpr', 'consent', 'privacy', 'data'],
      metadata: { withdrawal_id: w.id, user_id: w.user_id, purpose: w.purpose, withdrawn_at: w.withdrawn_at },
    })
  }

  // ── Rule 2: Data locations past retention policy ──────────────
  const { data: policies } = await admin
    .from('retention_policies')
    .select('data_category, retention_days')

  const { data: locations } = await admin
    .from('data_locations')
    .select('id, table_name, column_name, data_category, retention_days, last_verified_at')

  const policyMap = Object.fromEntries(
    (policies ?? []).map(p => [p.data_category, p.retention_days])
  )

  // Check for existing pending proposals to avoid duplicate proposals
  const { data: existingProposals } = await admin
    .from('data_deletion_proposals')
    .select('data_location_id')
    .eq('status', 'pending')

  const pendingProposalLocations = new Set(
    (existingProposals ?? []).map(p => p.data_location_id).filter(Boolean)
  )

  const newProposals: Array<{
    data_location_id: string
    data_category: string
    description: string
    policy_days: number
  }> = []

  for (const loc of locations ?? []) {
    const policyDays = policyMap[loc.data_category] ?? loc.retention_days
    const lastVerified = new Date(loc.last_verified_at)
    const daysSinceVerified = Math.floor((now.getTime() - lastVerified.getTime()) / 86_400_000)

    if (daysSinceVerified > policyDays && !pendingProposalLocations.has(loc.id)) {
      newProposals.push({
        data_location_id: loc.id,
        data_category: loc.data_category,
        description: `Data location "${loc.table_name}${loc.column_name ? '.' + loc.column_name : ''}" (category: ${loc.data_category}) was last verified ${daysSinceVerified} days ago. Retention policy allows ${policyDays} days. A deletion or re-verification is required.`,
        policy_days: policyDays,
      })

      findings.push({
        title: `Retention policy exceeded: ${loc.table_name}${loc.column_name ? '.' + loc.column_name : ''} (${daysSinceVerified}d > ${policyDays}d)`,
        description: `Data at "${loc.table_name}" has not been verified in ${daysSinceVerified} days, exceeding the ${policyDays}-day retention policy for category "${loc.data_category}". A deletion proposal has been queued.`,
        severity: daysSinceVerified > policyDays * 1.5 ? 'high' : 'medium',
        decisionType: 'action',
        ruleTriggered: 'retention_policy_exceeded',
        requiresHumanApproval: true,
        proposedAction: `Review "${loc.table_name}". If data is no longer needed, approve the deletion proposal. If still active, update last_verified_at and adjust retention policy.`,
        slaHours: 48,
        grcControlKeywords: ['gdpr', 'retention', 'data', 'privacy'],
        metadata: { location_id: loc.id, table: loc.table_name, days_overdue: daysSinceVerified - policyDays },
      })
    }
  }

  if (newProposals.length > 0) {
    await admin.from('data_deletion_proposals').insert(newProposals)
  }

  // ── Rule 3: Approved deletion proposals not yet executed > 48h
  const executionCutoff = new Date(now.getTime() - 48 * 3_600_000).toISOString()
  const { data: stuckApprovals } = await admin
    .from('data_deletion_proposals')
    .select('id, data_category, description, approved_at')
    .eq('status', 'approved')
    .not('approved_at', 'is', null)
    .lt('approved_at', executionCutoff)

  for (const proposal of stuckApprovals ?? []) {
    const hoursStuck = Math.round(
      (now.getTime() - new Date(proposal.approved_at).getTime()) / 3_600_000
    )
    findings.push({
      title: `Approved deletion not executed after ${hoursStuck}h`,
      description: `Deletion proposal for "${proposal.data_category}" data was approved ${hoursStuck} hours ago but has not been executed. Approved deletions must be completed promptly to satisfy GDPR Article 17 and CCPA deletion rights.`,
      severity: 'high',
      decisionType: 'escalation',
      ruleTriggered: 'approved_deletion_not_executed',
      requiresHumanApproval: true,
      proposedAction: `Execute deletion proposal ${proposal.id} immediately and generate a signed data_deletion_receipt upon completion.`,
      slaHours: 8,
      grcControlKeywords: ['gdpr', 'retention', 'deletion', 'privacy'],
      metadata: { proposal_id: proposal.id, hours_stuck: hoursStuck },
    })
  }

  // ── Rule 4: Generate receipts for recently approved + executed proposals
  const { data: executedProposals } = await admin
    .from('data_deletion_proposals')
    .select('id, data_location_id, data_category')
    .eq('status', 'executed')
    .is('id', null) // placeholder — in real impl, track receipt_generated separately
    // For MVP, we skip receipt auto-generation (it requires knowing actual deleted count)

  void executedProposals // acknowledged but deferred to manual receipt creation

  return findings
}

/**
 * Create a signed deletion receipt after data has been deleted.
 * Called by the approval workflow when a proposal is executed.
 */
export function createDeletionHash(
  proposalId: string,
  deletedAt: string,
  recordCount: number
): string {
  return createHash('sha256')
    .update(`${proposalId}::${deletedAt}::${recordCount}`)
    .digest('hex')
}
