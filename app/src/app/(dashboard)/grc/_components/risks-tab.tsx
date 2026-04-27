'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

type Risk = {
  id: string
  title: string
  description: string | null
  category: string | null
  likelihood: number
  impact: number
  risk_score: number
  treatment: string | null
  status: string
  created_at: string
}

function scoreColor(score: number) {
  if (score >= 20) return 'text-red-600 font-bold'
  if (score >= 15) return 'text-orange-600 font-bold'
  if (score >= 10) return 'text-yellow-600'
  return 'text-green-600'
}

export default function RisksTab() {
  const [risks, setRisks] = useState<Risk[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  // New risk form
  const [form, setForm] = useState({
    title: '', description: '', category: 'security',
    likelihood: 3, impact: 3, treatment: 'mitigate',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/grc/risks')
      .then(r => r.json())
      .then(d => { setRisks(d.risks ?? []); setLoading(false) })
  }, [])

  async function createRisk() {
    setSaving(true)
    const res = await fetch('/api/grc/risks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.risk) {
      setRisks(prev => [data.risk, ...prev])
      setShowNew(false)
      setForm({ title: '', description: '', category: 'security', likelihood: 3, impact: 3, treatment: 'mitigate' })
    }
    setSaving(false)
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading risk register…</p>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">Risk score = Likelihood (1-5) × Impact (1-5). Score ≥15 = high risk.</p>
        <Button size="sm" onClick={() => setShowNew(v => !v)}>+ Add risk</Button>
      </div>

      {showNew && (
        <Card className="border-primary/30">
          <CardContent className="pt-4 space-y-3">
            <Input placeholder="Risk title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Input placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full h-9 rounded border border-input bg-background px-2 text-sm mt-1">
                  <option value="security">Security</option>
                  <option value="compliance">Compliance</option>
                  <option value="operational">Operational</option>
                  <option value="financial">Financial</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Likelihood (1-5)</label>
                <input type="number" min={1} max={5} value={form.likelihood}
                  onChange={e => setForm(f => ({ ...f, likelihood: Number(e.target.value) }))}
                  className="w-full h-9 rounded border border-input bg-background px-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Impact (1-5)</label>
                <input type="number" min={1} max={5} value={form.impact}
                  onChange={e => setForm(f => ({ ...f, impact: Number(e.target.value) }))}
                  className="w-full h-9 rounded border border-input bg-background px-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Treatment</label>
                <select value={form.treatment} onChange={e => setForm(f => ({ ...f, treatment: e.target.value }))}
                  className="w-full h-9 rounded border border-input bg-background px-2 text-sm mt-1">
                  <option value="mitigate">Mitigate</option>
                  <option value="accept">Accept</option>
                  <option value="transfer">Transfer</option>
                  <option value="avoid">Avoid</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Button size="sm" onClick={createRisk} disabled={saving || !form.title}>
                {saving ? 'Saving…' : 'Add to register'}
              </Button>
              <span className="text-sm text-muted-foreground">
                Score: <span className={scoreColor(form.likelihood * form.impact)}>{form.likelihood * form.impact}</span>/25
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {risks.length === 0 && !showNew && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No risks in register yet. Add your first risk above.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {risks
          .sort((a, b) => b.risk_score - a.risk_score)
          .map(r => (
            <Card key={r.id}>
              <CardContent className="py-3">
                <div className="flex items-start gap-3">
                  <div className={`text-2xl font-bold w-10 text-center shrink-0 ${scoreColor(r.risk_score)}`}>
                    {r.risk_score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{r.title}</p>
                      {r.category && <Badge variant="outline" className="text-xs capitalize">{r.category}</Badge>}
                      {r.treatment && <Badge variant="secondary" className="text-xs capitalize">{r.treatment}</Badge>}
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      L:{r.likelihood} × I:{r.impact} · Added {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={r.status === 'open' ? 'default' : 'secondary'} className="capitalize shrink-0">
                    {r.status.replace('_', ' ')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  )
}
