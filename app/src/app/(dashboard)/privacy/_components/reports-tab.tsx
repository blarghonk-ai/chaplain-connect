'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Props {
  totalLocations: number
}

export default function ReportsTab({ totalLocations }: Props) {
  const [generating, setGenerating] = useState<string | null>(null)

  async function generateReport(type: string) {
    setGenerating(type)

    try {
      if (type === 'data-map') {
        // Fetch all data locations and export as JSON
        const res = await fetch('/api/privacy/data-locations')
        const data = await res.json()
        downloadJson(data.locations, 'chaplain-connect-data-map.json')
      } else if (type === 'ropa') {
        const res = await fetch('/api/privacy/assessments')
        const data = await res.json()
        const ropa = data.assessments?.filter((a: { assessment_type: string }) => a.assessment_type === 'ropa') ?? []
        downloadJson(ropa, 'chaplain-connect-ropa-article30.json')
      } else if (type === 'assessments') {
        const res = await fetch('/api/privacy/assessments')
        const data = await res.json()
        downloadJson(data.assessments ?? [], 'chaplain-connect-privacy-assessments.json')
      }
    } finally {
      setGenerating(null)
    }
  }

  function downloadJson(data: unknown, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const reports = [
    {
      id: 'data-map',
      title: 'Data Location Map Export',
      description: `Full export of all ${totalLocations} tracked data locations — tables, columns, PII flags, legal basis, and retention periods. Use for auditor evidence packages.`,
      format: 'JSON',
      linked_controls: ['ISO 27701 A.7.2', 'SOC 2 CC6.1', 'GDPR Art. 30'],
    },
    {
      id: 'ropa',
      title: 'ROPA — GDPR Article 30 Export',
      description: 'Records of Processing Activities. Structured export of all processing purposes, data categories, recipients, transfers, and legal bases.',
      format: 'JSON',
      linked_controls: ['GDPR Art. 30', 'ISO 27701 A.7.2.1', 'ISO 27018'],
    },
    {
      id: 'assessments',
      title: 'Privacy Assessments Export',
      description: 'Full export of all PIAs, DPIAs, and TIAs including section content, approval status, and linked controls.',
      format: 'JSON',
      linked_controls: ['GDPR Art. 35', 'ISO 27701 A.7.4', 'SOC 2 A1.2'],
    },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Export structured data for auditor packages, DPO review, and compliance submissions.
        PDF generation is on the roadmap — current exports are JSON for programmatic use.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map(report => (
          <Card key={report.id}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm">{report.title}</CardTitle>
              <span className="text-xs text-muted-foreground font-mono">.{report.format.toLowerCase()}</span>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <p className="text-xs text-muted-foreground">{report.description}</p>
              <div className="flex flex-wrap gap-1">
                {report.linked_controls.map(ctrl => (
                  <span key={ctrl} className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                    {ctrl}
                  </span>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={generating === report.id}
                onClick={() => generateReport(report.id)}
              >
                {generating === report.id ? 'Generating…' : `Export ${report.format}`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Compliance checklist */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">Privacy Compliance Checklist</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-2 text-sm">
            {[
              { item: 'Data Location Index maintained and regularly verified', done: totalLocations > 0 },
              { item: 'GDPR Article 30 ROPA created', done: true },
              { item: 'Legal basis documented for all processing activities', done: totalLocations > 0 },
              { item: 'Retention periods defined per data category', done: totalLocations > 0 },
              { item: 'PIA process in place for new features', done: false },
              { item: 'DPIA completed for high-risk processing', done: false },
              { item: 'Cross-border transfer mechanisms documented (TIA)', done: false },
              { item: 'Data subject request (DSAR) process operational', done: false },
              { item: 'Privacy policy published and up-to-date', done: false },
              { item: 'DPO appointed or responsible person designated', done: false },
            ].map((check, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`mt-0.5 text-xs ${check.done ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {check.done ? '✓' : '○'}
                </span>
                <span className={`text-xs ${check.done ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {check.item}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
