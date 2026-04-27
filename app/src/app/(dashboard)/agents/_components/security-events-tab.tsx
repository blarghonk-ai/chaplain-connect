'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface SecurityEvent {
  id: string
  event_type: string
  severity: string
  subject_email: string | null
  description: string
  resolved: boolean
  resolved_at: string | null
  created_at: string
  metadata: Record<string, unknown>
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'border-red-300 bg-red-50',
  high:     'border-orange-300 bg-orange-50',
  medium:   'border-yellow-300 bg-yellow-50',
  low:      'border-blue-200 bg-blue-50',
  info:     'border-gray-200 bg-gray-50',
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-900',
  high:     'bg-orange-100 text-orange-900',
  medium:   'bg-yellow-100 text-yellow-900',
  low:      'bg-blue-100 text-blue-900',
  info:     'bg-gray-100 text-gray-700',
}

const TYPE_LABELS: Record<string, string> = {
  new_super_admin:      'New Super Admin',
  mfa_not_configured:   'MFA Not Configured',
  dormant_admin:        'Dormant Admin',
  privilege_escalation: 'Privilege Escalation',
  unowned_controls:     'Unowned Controls',
}

const TYPE_ICONS: Record<string, string> = {
  new_super_admin:      '👤',
  mfa_not_configured:   '🔓',
  dormant_admin:        '💤',
  privilege_escalation: '⚠️',
  unowned_controls:     '📋',
}

export default function SecurityEventsTab() {
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [runningAgent, setRunningAgent] = useState(false)
  const [resolving, setResolving] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)

  function load() {
    setLoading(true)
    fetch(`/api/security/events?resolved=${showResolved}`)
      .then(r => r.json())
      .then(d => setEvents(d.events ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [showResolved]) // eslint-disable-line react-hooks/exhaustive-deps

  async function runSecurityAgent() {
    setRunningAgent(true)
    try {
      const res = await fetch('/api/agents/security/run', { method: 'POST' })
      const data = await res.json()
      alert(`SecurityAgent completed: ${data.findingsCount} findings, ${data.pendingApprovals} pending approval.`)
      load()
    } finally {
      setRunningAgent(false)
    }
  }

  async function resolveEvent(id: string) {
    setResolving(id)
    try {
      await fetch('/api/security/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      load()
    } finally {
      setResolving(null)
    }
  }

  const criticalCount = events.filter(e => e.severity === 'critical').length
  const highCount = events.filter(e => e.severity === 'high').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          {criticalCount > 0 ? (
            <p className="text-sm font-semibold text-red-700">
              {criticalCount} critical security event{criticalCount !== 1 ? 's' : ''} require immediate review
            </p>
          ) : highCount > 0 ? (
            <p className="text-sm font-semibold text-orange-700">
              {highCount} high-severity event{highCount !== 1 ? 's' : ''} need attention
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {events.length} {showResolved ? 'resolved' : 'open'} event{events.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-xs underline text-muted-foreground"
            onClick={() => setShowResolved(!showResolved)}
          >
            {showResolved ? 'Show open' : 'Show resolved'}
          </button>
          <Button size="sm" variant="outline" disabled={runningAgent} onClick={runSecurityAgent}>
            {runningAgent ? 'Scanning…' : 'Run SecurityAgent'}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading security events…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No {showResolved ? 'resolved' : 'open'} security events. Run SecurityAgent to scan for issues.
        </p>
      ) : (
        <div className="space-y-2">
          {events.map(event => (
            <Card key={event.id} className={`border ${SEVERITY_COLORS[event.severity] ?? ''} ${event.resolved ? 'opacity-60' : ''}`}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{TYPE_ICONS[event.event_type] ?? '🔒'}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${SEVERITY_BADGE[event.severity] ?? ''}`}>
                        {event.severity.toUpperCase()}
                      </span>
                      <span className="text-xs font-medium">
                        {TYPE_LABELS[event.event_type] ?? event.event_type.replace(/_/g, ' ')}
                      </span>
                      {event.subject_email && (
                        <span className="text-xs font-mono text-muted-foreground">{event.subject_email}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {event.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Detected {new Date(event.created_at).toLocaleString()}
                      {event.resolved_at && ` · Resolved ${new Date(event.resolved_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  {!event.resolved && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs shrink-0"
                      disabled={resolving === event.id}
                      onClick={() => resolveEvent(event.id)}
                    >
                      {resolving === event.id ? 'Resolving…' : 'Resolve'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
