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
  const agentId = searchParams.get('agent_id')

  const admin = await createAdminClient()
  let query = admin
    .from('agent_runs')
    .select('*, agent_registry (name, agent_type)')
    .order('started_at', { ascending: false })
    .limit(100)

  if (agentId) query = query.eq('agent_id', agentId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ runs: data ?? [] })
}
