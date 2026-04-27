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
  const status = searchParams.get('status') // 'open' | 'resolved' | 'dismissed' | all
  const severity = searchParams.get('severity')

  const admin = await createAdminClient()
  let query = admin
    .from('data_violations')
    .select('*, data_locations(table_name, column_name, data_category)')
    .order('detected_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (severity) query = query.eq('severity', severity)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ violations: data ?? [] })
}
