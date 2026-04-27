import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function guardSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return null
  return user
}

export async function GET() {
  const user = await guardSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('grc_controls')
    .select(`
      id, control_id, title, category,
      grc_frameworks (key, name),
      grc_implementations (status)
    `)
    .order('control_id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ controls: data ?? [] })
}

export async function PATCH(request: NextRequest) {
  const user = await guardSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { controlId, status } = await request.json()
  const admin = await createAdminClient()

  const { error } = await admin
    .from('grc_implementations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('control_id', controlId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
