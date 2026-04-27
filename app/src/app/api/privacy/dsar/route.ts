import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function guardSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'super_admin' ? user : null
}

export async function GET(request: NextRequest) {
  const user = await guardSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const admin = await createAdminClient()
  let query = admin
    .from('dsar_requests')
    .select('*')
    .order('due_at', { ascending: true })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await guardSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { subject_email, request_type, regulation_ref, org_id, subject_user_id, notes } = body

  if (!subject_email || !request_type) {
    return NextResponse.json({ error: 'subject_email and request_type required' }, { status: 400 })
  }

  const validTypes = ['access', 'erasure', 'portability', 'correction', 'restriction', 'objection']
  if (!validTypes.includes(request_type)) {
    return NextResponse.json({ error: `request_type must be one of: ${validTypes.join(', ')}` }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('dsar_requests')
    .insert({
      subject_email,
      request_type,
      regulation_ref: regulation_ref ?? 'GDPR',
      org_id: org_id ?? null,
      subject_user_id: subject_user_id ?? null,
      notes: notes ?? null,
      status: 'pending',
      due_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ request: data }, { status: 201 })
}
