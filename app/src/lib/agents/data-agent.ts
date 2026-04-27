import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentFinding } from './types'

// Column name patterns that indicate PCI/sensitive data stored where it shouldn't be
const CVV_PATTERNS = /\b(cvv|cvc|cvc2|cvv2|security_code|card_verification|cvn)\b/i
const PAN_PATTERNS = /\b(pan|card_number|credit_card|cc_number|cardnumber|card_no)\b/i
const SSN_PATTERNS = /\b(ssn|social_security|social_security_number|sin|national_id|tin)\b/i

// Tables that are expected to hold financial data (not violations if found there in controlled form)
const ALLOWED_FINANCIAL_TABLES = new Set(['stripe_events', 'billing_events', 'audit_log_stripe'])

export async function dataAgentLogic(
  _runId: string,
  admin: SupabaseClient
): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = []

  // Load all data_locations
  const { data: locations } = await admin
    .from('data_locations')
    .select('id, table_name, column_name, data_category, is_pii, is_encrypted, legal_basis, retention_days, notes')

  if (!locations?.length) return findings

  // Load existing open violations to avoid duplicates
  const { data: existingViolations } = await admin
    .from('data_violations')
    .select('data_location_id, violation_type')
    .eq('status', 'open')

  const openViolationKeys = new Set(
    (existingViolations ?? []).map(v => `${v.data_location_id}::${v.violation_type}`)
  )

  const newViolations: Array<{
    data_location_id: string
    violation_type: string
    severity: string
    table_name: string | null
    column_name: string | null
    description: string
    metadata: Record<string, unknown>
  }> = []

  for (const loc of locations) {
    const col = loc.column_name?.toLowerCase() ?? ''
    const table = loc.table_name?.toLowerCase() ?? ''

    // ── Rule 1: CVV column names ──────────────────────────────
    if (col && CVV_PATTERNS.test(col) && !ALLOWED_FINANCIAL_TABLES.has(table)) {
      const key = `${loc.id}::cvv_column`
      if (!openViolationKeys.has(key)) {
        newViolations.push({
          data_location_id: loc.id,
          violation_type: 'cvv_column',
          severity: 'critical',
          table_name: loc.table_name,
          column_name: loc.column_name,
          description: `Column "${loc.column_name}" in table "${loc.table_name}" matches CVV/security code naming patterns. Storing card verification values violates PCI-DSS Requirement 3.2.1. This data must never be stored post-authorization.`,
          metadata: { pci_requirement: '3.2.1', data_category: loc.data_category },
        })
        findings.push({
          title: `CVV/CVC column detected: ${loc.table_name}.${loc.column_name}`,
          description: `Column "${loc.column_name}" in "${loc.table_name}" appears to store card verification values. PCI-DSS prohibits storage of CVV/CVC after authorization under any circumstances.`,
          severity: 'critical',
          decisionType: 'finding',
          ruleTriggered: 'cvv_column_detected',
          requiresHumanApproval: true,
          proposedAction: `Immediately audit and purge "${loc.table_name}.${loc.column_name}". Remove column from schema. Engage PCI QSA.`,
          slaHours: 1,
          grcControlKeywords: ['pci', 'financial', 'encryption', 'data'],
          metadata: { table: loc.table_name, column: loc.column_name },
        })
      }
    }

    // ── Rule 2: PAN column names ──────────────────────────────
    if (col && PAN_PATTERNS.test(col) && !ALLOWED_FINANCIAL_TABLES.has(table)) {
      const key = `${loc.id}::pan_column`
      if (!openViolationKeys.has(key)) {
        newViolations.push({
          data_location_id: loc.id,
          violation_type: 'pan_column',
          severity: 'critical',
          table_name: loc.table_name,
          column_name: loc.column_name,
          description: `Column "${loc.column_name}" in table "${loc.table_name}" matches Primary Account Number naming patterns. PANs must be tokenized or encrypted per PCI-DSS Requirement 3.4.`,
          metadata: { pci_requirement: '3.4', data_category: loc.data_category },
        })
        findings.push({
          title: `Card PAN column detected: ${loc.table_name}.${loc.column_name}`,
          description: `Column "${loc.column_name}" in "${loc.table_name}" matches Primary Account Number patterns. PAN must never be stored unmasked/unencrypted. PCI-DSS Req 3.4.`,
          severity: 'critical',
          decisionType: 'finding',
          ruleTriggered: 'pan_column_detected',
          requiresHumanApproval: true,
          proposedAction: `Replace with Stripe payment method IDs. If PAN required, tokenize via PCI-compliant vault. Engage QSA immediately.`,
          slaHours: 1,
          grcControlKeywords: ['pci', 'financial', 'encryption'],
          metadata: { table: loc.table_name, column: loc.column_name },
        })
      }
    }

    // ── Rule 3: SSN column names ──────────────────────────────
    if (col && SSN_PATTERNS.test(col)) {
      const key = `${loc.id}::ssn_column`
      if (!openViolationKeys.has(key)) {
        newViolations.push({
          data_location_id: loc.id,
          violation_type: 'ssn_column',
          severity: 'high',
          table_name: loc.table_name,
          column_name: loc.column_name,
          description: `Column "${loc.column_name}" in table "${loc.table_name}" matches SSN/government ID naming patterns. Requires encryption at rest, strict access controls, and legal basis documentation.`,
          metadata: { data_category: loc.data_category },
        })
        findings.push({
          title: `SSN/Government ID column detected: ${loc.table_name}.${loc.column_name}`,
          description: `Column "${loc.column_name}" in "${loc.table_name}" may store Social Security Numbers or government IDs. These require encryption, need-to-know access, and explicit legal basis under HIPAA/GDPR.`,
          severity: 'high',
          decisionType: 'finding',
          ruleTriggered: 'ssn_column_detected',
          requiresHumanApproval: true,
          proposedAction: `Verify this column is AES-256 encrypted at rest, access-logged, and has explicit legal basis. If not needed, drop the column.`,
          slaHours: 24,
          grcControlKeywords: ['hipaa', 'encryption', 'access', 'data'],
          metadata: { table: loc.table_name, column: loc.column_name },
        })
      }
    }

    // ── Rule 4: PII stored unencrypted ────────────────────────
    if (loc.is_pii && !loc.is_encrypted && loc.data_category === 'health_data') {
      const key = `${loc.id}::unencrypted_pii`
      if (!openViolationKeys.has(key)) {
        newViolations.push({
          data_location_id: loc.id,
          violation_type: 'unencrypted_pii',
          severity: 'high',
          table_name: loc.table_name,
          column_name: loc.column_name,
          description: `Health data at "${loc.table_name}${loc.column_name ? '.' + loc.column_name : ''}" is flagged as PII but not encrypted. HIPAA Security Rule requires encryption of PHI at rest.`,
          metadata: { data_category: loc.data_category, legal_basis: loc.legal_basis },
        })
        findings.push({
          title: `Unencrypted health data: ${loc.table_name}${loc.column_name ? '.' + loc.column_name : ''}`,
          description: `Health PII in "${loc.table_name}" is not marked as encrypted. HIPAA Security Rule §164.312(a)(2)(iv) requires encryption of PHI. Chaplain Connect serves healthcare chaplains — this is a critical gap.`,
          severity: 'high',
          decisionType: 'finding',
          ruleTriggered: 'unencrypted_health_pii',
          requiresHumanApproval: false,
          proposedAction: `Enable column-level encryption or Supabase transparent encryption. Update data_locations.is_encrypted = true once confirmed.`,
          slaHours: 24,
          grcControlKeywords: ['hipaa', 'encryption', 'data'],
          metadata: { table: loc.table_name, column: loc.column_name },
        })
      }
    }

    // ── Rule 5: PII with no legal basis documented ────────────
    if (loc.is_pii && (!loc.legal_basis || loc.legal_basis === '')) {
      const key = `${loc.id}::missing_legal_basis`
      if (!openViolationKeys.has(key)) {
        newViolations.push({
          data_location_id: loc.id,
          violation_type: 'missing_legal_basis',
          severity: 'medium',
          table_name: loc.table_name,
          column_name: loc.column_name,
          description: `PII field "${loc.table_name}${loc.column_name ? '.' + loc.column_name : ''}" has no legal basis documented. GDPR Article 6 requires a lawful basis for every processing activity.`,
          metadata: { data_category: loc.data_category },
        })
        findings.push({
          title: `Missing legal basis: ${loc.table_name}${loc.column_name ? '.' + loc.column_name : ''}`,
          description: `PII at "${loc.table_name}" has no legal basis recorded in the data map. GDPR Art.6 requires documented lawful basis for all personal data processing.`,
          severity: 'medium',
          decisionType: 'finding',
          ruleTriggered: 'missing_legal_basis',
          requiresHumanApproval: false,
          proposedAction: `Update data_locations record with the appropriate legal_basis (consent, contract, legitimate_interests, legal_obligation, vital_interests, or public_task).`,
          slaHours: 72,
          grcControlKeywords: ['gdpr', 'privacy', 'data'],
          metadata: { table: loc.table_name, column: loc.column_name },
        })
      }
    }

    // ── Rule 6: Financial data with excessive retention ───────
    if (loc.data_category === 'financial_data' && loc.retention_days > 2555) {
      const key = `${loc.id}::excessive_retention`
      if (!openViolationKeys.has(key)) {
        newViolations.push({
          data_location_id: loc.id,
          violation_type: 'excessive_retention',
          severity: 'low',
          table_name: loc.table_name,
          column_name: loc.column_name,
          description: `Financial data at "${loc.table_name}" has retention of ${loc.retention_days} days (>${Math.round(loc.retention_days / 365)} years). Exceeds 7-year maximum needed for SOX/PCI compliance.`,
          metadata: { retention_days: loc.retention_days, policy_max: 2555 },
        })
        // Don't emit agent finding for low severity excessive retention — just write the violation
      }
    }
  }

  // Batch insert new violations
  if (newViolations.length > 0) {
    await admin.from('data_violations').insert(newViolations)
  }

  return findings
}
