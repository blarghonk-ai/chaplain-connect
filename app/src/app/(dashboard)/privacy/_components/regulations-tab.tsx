'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface RegScore {
  regulation_short: string
  jurisdiction_name: string
  score: number
  gaps: string[]
  applies_to_us: boolean
}

interface Regulation {
  id: string
  jurisdiction_code: string
  jurisdiction_name: string
  regulation_short: string
  regulation_name: string
  effective_date: string | null
  consent_required: boolean
  opt_out_model: boolean
  right_to_erasure: boolean
  dpia_required: boolean
  ropa_required: boolean
  breach_hours: number | null
  cookie_consent_req: boolean
  applies_to_us: boolean
  compliance_notes: string | null
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold w-9 text-right ${score >= 80 ? 'text-green-700' : score >= 50 ? 'text-yellow-700' : 'text-red-700'}`}>
        {score}%
      </span>
    </div>
  )
}

export default function RegulationsTab() {
  const [regulations, setRegulations] = useState<Regulation[]>([])
  const [scores, setScores] = useState<RegScore[]>([])
  const [loading, setLoading] = useState(true)
  const [runningAgent, setRunningAgent] = useState(false)
  const [selected, setSelected] = useState<Regulation | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/privacy/regulations').then(r => r.json()),
      fetch('/api/privacy/compliance-score').then(r => r.json()),
    ]).then(([regsData, scoresData]) => {
      setRegulations(regsData.regulations ?? [])
      setScores(scoresData.scores ?? [])
    }).finally(() => setLoading(false))
  }, [])

  async function runPrivacyAgent() {
    setRunningAgent(true)
    try {
      const res = await fetch('/api/agents/privacy/run', { method: 'POST' })
      const data = await res.json()
      alert(`PrivacyAgent completed: ${data.findingsCount} findings, ${data.pendingApprovals} pending approval. Check the Agents dashboard for details.`)
    } finally {
      setRunningAgent(false)
    }
  }

  const scoreMap = Object.fromEntries(scores.map(s => [s.regulation_short, s]))
  const applicableRegs = regulations.filter(r => r.applies_to_us)
  const otherRegs = regulations.filter(r => !r.applies_to_us)

  if (loading) return <p className="text-sm text-muted-foreground">Loading regulations…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {regulations.length} regulations tracked · {applicableRegs.length} applicable to Chaplain Connect
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={runningAgent} onClick={runPrivacyAgent}>
          {runningAgent ? 'Running PrivacyAgent…' : 'Run PrivacyAgent'}
        </Button>
      </div>

      {/* Applicable regulations — scored */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Applicable to Chaplain Connect</h3>
        <div className="space-y-2">
          {applicableRegs.map(reg => {
            const s = scoreMap[reg.regulation_short]
            return (
              <Card
                key={reg.id}
                className={`cursor-pointer hover:border-foreground/30 transition-colors ${selected?.id === reg.id ? 'border-foreground/50' : ''}`}
                onClick={() => setSelected(selected?.id === reg.id ? null : reg)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-16 shrink-0">
                      <span className="text-xs font-bold font-mono">{reg.regulation_short}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{reg.jurisdiction_name}</p>
                      {s && <ScoreBar score={s.score} />}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {reg.consent_required && !reg.opt_out_model && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">opt-in</span>
                      )}
                      {reg.opt_out_model && (
                        <span className="text-xs bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">opt-out</span>
                      )}
                      {reg.dpia_required && (
                        <span className="text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded">DPIA</span>
                      )}
                      {reg.breach_hours && (
                        <span className="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded">{reg.breach_hours}h breach</span>
                      )}
                    </div>
                  </div>

                  {selected?.id === reg.id && s && s.gaps.length > 0 && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <p className="text-xs font-medium">Open gaps:</p>
                      {s.gaps.map((gap, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span className="text-red-500 mt-0.5 shrink-0">✕</span>
                          <span>{gap}</span>
                        </div>
                      ))}
                      {reg.compliance_notes && (
                        <p className="text-xs text-muted-foreground italic border-t pt-2 mt-2">{reg.compliance_notes}</p>
                      )}
                    </div>
                  )}

                  {selected?.id === reg.id && s && s.gaps.length === 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-green-700">No gaps detected — compliance posture is good.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Other regulations — monitored but not yet applicable */}
      {otherRegs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
            Monitored (not yet applicable)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {otherRegs.map(reg => (
              <Card key={reg.id} className="opacity-60">
                <CardContent className="p-2">
                  <p className="text-xs font-bold font-mono">{reg.regulation_short}</p>
                  <p className="text-xs text-muted-foreground truncate">{reg.jurisdiction_code}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
