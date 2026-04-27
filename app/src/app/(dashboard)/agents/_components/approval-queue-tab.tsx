'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Decision {
  id: string
  severity: string
  title: string
  description: string | null
  groq_reasoning: string | null
  proposed_action: string | null
  rule_triggered: string | null
  approval_status: string
  created_at: string
  metadata: Record<string, unknown>
  agent_registry: { name: string; agent_type: string } | null
  agent_approval_queue: { due_at: string; resolved_at: string | null }[] | null
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low: 'bg-blue-400 text-white',
  info: 'bg-gray-400 text-white',
}

function hoursUntil(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now()
  if (diff < 0) return 'OVERDUE'
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return '< 1h'
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function ApprovalQueueTab() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [allDecisions, setAllDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [resolving, setResolving] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => { loadDecisions() }, [])

  async function loadDecisions() {
    const [pendingRes, allRes] = await Promise.all([
      fetch('/api/agents/decisions?status=pending').then(r => r.json()),
      fetch('/api/agents/decisions?status=all').then(r => r.json()),
    ])
    setDecisions(pendingRes.decisions ?? [])
    setAllDecisions(allRes.decisions ?? [])
    setLoading(false)
  }

  async function resolve(id: string, action: 'approve' | 'reject') {
    setResolving(id)
    try {
      await fetch(`/api/agents/decisions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      await loadDecisions()
      setExpanded(null)
    } finally {
      setResolving(null)
    }
  }

  const displayList = showAll ? allDecisions : decisions

  if (loading) return <p className="text-sm text-muted-foreground">Loading queue…</p>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {decisions.length} pending · {allDecisions.length} total decisions
        </p>
        <button
          className="text-xs underline text-muted-foreground"
          onClick={() => setShowAll(v => !v)}
        >
          {showAll ? 'Show pending only' : 'Show all decisions'}
        </button>
      </div>

      {displayList.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">
            {showAll ? 'No decisions recorded yet.' : 'No pending approvals. Run an agent to generate findings.'}
          </p>
        </div>
      )}

      {displayList.map(d => {
        const queue = Array.isArray(d.agent_approval_queue)
          ? d.agent_approval_queue[0]
          : d.agent_approval_queue
        const agent = Array.isArray(d.agent_registry) ? d.agent_registry[0] : d.agent_registry
        const isExpanded = expanded === d.id
        const isPending = d.approval_status === 'pending'
        const timeLeft = queue?.due_at ? hoursUntil(queue.due_at) : null

        return (
          <Card
            key={d.id}
            className={`${isPending ? '' : 'opacity-60'} ${d.severity === 'critical' && isPending ? 'border-red-400' : ''}`}
          >
            <CardContent className="p-4">
              <div
                className="flex items-start gap-3 cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : d.id)}
              >
                <span className={`mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${SEVERITY_COLORS[d.severity] ?? ''}`}>
                  {d.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{d.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {agent && (
                      <span className="text-xs text-muted-foreground">{agent.name}</span>
                    )}
                    {timeLeft && isPending && (
                      <span className={`text-xs font-medium ${timeLeft === 'OVERDUE' ? 'text-red-600' : 'text-muted-foreground'}`}>
                        SLA: {timeLeft}
                      </span>
                    )}
                    {!isPending && (
                      <Badge variant="outline" className="text-xs">
                        {d.approval_status}
                      </Badge>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(d.created_at).toLocaleDateString()}
                </span>
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-3 border-t pt-3">
                  {d.description && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Finding</p>
                      <p className="text-sm">{d.description}</p>
                    </div>
                  )}

                  {d.groq_reasoning && (
                    <div className="bg-muted/50 rounded p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">AI Analysis</p>
                      <p className="text-sm italic">{d.groq_reasoning}</p>
                    </div>
                  )}

                  {d.proposed_action && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Proposed Action</p>
                      <p className="text-sm">{d.proposed_action}</p>
                    </div>
                  )}

                  {d.rule_triggered && (
                    <p className="text-xs text-muted-foreground font-mono">
                      Rule: {d.rule_triggered}
                    </p>
                  )}

                  {isPending && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={resolving === d.id}
                        onClick={() => resolve(d.id, 'approve')}
                      >
                        {resolving === d.id ? 'Saving…' : 'Approve & Acknowledge'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolving === d.id}
                        onClick={() => resolve(d.id, 'reject')}
                      >
                        Reject / False Positive
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
