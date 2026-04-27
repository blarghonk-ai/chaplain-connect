import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AgentsClient from './_components/agents-client'

export const metadata = { title: 'Agent Control — Chaplain Connect' }

export default async function AgentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') redirect('/dashboard')

  const admin = await createAdminClient()

  const [agentsRes, pendingRes, recentRunsRes] = await Promise.all([
    admin.from('agent_registry').select('*').order('agent_type'),
    admin.from('agent_decisions').select('id, severity').eq('approval_status', 'pending'),
    admin.from('agent_runs')
      .select('status, findings_count, started_at')
      .gt('started_at', new Date(Date.now() - 7 * 86_400_000).toISOString()),
  ])

  const pending = pendingRes.data ?? []
  const recentRuns = recentRunsRes.data ?? []

  const stats = {
    totalAgents: (agentsRes.data ?? []).length,
    activeAgents: (agentsRes.data ?? []).filter(a => a.status === 'active').length,
    pendingApprovals: pending.length,
    criticalPending: pending.filter(d => d.severity === 'critical').length,
    weeklyRuns: recentRuns.length,
    weeklyFindings: recentRuns.reduce((s, r) => s + (r.findings_count ?? 0), 0),
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agent Control</h1>
        <p className="text-sm text-muted-foreground">
          Autonomous compliance, privacy, security, and data agents — Internal tool
        </p>
      </div>
      <AgentsClient stats={stats} />
    </div>
  )
}
