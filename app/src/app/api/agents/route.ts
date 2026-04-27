import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
  const { data: agents, error } = await admin
    .from('agent_registry')
    .select('*')
    .order('agent_type')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with recent run stats
  const agentIds = (agents ?? []).map(a => a.id)
  const { data: recentRuns } = await admin
    .from('agent_runs')
    .select('agent_id, status, findings_count, started_at, completed_at')
    .in('agent_id', agentIds)
    .order('started_at', { ascending: false })
    .limit(agentIds.length * 5)

  const { data: pendingDecisions } = await admin
    .from('agent_decisions')
    .select('agent_id')
    .eq('approval_status', 'pending')

  const pendingByAgent = (pendingDecisions ?? []).reduce<Record<string, number>>((acc, d) => {
    acc[d.agent_id] = (acc[d.agent_id] ?? 0) + 1
    return acc
  }, {})

  const enriched = (agents ?? []).map(agent => {
    const runs = (recentRuns ?? []).filter(r => r.agent_id === agent.id)
    const lastRun = runs[0] ?? null
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const weekFindings = runs
      .filter(r => r.started_at > weekAgo)
      .reduce((sum, r) => sum + (r.findings_count ?? 0), 0)

    return {
      ...agent,
      last_run: lastRun,
      week_findings: weekFindings,
      pending_approvals: pendingByAgent[agent.id] ?? 0,
    }
  })

  return NextResponse.json({ agents: enriched })
}
