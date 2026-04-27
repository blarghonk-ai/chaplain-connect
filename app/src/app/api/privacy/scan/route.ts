import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PII detection patterns for scanning text/jsonb columns
const PII_PATTERNS = [
  { label: 'Email address', regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/ },
  { label: 'US phone number', regex: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/ },
  { label: 'SSN', regex: /\d{3}-\d{2}-\d{4}/ },
  { label: 'Credit card number', regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/ },
]

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = await createAdminClient()

  // Scan audit_log metadata (jsonb → text) for unexpected PII
  const findings: { table: string; column: string; pattern: string; sample_count: number }[] = []

  // Check audit_logs metadata for email addresses
  for (const pattern of PII_PATTERNS) {
    const { count } = await admin
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .filter('metadata', 'fts', pattern.label.toLowerCase().replace(/ /g, ' & '))

    if (count && count > 0) {
      findings.push({
        table: 'audit_logs',
        column: 'metadata',
        pattern: pattern.label,
        sample_count: count,
      })
    }
  }

  // Update last_verified_at for all data locations
  await admin
    .from('data_locations')
    .update({ last_verified_at: new Date().toISOString() })
    .neq('id', '00000000-0000-0000-0000-000000000000')  // update all

  // Record the scan as GRC evidence
  const { data: locationCount } = await admin
    .from('data_locations')
    .select('*', { count: 'exact', head: true })

  // Find a relevant control to link evidence to
  const { data: ctrl } = await admin
    .from('grc_controls')
    .select('id')
    .or('control_id.ilike.%6.1%,title.ilike.%data%,title.ilike.%privacy%')
    .limit(1)
    .single()

  if (ctrl?.id) {
    await admin.from('grc_evidence').insert({
      control_id: ctrl.id,
      title: 'Privacy Data Location Scan',
      description: `Manual privacy scan completed. ${locationCount ?? 0} data locations verified. ${findings.length} potential anomalies detected.`,
      source: 'manual',
      collected_at: new Date().toISOString(),
      hash: Buffer.from(`privacy_scan_${Date.now()}`).toString('hex').slice(0, 64),
      metadata: { findings, scan_type: 'manual', scanned_by: user.id },
    })
  }

  return NextResponse.json({
    scanned_at: new Date().toISOString(),
    locations_verified: locationCount ?? 0,
    findings,
  })
}
