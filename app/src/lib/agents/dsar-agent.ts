import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentFinding } from './types'

// Days before due_at to start escalating
const ESCALATE_DAYS_BEFORE_DUE = 7
// Hours to wait before auto-transitioning 'pending' → 'in_progress'
const AUTO_PROGRESS_HOURS = 2

export async function dsarAgentLogic(
  _runId: string,
  admin: SupabaseClient
): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = []
  const now = new Date()

  // Load all open DSAR requests
  const { data: requests } = await admin
    .from('dsar_requests')
    .select('id, subject_email, request_type, status, received_at, due_at, regulation_ref, assigned_to')
    .not('status', 'in', '("completed","rejected")')
    .order('due_at', { ascending: true })

  for (const req of requests ?? []) {
    const dueAt = new Date(req.due_at)
    const daysUntilDue = Math.floor((dueAt.getTime() - now.getTime()) / 86_400_000)
    const hoursOld = Math.floor((now.getTime() - new Date(req.received_at).getTime()) / 3_600_000)
    const isOverdue = daysUntilDue < 0

    // ── Rule 1: Overdue requests ──────────────────────────────
    if (isOverdue && req.status !== 'overdue') {
      // Mark as overdue
      await admin
        .from('dsar_requests')
        .update({ status: 'overdue', updated_at: now.toISOString() })
        .eq('id', req.id)

      findings.push({
        title: `DSAR overdue — ${req.request_type} request from ${req.subject_email} (${Math.abs(daysUntilDue)}d late)`,
        description: `A "${req.request_type}" DSAR from ${req.subject_email} was due on ${dueAt.toLocaleDateString()} and is now ${Math.abs(daysUntilDue)} day(s) overdue. Under ${req.regulation_ref ?? 'GDPR'} Article 12, failure to respond within 30 days can result in regulatory enforcement and fines up to €20M.`,
        severity: 'critical',
        decisionType: 'escalation',
        ruleTriggered: 'dsar_overdue',
        requiresHumanApproval: true,
        proposedAction: `Immediately process DSAR ${req.id}. Send interim response to ${req.subject_email} acknowledging delay. Consider engaging DPO.`,
        slaHours: 2,
        grcControlKeywords: ['gdpr', 'dsar', 'privacy', 'data'],
        metadata: { dsar_id: req.id, subject: req.subject_email, days_overdue: Math.abs(daysUntilDue), request_type: req.request_type },
      })
    }

    // ── Rule 2: Approaching deadline (7 days) ────────────────
    else if (!isOverdue && daysUntilDue <= ESCALATE_DAYS_BEFORE_DUE && req.status !== 'overdue') {
      findings.push({
        title: `DSAR due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''} — ${req.request_type} from ${req.subject_email}`,
        description: `A "${req.request_type}" request from ${req.subject_email} is due on ${dueAt.toLocaleDateString()} (${daysUntilDue} days). ${req.assigned_to ? 'Assigned.' : 'Not yet assigned — needs immediate assignment.'} Under ${req.regulation_ref ?? 'GDPR'}, the response deadline must be met to avoid regulatory exposure.`,
        severity: daysUntilDue <= 3 ? 'high' : 'medium',
        decisionType: 'finding',
        ruleTriggered: 'dsar_approaching_deadline',
        requiresHumanApproval: false,
        proposedAction: req.assigned_to
          ? `Ensure assignee is actively processing DSAR ${req.id}. Prepare response package before ${dueAt.toLocaleDateString()}.`
          : `Assign DSAR ${req.id} immediately. Generate export package and prepare response for ${req.subject_email}.`,
        slaHours: daysUntilDue <= 3 ? 8 : 24,
        grcControlKeywords: ['gdpr', 'dsar', 'privacy'],
        metadata: { dsar_id: req.id, days_until_due: daysUntilDue, assigned: !!req.assigned_to },
      })
    }

    // ── Rule 3: New requests not transitioned after 2h ───────
    else if (req.status === 'pending' && hoursOld >= AUTO_PROGRESS_HOURS) {
      await admin
        .from('dsar_requests')
        .update({ status: 'in_progress', updated_at: now.toISOString() })
        .eq('id', req.id)

      findings.push({
        title: `DSAR auto-started — ${req.request_type} from ${req.subject_email}`,
        description: `New "${req.request_type}" DSAR from ${req.subject_email} received ${hoursOld}h ago. Automatically transitioned to in_progress. Response required by ${dueAt.toLocaleDateString()}.`,
        severity: 'info',
        decisionType: 'action',
        ruleTriggered: 'dsar_auto_progress',
        requiresHumanApproval: false,
        proposedAction: `Assign DSAR ${req.id} to a team member. Generate data export and prepare response within 30 days.`,
        slaHours: 72,
        grcControlKeywords: ['gdpr', 'dsar', 'privacy'],
        metadata: { dsar_id: req.id, hours_old: hoursOld },
      })
    }
  }

  // ── Rule 4: Erasure DSARs with no deletion proposal ──────────
  const { data: erasureRequests } = await admin
    .from('dsar_requests')
    .select('id, subject_email, subject_user_id, due_at')
    .eq('request_type', 'erasure')
    .eq('status', 'in_progress')

  if (erasureRequests?.length) {
    // Check which erasure DSARs already have proposals
    const { data: existingProposals } = await admin
      .from('data_deletion_proposals')
      .select('dsar_request_id: metadata->dsar_request_id')

    const coveredDsarIds = new Set(
      (existingProposals ?? [])
        .map((p: Record<string, unknown>) => p.dsar_request_id as string)
        .filter(Boolean)
    )

    for (const req of erasureRequests) {
      if (!coveredDsarIds.has(req.id) && req.subject_user_id) {
        // Get all data locations for this user's data categories
        const { data: userLocations } = await admin
          .from('data_locations')
          .select('id, table_name, data_category')
          .not('data_category', 'is', null)
          .limit(20)

        if (userLocations?.length) {
          // Create deletion proposals for each relevant data location
          const proposals = userLocations.map(loc => ({
            data_location_id: loc.id,
            data_category: loc.data_category,
            description: `Erasure DSAR from ${req.subject_email} — delete records in "${loc.table_name}" for user ${req.subject_user_id}`,
            policy_days: 0,
            metadata: { dsar_request_id: req.id },
          }))

          await admin.from('data_deletion_proposals').insert(proposals)

          findings.push({
            title: `Erasure DSAR: deletion proposals created for ${req.subject_email}`,
            description: `"Right to Erasure" request from ${req.subject_email} (due ${new Date(req.due_at).toLocaleDateString()}) now has ${proposals.length} deletion proposals queued across tracked data locations. Human approval required for each.`,
            severity: 'high',
            decisionType: 'action',
            ruleTriggered: 'erasure_dsar_proposals_created',
            requiresHumanApproval: true,
            proposedAction: `Review and approve/reject ${proposals.length} deletion proposals for DSAR ${req.id}. Notify ${req.subject_email} within 30 days.`,
            slaHours: 72,
            grcControlKeywords: ['gdpr', 'erasure', 'dsar', 'deletion'],
            metadata: { dsar_id: req.id, proposals_created: proposals.length },
          })
        }
      }
    }
  }

  return findings
}
