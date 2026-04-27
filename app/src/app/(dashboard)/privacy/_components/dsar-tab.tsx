'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface DsarRequest {
  id: string
  subject_email: string
  request_type: string
  regulation_ref: string | null
  status: string
  received_at: string
  due_at: string
  completed_at: string | null
  assigned_to: string | null
  notes: string | null
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  access:      'Access (Art.15)',
  erasure:     'Erasure (Art.17)',
  portability: 'Portability (Art.20)',
  correction:  'Correction (Art.16)',
  restriction: 'Restriction (Art.18)',
  objection:   'Objection (Art.21)',
}

const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-800',
  completed:   'bg-green-100 text-green-800',
  rejected:    'bg-gray-100 text-gray-600',
  overdue:     'bg-red-100 text-red-800',
}

function DaysUntilDue({ dueAt, status }: { dueAt: string; status: string }) {
  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000)
  if (status === 'completed' || status === 'rejected') return null
  if (days < 0) {
    return <span className="text-xs font-bold text-red-700">{Math.abs(days)}d overdue</span>
  }
  if (days <= 7) {
    return <span className="text-xs font-semibold text-orange-700">{days}d left</span>
  }
  return <span className="text-xs text-muted-foreground">{days}d left</span>
}

export default function DsarTab() {
  const [requests, setRequests] = useState<DsarRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [runningAgent, setRunningAgent] = useState(false)
  const [form, setForm] = useState({
    subject_email: '',
    request_type: 'access',
    regulation_ref: 'GDPR',
    notes: '',
  })

  function load() {
    setLoading(true)
    fetch('/api/privacy/dsar')
      .then(r => r.json())
      .then(d => setRequests(d.requests ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function submitDsar() {
    if (!form.subject_email) return
    setSubmitting(true)
    try {
      await fetch('/api/privacy/dsar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setForm({ subject_email: '', request_type: 'access', regulation_ref: 'GDPR', notes: '' })
      setShowForm(false)
      load()
    } finally {
      setSubmitting(false)
    }
  }

  async function runDsarAgent() {
    setRunningAgent(true)
    try {
      const res = await fetch('/api/agents/dsar/run', { method: 'POST' })
      const data = await res.json()
      alert(`DSARAgent completed: ${data.findingsCount} findings, ${data.pendingApprovals} pending approval.`)
      load()
    } finally {
      setRunningAgent(false)
    }
  }

  const overdueCount = requests.filter(r => r.status === 'overdue').length
  const pendingCount = requests.filter(r => r.status === 'pending' || r.status === 'in_progress').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          {overdueCount > 0 ? (
            <p className="text-sm font-semibold text-red-700">
              {overdueCount} overdue DSAR{overdueCount !== 1 ? 's' : ''} — regulatory exposure risk
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {pendingCount} open · {requests.filter(r => r.status === 'completed').length} completed
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={runningAgent} onClick={runDsarAgent}>
            {runningAgent ? 'Running…' : 'Run DSARAgent'}
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'New DSAR'}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Log New DSAR</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Subject Email *</label>
                <input
                  type="email"
                  className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                  value={form.subject_email}
                  onChange={e => setForm(f => ({ ...f, subject_email: e.target.value }))}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Request Type *</label>
                <select
                  className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                  value={form.request_type}
                  onChange={e => setForm(f => ({ ...f, request_type: e.target.value }))}
                >
                  {Object.entries(REQUEST_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Regulation</label>
                <select
                  className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                  value={form.regulation_ref}
                  onChange={e => setForm(f => ({ ...f, regulation_ref: e.target.value }))}
                >
                  {['GDPR', 'UK GDPR', 'CCPA/CPRA', 'LGPD', 'PIPEDA', 'PDPA-SG', 'APPI'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                <input
                  type="text"
                  className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional context"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              30-day SLA will be set automatically. DSARAgent will monitor and escalate approaching deadlines.
            </p>
            <div className="flex gap-2">
              <Button size="sm" disabled={submitting || !form.subject_email} onClick={submitDsar}>
                {submitting ? 'Creating…' : 'Create DSAR'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading DSARs…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">No DSAR requests on record.</p>
      ) : (
        <div className="space-y-2">
          {requests.map(req => (
            <Card key={req.id} className={req.status === 'overdue' ? 'border-red-300' : ''}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{req.subject_email}</p>
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {REQUEST_TYPE_LABELS[req.request_type] ?? req.request_type}
                      </span>
                      {req.regulation_ref && (
                        <span className="text-xs font-mono text-muted-foreground">{req.regulation_ref}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-muted-foreground">
                        Received {new Date(req.received_at).toLocaleDateString()}
                      </p>
                      <span className="text-muted-foreground">·</span>
                      <p className="text-xs text-muted-foreground">
                        Due {new Date(req.due_at).toLocaleDateString()}
                      </p>
                      <DaysUntilDue dueAt={req.due_at} status={req.status} />
                    </div>
                    {req.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{req.notes}</p>
                    )}
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${STATUS_COLORS[req.status] ?? 'bg-gray-100'}`}>
                    {req.status.replace('_', ' ')}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
