import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function guardSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'super_admin' ? user : null
}

export async function GET() {
  const user = await guardSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('retention_policies')
    .select('*')
    .order('data_category')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ policies: data ?? [] })
}

export async function PATCH(request: NextRequest) {
  const user = await guardSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data_category, retention_days, notes } = await request.json()
  if (!data_category || !retention_days) {
    return NextResponse.json({ error: 'data_category and retention_days required' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('retention_policies')
    .update({ retention_days, notes, updated_at: new Date().toISOString() })
    .eq('data_category', data_category)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ policy: data })
}
