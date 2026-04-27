import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentFinding } from './types'

const NEW_ADMIN_WINDOW_HOURS = 24
const DORMANT_ADMIN_DAYS = 90
const ESCALATION_WINDOW_DAYS = 7

export async function securityAgentLogic(
  runId: string,
  admin: SupabaseClient
): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = []
  const now = new Date()

  // ── Load all super_admin profiles ────────────────────────────
  const { data: superAdmins } = await admin
    .from('profiles')
    .select('id, email, full_name, role, created_at, updated_at')
    .eq('role', 'super_admin')

  if (!superAdmins?.length) return findings

  // Track which user IDs already have open security events to avoid duplicates
  const { data: existingOpenEvents } = await admin
    .from('security_events')
    .select('subject_user_id, event_type')
    .eq('resolved', false)

  const openEventKeys = new Set(
    (existingOpenEvents ?? []).map(e => `${e.subject_user_id}::${e.event_type}`)
  )

  const newSecurityEvents: Array<{
    agent_run_id: string
    event_type: string
    severity: string
    subject_user_id: string
    subject_email: string | null
    description: string
    metadata: Record<string, unknown>
  }> = []

  // ── Rule 1: New super_admin accounts in past 24h ──────────────
  const newAdminThreshold = new Date(now.getTime() - NEW_ADMIN_WINDOW_HOURS * 3_600_000)

  for (const admin_user of superAdmins) {
    const createdAt = new Date(admin_user.created_at)
    if (createdAt > newAdminThreshold) {
      const key = `${admin_user.id}::new_super_admin`
      if (!openEventKeys.has(key)) {
        newSecurityEvents.push({
          agent_run_id: runId,
          event_type: 'new_super_admin',
          severity: 'critical',
          subject_user_id: admin_user.id,
          subject_email: admin_user.email ?? null,
          description: `New super_admin account created ${Math.round((now.getTime() - createdAt.getTime()) / 3_600_000)}h ago: ${admin_user.email ?? admin_user.id}. All super_admin role grants require formal approval.`,
          metadata: { created_at: admin_user.created_at, email: admin_user.email },
        })
        findings.push({
          title: `New super_admin account: ${admin_user.email ?? admin_user.id}`,
          description: `A new account with super_admin privileges was created ${Math.round((now.getTime() - createdAt.getTime()) / 3_600_000)} hour(s) ago. SOC 2 CC6.2 requires all privileged access grants to be authorized, documented, and reviewed.`,
          severity: 'critical',
          decisionType: 'escalation',
          ruleTriggered: 'new_super_admin_24h',
          requiresHumanApproval: true,
          proposedAction: `Verify that ${admin_user.email ?? admin_user.id} is an authorized super_admin. If not expected, revoke role immediately via Supabase dashboard.`,
          slaHours: 2,
          grcControlKeywords: ['access', 'CC6', 'authorization', 'privilege'],
          metadata: { user_id: admin_user.id, email: admin_user.email, created_at: admin_user.created_at },
        })
      }
    }
  }

  // ── Rule 2: MFA not configured for super_admins ───────────────
  // Attempt to use auth.admin to check MFA factors
  try {
    const { data: authData } = await (admin as unknown as {
      auth: {
        admin: {
          listUsers: () => Promise<{ data: { users: Array<{ id: string; email?: string; factors?: unknown[] }> } }>
        }
      }
    }).auth.admin.listUsers()

    const authUserMap = Object.fromEntries(
      (authData?.users ?? []).map(u => [u.id, u])
    )

    for (const admin_user of superAdmins) {
      const authUser = authUserMap[admin_user.id]
      if (!authUser) continue

      const hasMFA = Array.isArray(authUser.factors) && authUser.factors.length > 0
      if (!hasMFA) {
        const key = `${admin_user.id}::mfa_not_configured`
        if (!openEventKeys.has(key)) {
          newSecurityEvents.push({
            agent_run_id: runId,
            event_type: 'mfa_not_configured',
            severity: 'high',
            subject_user_id: admin_user.id,
            subject_email: admin_user.email ?? null,
            description: `Super_admin account ${admin_user.email ?? admin_user.id} has no MFA factors configured. Multi-factor authentication is mandatory for all privileged accounts under SOC 2 CC6.1.`,
            metadata: { email: admin_user.email, factors_count: 0 },
          })
          findings.push({
            title: `MFA not configured: ${admin_user.email ?? admin_user.id}`,
            description: `Super_admin "${admin_user.email ?? admin_user.id}" has no multi-factor authentication configured. SOC 2 CC6.1 and ISO 27001 A.9.4.2 require MFA for all privileged access. A compromised password would grant full platform access.`,
            severity: 'high',
            decisionType: 'finding',
            ruleTriggered: 'mfa_not_configured',
            requiresHumanApproval: false,
            proposedAction: `Direct ${admin_user.email ?? admin_user.id} to enable TOTP MFA immediately in Supabase Auth settings. Enforce MFA in org policy.`,
            slaHours: 24,
            grcControlKeywords: ['CC6', 'mfa', 'access', 'authentication'],
            metadata: { user_id: admin_user.id, email: admin_user.email },
          })
        }
      }

      // ── Rule 3: Dormant super_admin accounts ─────────────────
      const lastSignIn = authUser && 'last_sign_in_at' in authUser
        ? (authUser as { last_sign_in_at?: string }).last_sign_in_at
        : null

      if (lastSignIn) {
        const daysSinceLogin = Math.floor((now.getTime() - new Date(lastSignIn).getTime()) / 86_400_000)
        if (daysSinceLogin >= DORMANT_ADMIN_DAYS) {
          const key = `${admin_user.id}::dormant_admin`
          if (!openEventKeys.has(key)) {
            newSecurityEvents.push({
              agent_run_id: runId,
              event_type: 'dormant_admin',
              severity: 'medium',
              subject_user_id: admin_user.id,
              subject_email: admin_user.email ?? null,
              description: `Super_admin ${admin_user.email ?? admin_user.id} has not logged in for ${daysSinceLogin} days. Dormant privileged accounts should be reviewed and deprovisioned.`,
              metadata: { last_sign_in_at: lastSignIn, days_dormant: daysSinceLogin },
            })
            findings.push({
              title: `Dormant super_admin (${daysSinceLogin}d): ${admin_user.email ?? admin_user.id}`,
              description: `Super_admin "${admin_user.email ?? admin_user.id}" has not signed in for ${daysSinceLogin} days. SOC 2 CC6.2 and ISO 27001 A.9.2.6 require periodic access reviews — dormant privileged accounts must be disabled or verified.`,
              severity: 'medium',
              decisionType: 'finding',
              ruleTriggered: 'dormant_admin_90d',
              requiresHumanApproval: false,
              proposedAction: `Review whether ${admin_user.email ?? admin_user.id} still requires super_admin access. If not, revoke role. If still needed, confirm with the account holder.`,
              slaHours: 72,
              grcControlKeywords: ['CC6', 'access', 'review', 'privilege'],
              metadata: { user_id: admin_user.id, last_sign_in_at: lastSignIn, days_dormant: daysSinceLogin },
            })
          }
        }
      }
    }
  } catch {
    // auth.admin not available in this context — skip MFA and dormancy checks
  }

  // ── Rule 4: Potential privilege escalation ────────────────────
  // Check for profiles where role = super_admin AND updated_at is recent
  // but created_at is NOT recent (meaning role was CHANGED, not freshly created)
  const escalationWindow = new Date(now.getTime() - ESCALATION_WINDOW_DAYS * 86_400_000)
  const newAdminWindow = new Date(now.getTime() - NEW_ADMIN_WINDOW_HOURS * 3_600_000)

  for (const admin_user of superAdmins) {
    const updatedAt = new Date(admin_user.updated_at)
    const createdAt = new Date(admin_user.created_at)

    // Role was recently updated, but account is NOT brand new → escalation
    if (updatedAt > escalationWindow && createdAt <= newAdminWindow) {
      const key = `${admin_user.id}::privilege_escalation`
      if (!openEventKeys.has(key)) {
        const hoursAgo = Math.round((now.getTime() - updatedAt.getTime()) / 3_600_000)
        newSecurityEvents.push({
          agent_run_id: runId,
          event_type: 'privilege_escalation',
          severity: 'high',
          subject_user_id: admin_user.id,
          subject_email: admin_user.email ?? null,
          description: `Existing user ${admin_user.email ?? admin_user.id} had their profile updated to super_admin ${hoursAgo}h ago. This may indicate an unauthorized privilege escalation.`,
          metadata: { updated_at: admin_user.updated_at, created_at: admin_user.created_at },
        })
        findings.push({
          title: `Privilege escalation detected: ${admin_user.email ?? admin_user.id} (${hoursAgo}h ago)`,
          description: `User "${admin_user.email ?? admin_user.id}" was granted super_admin role approximately ${hoursAgo} hours ago. SOC 2 CC6.2 requires all privilege grants to be formally authorized. This may represent an unauthorized escalation.`,
          severity: 'high',
          decisionType: 'escalation',
          ruleTriggered: 'privilege_escalation',
          requiresHumanApproval: true,
          proposedAction: `Verify the super_admin grant for ${admin_user.email ?? admin_user.id} was intentional and authorized. Check audit logs for who made the change. If unauthorized, revoke immediately.`,
          slaHours: 8,
          grcControlKeywords: ['CC6', 'access', 'authorization', 'privilege'],
          metadata: { user_id: admin_user.id, updated_at: admin_user.updated_at },
        })
      }
    }
  }

  // ── Rule 5: GRC controls with no owner ───────────────────────
  const { data: unownedControls } = await admin
    .from('grc_implementations')
    .select('id, control_id, status, grc_controls(control_id, title)')
    .is('owner_id', null)
    .in('status', ['in_progress', 'implemented', 'evidence_collected'])

  if (unownedControls && unownedControls.length > 5) {
    findings.push({
      title: `${unownedControls.length} active GRC controls have no assigned owner`,
      description: `${unownedControls.length} controls in active status (in_progress, implemented, or evidence_collected) have no owner_id assigned. SOC 2 CC1.3 and ISO 27001 A.5.1.1 require clear ownership of all security controls.`,
      severity: 'medium',
      decisionType: 'finding',
      ruleTriggered: 'unowned_controls',
      requiresHumanApproval: false,
      proposedAction: `Assign owners to all active GRC controls in the GRC dashboard. Filter by status and bulk-assign ownership.`,
      slaHours: 72,
      grcControlKeywords: ['CC1', 'access', 'governance', 'ownership'],
      metadata: { unowned_count: unownedControls.length },
    })
  }

  // Batch insert security events
  if (newSecurityEvents.length > 0) {
    await admin.from('security_events').insert(newSecurityEvents)
  }

  return findings
}
