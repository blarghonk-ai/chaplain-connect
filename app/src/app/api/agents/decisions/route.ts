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
  const status = searchParams.get('status') ?? 'pending'
  const agentId = searchParams.get('agent_id')

  const admin = await createAdminClient()
  let query = admin
    .from('agent_decisions')
    .select(`
      *,
      agent_registry (name, agent_type),
      agent_approval_queue (due_at, resolved_at)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status !== 'all') query = query.eq('approval_status', status)
  if (agentId) query = query.eq('agent_id', agentId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ decisions: data ?? [] })
}
