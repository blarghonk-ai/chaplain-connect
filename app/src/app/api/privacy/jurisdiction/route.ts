/**
 * GET  /api/privacy/jurisdiction — returns the caller's jurisdiction profile + applicable regulations
 * POST /api/privacy/jurisdiction — upsert jurisdiction (declared_residency override)
 *
 * The jurisdiction mapper:
 *  1. Uses org.country_code as the base jurisdiction (set by admin in Settings)
 *  2. Optionally overridden by declared_residency on the user's profile
 *  3. Appends universal regulations (HIPAA if org processes health data, COPPA if children's data)
 *  4. Writes/updates user_jurisdiction_profiles with applicable_regulation_ids
 */
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Country code → jurisdiction codes that apply (primary + parent jurisdictions)
const COUNTRY_JURISDICTION_MAP: Record<string, string[]> = {
  // EU member states → EU GDPR
  AT: ['EU'], BE: ['EU'], BG: ['EU'], HR: ['EU'], CY: ['EU'], CZ: ['EU'],
  DK: ['EU'], EE: ['EU'], FI: ['EU'], FR: ['EU'], DE: ['EU'], GR: ['EU'],
  HU: ['EU'], IE: ['EU'], IT: ['EU'], LV: ['EU'], LT: ['EU'], LU: ['EU'],
  MT: ['EU'], NL: ['EU'], PL: ['EU'], PT: ['EU'], RO: ['EU'], SK: ['EU'],
  SI: ['EU'], ES: ['EU'], SE: ['EU'],
  // UK
  GB: ['UK'],
  // Americas
  US: ['US'],
  CA: ['CA'],
  BR: ['BR'],
  // Asia-Pacific
  CN: ['CN'],
  JP: ['JP'],
  KR: ['KR'],
  SG: ['SG'],
  TH: ['TH'],
  AU: ['AU'],
  IN: ['IN'],
  AE: ['AE'],
}

// US state-specific privacy laws
const US_STATE_JURISDICTION_MAP: Record<string, string[]> = {
  'US-CA': ['US', 'US-CA'],
  'US-CO': ['US', 'US-CO'],
  'US-CT': ['US', 'US-CT'],
  'US-TX': ['US', 'US-TX'],
  'US-VA': ['US', 'US-VA'],
}

function resolveJurisdictions(countryCode: string): string[] {
  const upper = countryCode.toUpperCase()
  // Check US state codes first
  if (US_STATE_JURISDICTION_MAP[upper]) return US_STATE_JURISDICTION_MAP[upper]
  return COUNTRY_JURISDICTION_MAP[upper] ?? ['US']
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  const { data: org } = profile?.org_id
    ? await admin.from('organizations').select('country_code').eq('id', profile.org_id).single()
    : { data: null }

  // Existing profile or compute fresh
  const { data: existing } = await admin
    .from('user_jurisdiction_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const jurisdictions = resolveJurisdictions(existing?.declared_residency ?? org?.country_code ?? 'US')

  // Always add HIPAA (healthcare platform) and COPPA (if applicable)
  const universal = ['US-HIPAA', 'US-COPPA']
  const allJurisdictions = [...new Set([...jurisdictions, ...universal])]

  // Fetch applicable regulations
  const { data: regs } = await admin
    .from('privacy_regulations')
    .select('id, jurisdiction_code, regulation_name, regulation_short')
    .in('jurisdiction_code', allJurisdictions)
    .eq('is_active', true)

  return NextResponse.json({
    country_code: org?.country_code ?? 'US',
    declared_residency: existing?.declared_residency ?? null,
    jurisdictions: allJurisdictions,
    applicable_regulations: regs ?? [],
    last_evaluated_at: existing?.last_evaluated_at ?? null,
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  const body = await request.json()
  const declaredResidency: string | null = body.declared_residency ?? null

  const { data: org } = profile?.org_id
    ? await admin.from('organizations').select('country_code').eq('id', profile.org_id).single()
    : { data: null }

  const baseCountry = declaredResidency ?? org?.country_code ?? 'US'
  const jurisdictions = resolveJurisdictions(baseCountry)
  const allJurisdictions = [...new Set([...jurisdictions, 'US-HIPAA', 'US-COPPA'])]

  const { data: regs } = await admin
    .from('privacy_regulations')
    .select('id')
    .in('jurisdiction_code', allJurisdictions)
    .eq('is_active', true)

  const regIds = (regs ?? []).map(r => r.id)
  const now = new Date().toISOString()

  await admin
    .from('user_jurisdiction_profiles')
    .upsert({
      user_id: user.id,
      org_id: profile?.org_id ?? null,
      declared_residency: declaredResidency,
      applicable_regulation_ids: regIds,
      highest_protection_level: allJurisdictions.includes('EU') ? 'GDPR' :
        allJurisdictions.includes('UK') ? 'UK GDPR' :
        allJurisdictions.includes('BR') ? 'LGPD' :
        allJurisdictions.includes('US-CA') ? 'CCPA/CPRA' : 'HIPAA',
      last_evaluated_at: now,
    }, { onConflict: 'user_id' })

  // If org admin, optionally update org country_code
  if (body.org_country_code && profile?.org_id) {
    const { data: caller } = await admin
      .from('profiles').select('role').eq('id', user.id).single()
    if (['org_admin', 'super_admin'].includes(caller?.role ?? '')) {
      await admin
        .from('organizations')
        .update({ country_code: body.org_country_code })
        .eq('id', profile.org_id)
    }
  }

  return NextResponse.json({ success: true, jurisdictions: allJurisdictions, regulation_count: regIds.length })
}
