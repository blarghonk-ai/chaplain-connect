'use client'

import { useEffect, useState } from 'react'

interface Run {
  id: string
  status: string
  findings_count: number
  actions_taken: number
  triggered_by: string
  started_at: string
  completed_at: string | null
  summary: string | null
  error: string | null
  agent_registry: { name: string; agent_type: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'text-green-700 bg-green-50',
  failed: 'text-red-700 bg-red-50',
  running: 'text-blue-700 bg-blue-50',
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

function durationMs(start: string, end: string | null): string {
  if (!end) return 'running…'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

export default function RunHistoryTab() {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/agents/runs')
      .then(r => r.json())
      .then(d => setRuns(d.runs ?? []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-muted-foreground">Loading run history…</p>

  if (runs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No runs recorded yet.</p>
        <p className="text-xs mt-1">Run an agent manually from the Agents tab to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-4 px-3 py-1.5 text-xs font-medium text-muted-foreground border-b">
        <span>Agent</span>
        <span>Summary</span>
        <span>Trigger</span>
        <span>Duration</span>
        <span>Findings</span>
        <span>Started</span>
      </div>
      {runs.map(run => {
        const agent = Array.isArray(run.agent_registry) ? run.agent_registry[0] : run.agent_registry
        return (
          <div
            key={run.id}
            className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-4 px-3 py-2 text-sm hover:bg-muted/30 rounded items-center"
          >
            <span className="text-base" title={agent?.name ?? ''}>
              {TYPE_ICONS[agent?.agent_type ?? ''] ?? '🤖'}
            </span>
            <div className="min-w-0">
              <span className={`text-xs px-1.5 py-0.5 rounded mr-2 ${STATUS_COLORS[run.status] ?? ''}`}>
                {run.status}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {run.error
                  ? `Error: ${run.error.slice(0, 80)}`
                  : run.summary ?? `${agent?.name} run`}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{run.triggered_by}</span>
            <span className="text-xs text-muted-foreground font-mono">
              {durationMs(run.started_at, run.completed_at)}
            </span>
            <span className="text-xs font-medium">{run.findings_count ?? 0}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(run.started_at).toLocaleString()}
            </span>
          </div>
        )
      })}
    </div>
  )
}
