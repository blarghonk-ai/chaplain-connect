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
    .from('data_locations')
    .select('*')
    .order('table_name')
    .order('column_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ locations: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await guardSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const {
    data_category, storage_system, table_name, column_name, storage_path,
    description, is_pii, is_encrypted, legal_basis, retention_days, notes, org_id
  } = body

  if (!table_name?.trim() || !data_category) {
    return NextResponse.json({ error: 'table_name and data_category required' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('data_locations')
    .insert({
      org_id: org_id ?? null,
      data_category,
      storage_system: storage_system ?? 'postgres',
      table_name,
      column_name: column_name ?? null,
      storage_path: storage_path ?? null,
      description,
      is_pii: is_pii ?? true,
      is_encrypted: is_encrypted ?? false,
      legal_basis: legal_basis ?? 'legitimate_interests',
      retention_days: retention_days ?? 365,
      notes,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ location: data }, { status: 201 })
}
