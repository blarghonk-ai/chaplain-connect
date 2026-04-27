import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { runAgent } from '@/lib/agents/runner'
import { dsarAgentLogic } from '@/lib/agents/dsar-agent'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: agent } = await admin
    .from('agent_registry')
    .select('id, status')
    .eq('agent_type', 'dsar')
    .single()

  if (!agent) return NextResponse.json({ error: 'DSARAgent not found' }, { status: 404 })
  if (agent.status === 'disabled') return NextResponse.json({ error: 'Agent is disabled' }, { status: 409 })

  const result = await runAgent(agent.id, 'manual', dsarAgentLogic)
  return NextResponse.json(result)
}
