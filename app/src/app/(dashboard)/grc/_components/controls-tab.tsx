'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

type Control = {
  id: string
  control_id: string
  title: string
  category: string | null
  grc_frameworks: { name: string; key: string } | null
  grc_implementations: { status: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  not_started:       'bg-muted text-muted-foreground',
  in_progress:       'bg-blue-100 text-blue-800',
  implemented:       'bg-yellow-100 text-yellow-800',
  evidence_collected:'bg-green-100 text-green-800',
  audited:           'bg-green-600 text-white',
  not_applicable:    'bg-gray-100 text-gray-500',
}

export default function ControlsTab() {
  const [controls, setControls] = useState<Control[]>([])
  const [loading, setLoading] = useState(true)
  const [frameworkFilter, setFrameworkFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetch('/api/grc/controls')
      .then(r => r.json())
      .then(d => { setControls(d.controls ?? []); setLoading(false) })
  }, [])

  const frameworks = [...new Set(controls.map(c => {
    const f = Array.isArray(c.grc_frameworks) ? c.grc_frameworks[0] : c.grc_frameworks
    return f?.key ?? ''
  }).filter(Boolean))]

  const filtered = controls.filter(c => {
    const f = Array.isArray(c.grc_frameworks) ? c.grc_frameworks[0] : c.grc_frameworks
    const impl = Array.isArray(c.grc_implementations) ? c.grc_implementations[0] : c.grc_implementations
    const matchFramework = frameworkFilter === 'all' || f?.key === frameworkFilter
    const matchStatus = statusFilter === 'all' || (impl?.status ?? 'not_started') === statusFilter
    return matchFramework && matchStatus
  })

  async function updateStatus(controlId: string, implementationId: string | undefined, status: string) {
    await fetch('/api/grc/controls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ controlId, status }),
    })
    setControls(prev => prev.map(c => {
      if (c.id !== controlId) return c
      const impl = Array.isArray(c.grc_implementations) ? c.grc_implementations[0] : c.grc_implementations
      return { ...c, grc_implementations: impl ? { ...impl, status } : { status } }
    }))
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading controls…</p>

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={frameworkFilter}
          onChange={e => setFrameworkFilter(e.target.value)}
          className="h-8 rounded border border-input bg-background px-2 text-sm"
        >
          <option value="all">All frameworks</option>
          {frameworks.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-8 rounded border border-input bg-background px-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="implemented">Implemented</option>
          <option value="evidence_collected">Evidence collected</option>
          <option value="audited">Audited</option>
          <option value="not_applicable">Not applicable</option>
        </select>
        <span className="text-xs text-muted-foreground self-center">{filtered.length} controls</span>
      </div>

      {/* Controls list */}
      <div className="space-y-2">
        {filtered.map(c => {
          const f = Array.isArray(c.grc_frameworks) ? c.grc_frameworks[0] : c.grc_frameworks
          const impl = Array.isArray(c.grc_implementations) ? c.grc_implementations[0] : c.grc_implementations
          const status = impl?.status ?? 'not_started'

          return (
            <Card key={c.id}>
              <CardContent className="py-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold">{c.control_id}</span>
                      {f && <Badge variant="outline" className="text-xs uppercase">{f.key}</Badge>}
                      {c.category && <span className="text-xs text-muted-foreground">{c.category}</span>}
                    </div>
                    <p className="text-sm mt-0.5">{c.title}</p>
                  </div>
                  <select
                    value={status}
                    onChange={e => updateStatus(c.id, impl?.status, e.target.value)}
                    className={`text-xs rounded px-2 py-1 border-0 font-medium ${STATUS_COLORS[status] ?? ''}`}
                  >
                    <option value="not_started">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="implemented">Implemented</option>
                    <option value="evidence_collected">Evidence collected</option>
                    <option value="audited">Audited</option>
                    <option value="not_applicable">N/A</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No controls match the selected filters.</p>
        )}
      </div>
    </div>
  )
}
