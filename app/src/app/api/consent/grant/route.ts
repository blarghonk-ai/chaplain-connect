import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = headersList.get('user-agent') ?? null

  const { purpose, consent_type, method, regulation_id, org_id, privacy_policy_version } = await request.json()
  if (!purpose) return NextResponse.json({ error: 'purpose required' }, { status: 400 })

  // Deactivate any existing active consent for this purpose
  await supabase
    .from('consent_records')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('purpose', purpose)
    .eq('is_active', true)

  // Generate a simple consent string (base64 of key data)
  const consentData = { user_id: user.id, purpose, granted_at: new Date().toISOString(), regulation_id }
  const consentString = Buffer.from(JSON.stringify(consentData)).toString('base64')

  const { data, error } = await supabase
    .from('consent_records')
    .insert({
      user_id: user.id,
      org_id: org_id ?? null,
      purpose,
      regulation_id: regulation_id ?? null,
      consent_type: consent_type ?? 'explicit_opt_in',
      method: method ?? 'api',
      ip_address: ip,
      user_agent: userAgent,
      consent_string: consentString,
      privacy_policy_version: privacy_policy_version ?? '1.0',
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ consent: data }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const purposes = searchParams.getAll('purpose')

  let query = supabase
    .from('consent_records')
    .select('purpose, consent_type, granted_at, is_active, regulation_id')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (purposes.length > 0) query = query.in('purpose', purposes)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ consents: data ?? [] })
}
