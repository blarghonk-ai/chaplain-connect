'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Violation {
  id: string
  violation_type: string
  severity: string
  table_name: string | null
  column_name: string | null
  description: string
  status: string
  detected_at: string
  resolved_at: string | null
  resolution_notes: string | null
  metadata: Record<string, unknown>
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-900 border-red-200',
  high:     'bg-orange-100 text-orange-900 border-orange-200',
  medium:   'bg-yellow-100 text-yellow-900 border-yellow-200',
  low:      'bg-blue-100 text-blue-900 border-blue-200',
  info:     'bg-gray-100 text-gray-700 border-gray-200',
}

const TYPE_LABELS: Record<string, string> = {
  cvv_column:          'CVV Column',
  pan_column:          'PAN Column',
  ssn_column:          'SSN Column',
  unencrypted_pii:     'Unencrypted PII',
  missing_legal_basis: 'Missing Legal Basis',
  pii_in_logs:         'PII in Logs',
  excessive_retention: 'Excessive Retention',
}

const STATUS_COLORS: Record<string, string> = {
  open:           'bg-red-100 text-red-800',
  in_remediation: 'bg-yellow-100 text-yellow-800',
  resolved:       'bg-green-100 text-green-800',
  dismissed:      'bg-gray-100 text-gray-600',
}

export default function ViolationsTab() {
  const [violations, setViolations] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)
  const [runningAgent, setRunningAgent] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open')

  function load() {
    const qs = filter === 'all' ? '' : `?status=${filter}`
    setLoading(true)
    fetch(`/api/privacy/violations${qs}`)
      .then(r => r.json())
      .then(d => setViolations(d.violations ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function runDataAgent() {
    setRunningAgent(true)
    try {
      const res = await fetch('/api/agents/data/run', { method: 'POST' })
      const data = await res.json()
      alert(`DataAgent completed: ${data.findingsCount} findings, ${data.pendingApprovals} pending approval.`)
      load()
    } finally {
      setRunningAgent(false)
    }
  }

  async function updateViolation(id: string, status: string, resolution_notes?: string) {
    setUpdating(id)
    try {
      await fetch(`/api/privacy/violations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolution_notes }),
      })
      load()
      setSelected(null)
    } finally {
      setUpdating(null)
    }
  }

  const criticalCount = violations.filter(v => v.severity === 'critical' && v.status === 'open').length
  const highCount = violations.filter(v => v.severity === 'high' && v.status === 'open').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          {criticalCount > 0 && (
            <p className="text-sm font-semibold text-red-700">
              {criticalCount} critical violation{criticalCount !== 1 ? 's' : ''} require immediate action
            </p>
          )}
          {criticalCount === 0 && highCount > 0 && (
            <p className="text-sm font-semibold text-orange-700">
              {highCount} high-severity violation{highCount !== 1 ? 's' : ''} open
            </p>
          )}
          {criticalCount === 0 && highCount === 0 && (
            <p className="text-sm text-muted-foreground">
              {violations.length} violation{violations.length !== 1 ? 's' : ''} — no critical issues
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden text-xs">
            {(['open', 'all', 'resolved'] as const).map(f => (
              <button
                key={f}
                className={`px-3 py-1.5 capitalize ${filter === f ? 'bg-foreground text-background' : 'bg-background hover:bg-muted'}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" disabled={runningAgent} onClick={runDataAgent}>
            {runningAgent ? 'Scanning…' : 'Run DataAgent'}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading violations…</p>
      ) : violations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No violations found{filter !== 'all' ? ` with status "${filter}"` : ''}.</p>
      ) : (
        <div className="space-y-2">
          {violations.map(v => (
            <Card
              key={v.id}
              className={`border cursor-pointer transition-colors ${SEVERITY_COLORS[v.severity] ?? ''} ${selected === v.id ? 'ring-1 ring-foreground/30' : ''}`}
              onClick={() => setSelected(selected === v.id ? null : v.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wide">{v.severity}</span>
                      <span className="text-xs font-mono bg-black/5 px-1.5 py-0.5 rounded">
                        {TYPE_LABELS[v.violation_type] ?? v.violation_type}
                      </span>
                      {v.table_name && (
                        <span className="text-xs font-mono">
                          {v.table_name}{v.column_name ? `.${v.column_name}` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1 opacity-80">
                      Detected {new Date(v.detected_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${STATUS_COLORS[v.status] ?? ''}`}>
                    {v.status.replace('_', ' ')}
                  </span>
                </div>

                {selected === v.id && (
                  <div className="mt-3 pt-3 border-t border-current/10 space-y-3">
                    <p className="text-xs leading-relaxed">{v.description}</p>

                    {v.status === 'open' && (
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          disabled={updating === v.id}
                          onClick={e => { e.stopPropagation(); updateViolation(v.id, 'in_remediation') }}
                        >
                          Mark In Remediation
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          disabled={updating === v.id}
                          onClick={e => { e.stopPropagation(); updateViolation(v.id, 'resolved', 'Resolved by super_admin review') }}
                        >
                          Mark Resolved
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs opacity-60"
                          disabled={updating === v.id}
                          onClick={e => { e.stopPropagation(); updateViolation(v.id, 'dismissed', 'False positive — dismissed') }}
                        >
                          Dismiss
                        </Button>
                      </div>
                    )}

                    {v.status === 'in_remediation' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        disabled={updating === v.id}
                        onClick={e => { e.stopPropagation(); updateViolation(v.id, 'resolved', 'Remediation completed') }}
                      >
                        Mark Resolved
                      </Button>
                    )}

                    {v.resolution_notes && (
                      <p className="text-xs italic opacity-70 border-t border-current/10 pt-2">{v.resolution_notes}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
