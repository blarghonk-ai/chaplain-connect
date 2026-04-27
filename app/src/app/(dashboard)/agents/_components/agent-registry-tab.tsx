'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface AgentRun {
  status: string
  findings_count: number
  started_at: string
  completed_at: string | null
}

interface Agent {
  id: string
  name: string
  description: string
  agent_type: string
  status: string
  last_run_at: string | null
  schedule_cron: string | null
  last_run: AgentRun | null
  week_findings: number
  pending_approvals: number
}

const TYPE_ICONS: Record<string, string> = {
  compliance: '📋',
  privacy: '🔒',
  security: '🛡️',
  data: '🔍',
  retention: '🗄️',
  dsar: '📨',
  diagnostics: '🩺',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  disabled: 'bg-gray-100 text-gray-500',
}

export default function AgentRegistryTab() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(d => setAgents(d.agents ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function toggleStatus(agent: Agent) {
    const newStatus = agent.status === 'active' ? 'paused' : 'active'
    await fetch(`/api/agents/${agent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: newStatus } : a))
  }

  async function runAgent(agent: Agent) {
    if (agent.agent_type !== 'compliance') return // only compliance built so far
    setRunning(agent.id)
    try {
      const res = await fetch('/api/agents/compliance/run', { method: 'POST' })
      const data = await res.json()
      // Refresh agents list to show last_run
      const refreshed = await fetch('/api/agents').then(r => r.json())
      setAgents(refreshed.agents ?? [])
      alert(`Run complete: ${data.findingsCount} findings, ${data.pendingApprovals} pending approval`)
    } catch (err) {
      alert(`Run failed: ${err}`)
    } finally {
      setRunning(null)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading agents…</p>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {agents.map(agent => (
        <Card key={agent.id} className={agent.status === 'disabled' ? 'opacity-50' : ''}>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{TYPE_ICONS[agent.agent_type] ?? '🤖'}</span>
                <CardTitle className="text-sm leading-tight">{agent.name}</CardTitle>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[agent.status] ?? ''}`}>
                {agent.status}
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">{agent.description}</p>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                Last run: {agent.last_run_at
                  ? new Date(agent.last_run_at).toLocaleDateString()
                  : 'never'}
              </span>
              {agent.week_findings > 0 && (
                <Badge variant="outline" className="text-xs">
                  {agent.week_findings} findings/week
                </Badge>
              )}
              {agent.pending_approvals > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {agent.pending_approvals} pending
                </Badge>
              )}
            </div>

            {agent.last_run && (
              <div className={`text-xs px-2 py-1 rounded ${
                agent.last_run.status === 'completed' ? 'bg-green-50 text-green-800' :
                agent.last_run.status === 'failed' ? 'bg-red-50 text-red-800' :
                'bg-blue-50 text-blue-800'
              }`}>
                Last: {agent.last_run.status} — {agent.last_run.findings_count} finding{agent.last_run.findings_count !== 1 ? 's' : ''}
              </div>
            )}

            <div className="flex gap-2">
              {agent.agent_type === 'compliance' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={running === agent.id || agent.status !== 'active'}
                  onClick={() => runAgent(agent)}
                >
                  {running === agent.id ? 'Running…' : 'Run Now'}
                </Button>
              )}
              {agent.agent_type !== 'compliance' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs opacity-50"
                  disabled
                  title="This agent will be available in a future phase"
                >
                  Coming soon
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={() => toggleStatus(agent)}
              >
                {agent.status === 'active' ? 'Pause' : 'Resume'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
