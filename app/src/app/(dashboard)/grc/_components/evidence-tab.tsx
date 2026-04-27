'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Evidence = {
  id: string
  title: string
  description: string | null
  source: string
  source_url: string | null
  collected_at: string
  hash: string | null
  grc_controls: { control_id: string } | null
}

const SOURCE_COLORS: Record<string, string> = {
  github:   'bg-gray-900 text-white',
  trivy:    'bg-red-100 text-red-800',
  gitleaks: 'bg-purple-100 text-purple-800',
  semgrep:  'bg-blue-100 text-blue-800',
  codeql:   'bg-indigo-100 text-indigo-800',
  checkov:  'bg-teal-100 text-teal-800',
  grype:    'bg-orange-100 text-orange-800',
  supabase: 'bg-green-100 text-green-800',
  vercel:   'bg-black text-white',
  stripe:   'bg-violet-100 text-violet-800',
  manual:   'bg-muted text-muted-foreground',
}

export default function EvidenceTab() {
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(true)
  const [sourceFilter, setSourceFilter] = useState('all')

  useEffect(() => {
    fetch('/api/grc/evidence')
      .then(r => r.json())
      .then(d => { setEvidence(d.evidence ?? []); setLoading(false) })
  }, [])

  const filtered = evidence.filter(e => sourceFilter === 'all' || e.source === sourceFilter)

  if (loading) return <p className="text-sm text-muted-foreground">Loading evidence…</p>

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center flex-wrap">
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
          className="h-8 rounded border border-input bg-background px-2 text-sm">
          <option value="all">All sources</option>
          <option value="github">GitHub</option>
          <option value="trivy">Trivy</option>
          <option value="gitleaks">Gitleaks</option>
          <option value="semgrep">Semgrep</option>
          <option value="codeql">CodeQL</option>
          <option value="checkov">Checkov</option>
          <option value="grype">Grype/SBOM</option>
          <option value="supabase">Supabase</option>
          <option value="vercel">Vercel</option>
          <option value="manual">Manual</option>
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} evidence items</span>
        <span className="text-xs text-muted-foreground ml-auto">
          Evidence is append-only and tamper-evident (SHA-256 hashed)
        </span>
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <p>No evidence collected yet.</p>
            <p className="mt-1">Evidence is automatically added by CI/CD scans and can be collected manually via the API.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map(e => {
          const control = Array.isArray(e.grc_controls) ? e.grc_controls[0] : e.grc_controls
          return (
            <Card key={e.id}>
              <CardContent className="py-3">
                <div className="flex items-start gap-3">
                  <Badge className={`text-xs shrink-0 ${SOURCE_COLORS[e.source] ?? ''}`}>
                    {e.source}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{e.title}</p>
                      {control && (
                        <span className="text-xs font-mono text-muted-foreground">→ {control.control_id}</span>
                      )}
                    </div>
                    {e.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{new Date(e.collected_at).toLocaleString()}</span>
                      {e.hash && (
                        <span className="font-mono truncate max-w-[200px]" title={e.hash}>
                          SHA: {e.hash.slice(0, 12)}…
                        </span>
                      )}
                      {e.source_url && (
                        <a href={e.source_url} target="_blank" rel="noopener noreferrer"
                          className="text-primary hover:underline">
                          View source →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
