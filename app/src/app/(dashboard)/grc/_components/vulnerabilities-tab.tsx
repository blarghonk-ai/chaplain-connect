'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Vuln = {
  id: string
  title: string
  severity: string
  status: string
  scanner: string | null
  cve_id: string | null
  cvss_score: number | null
  affected_package: string | null
  fixed_version: string | null
  file_path: string | null
  source_run_url: string | null
  found_at: string
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high:     'bg-orange-500 text-white',
  medium:   'bg-yellow-500 text-black',
  low:      'bg-blue-400 text-white',
  info:     'bg-gray-400 text-white',
}

export default function VulnerabilitiesTab() {
  const [vulns, setVulns] = useState<Vuln[]>([])
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('open')

  useEffect(() => {
    fetch('/api/grc/vulnerabilities')
      .then(r => r.json())
      .then(d => { setVulns(d.vulnerabilities ?? []); setLoading(false) })
  }, [])

  const filtered = vulns.filter(v =>
    (severityFilter === 'all' || v.severity === severityFilter) &&
    (statusFilter === 'all' || v.status === statusFilter)
  )

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/grc/vulnerabilities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setVulns(prev => prev.map(v => v.id === id ? { ...v, status } : v))
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading vulnerabilities…</p>

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-center">
        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
          className="h-8 rounded border border-input bg-background px-2 text-sm">
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-8 rounded border border-input bg-background px-2 text-sm">
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="in_remediation">In remediation</option>
          <option value="resolved">Resolved</option>
          <option value="accepted">Accepted</option>
          <option value="false_positive">False positive</option>
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} findings</span>
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {vulns.length === 0
              ? 'No vulnerabilities found. CI/CD scans will populate this automatically.'
              : 'No findings match the selected filters.'}
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map(v => (
          <Card key={v.id}>
            <CardContent className="py-3">
              <div className="flex items-start gap-3">
                <Badge className={`text-xs shrink-0 ${SEVERITY_COLORS[v.severity] ?? ''}`}>
                  {v.severity.toUpperCase()}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{v.title}</p>
                    {v.cve_id && <span className="text-xs font-mono text-muted-foreground">{v.cve_id}</span>}
                    {v.cvss_score && <span className="text-xs text-muted-foreground">CVSS {v.cvss_score}</span>}
                  </div>
                  <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    {v.scanner && <span>Scanner: {v.scanner}</span>}
                    {v.affected_package && <span>Package: {v.affected_package}</span>}
                    {v.fixed_version && <span className="text-green-600">Fix: {v.fixed_version}</span>}
                    {v.file_path && <span>File: {v.file_path}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">
                      Found {new Date(v.found_at).toLocaleDateString()}
                    </span>
                    {v.source_run_url && (
                      <a href={v.source_run_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline">
                        View CI run →
                      </a>
                    )}
                  </div>
                </div>
                <select
                  value={v.status}
                  onChange={e => updateStatus(v.id, e.target.value)}
                  className="text-xs rounded border border-input bg-background px-2 py-1 shrink-0"
                >
                  <option value="open">Open</option>
                  <option value="in_remediation">In remediation</option>
                  <option value="resolved">Resolved</option>
                  <option value="accepted">Accepted</option>
                  <option value="false_positive">False positive</option>
                </select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
