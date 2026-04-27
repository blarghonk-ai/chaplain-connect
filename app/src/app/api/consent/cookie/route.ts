import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const anonymousId = searchParams.get('anonymous_id')
  if (!anonymousId) return NextResponse.json({ error: 'anonymous_id required' }, { status: 400 })

  const supabase = await createClient()

  // Use admin client since cookie_consent has permissive insert but restricted read
  const { data } = await supabase
    .from('cookie_consent_records')
    .select('necessary, functional, analytics, marketing, personalization, granted_at, jurisdiction')
    .eq('anonymous_id', anonymousId)
    .single()

  return NextResponse.json({ consent: data ?? null })
}

export async function POST(request: NextRequest) {
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const acceptLang = headersList.get('accept-language') ?? ''

  const body = await request.json()
  const { anonymous_id, functional, analytics, marketing, personalization, org_id } = body

  if (!anonymous_id) return NextResponse.json({ error: 'anonymous_id required' }, { status: 400 })

  // Detect jurisdiction from Accept-Language header (simplified)
  // Production: replace with IP geolocation service
  const jurisdiction = detectJurisdiction(acceptLang)

  // Generate consent string
  const consentData = {
    anon: anonymous_id,
    at: new Date().toISOString(),
    fn: functional ?? false,
    an: analytics ?? false,
    mk: marketing ?? false,
    pz: personalization ?? false,
  }
  const consentString = Buffer.from(JSON.stringify(consentData)).toString('base64')

  const supabase = await createClient()

  // Upsert — update if exists, insert if new
  const { data, error } = await supabase
    .from('cookie_consent_records')
    .upsert(
      {
        anonymous_id,
        org_id: org_id ?? null,
        jurisdiction,
        necessary: true,
        functional: functional ?? false,
        analytics: analytics ?? false,
        marketing: marketing ?? false,
        personalization: personalization ?? false,
        consent_string: consentString,
        updated_at: new Date().toISOString(),
        ip_address: ip,
      },
      { onConflict: 'anonymous_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ consent: data })
}

function detectJurisdiction(acceptLang: string): string {
  // Simple heuristic — production should use MaxMind GeoIP or similar
  const lang = acceptLang.toLowerCase()
  if (/^(de|fr|it|es|nl|pl|pt|sv|da|fi|no|cs|hu|ro|bg|hr|sk|sl|et|lv|lt|mt|ga)\b/.test(lang)) return 'EU'
  if (/\ben-gb\b/.test(lang)) return 'UK'
  if (/\ben-ca\b/.test(lang)) return 'CA'
  if (/\bzh\b/.test(lang)) return 'CN'
  if (/\bja\b/.test(lang)) return 'JP'
  if (/\bko\b/.test(lang)) return 'KR'
  if (/\bpt-br\b/.test(lang)) return 'BR'
  return 'US'   // Default — most permissive for cookie opt-out
}
