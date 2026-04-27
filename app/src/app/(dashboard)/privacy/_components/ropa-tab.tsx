'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface Section {
  id: string
  section_key: string
  section_title: string
  content: string
  is_complete: boolean
  sort_order: number
}

interface Assessment {
  id: string
  assessment_type: string
  title: string
  description: string | null
  status: string
  updated_at: string
  privacy_assessment_sections: Section[]
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  in_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-800',
}

export default function RopaTab() {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Assessment | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [editContent, setEditContent] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/privacy/assessments')
      .then(r => r.json())
      .then(d => {
        const ropas = (d.assessments ?? []).filter((a: Assessment) => a.assessment_type === 'ropa')
        setAssessments(ropas)
        if (ropas.length > 0) {
          setSelected(ropas[0])
          const init: Record<string, string> = {}
          ropas[0].privacy_assessment_sections?.forEach((s: Section) => {
            init[s.id] = s.content
          })
          setEditContent(init)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function saveSection(section: Section) {
    setSaving(section.id)
    try {
      await fetch(`/api/privacy/assessments/${selected!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: section.id,
          content: editContent[section.id] ?? section.content,
          is_complete: (editContent[section.id] ?? section.content).length > 10,
        }),
      })
      // Update local state
      setSelected(prev => {
        if (!prev) return prev
        return {
          ...prev,
          privacy_assessment_sections: prev.privacy_assessment_sections.map(s =>
            s.id === section.id
              ? { ...s, content: editContent[section.id] ?? s.content, is_complete: (editContent[section.id] ?? s.content).length > 10 }
              : s
          ),
        }
      })
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading ROPA…</p>

  if (assessments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No ROPA records found.</p>
        <p className="text-xs mt-1">Run the Phase 4 migration to seed the default ROPA.</p>
      </div>
    )
  }

  const sections = selected?.privacy_assessment_sections?.sort((a, b) => a.sort_order - b.sort_order) ?? []
  const completedSections = sections.filter(s => s.is_complete).length

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* ROPA list */}
      <div className="space-y-2">
        {assessments.map(a => (
          <Card
            key={a.id}
            className={`cursor-pointer hover:border-foreground/30 transition-colors ${selected?.id === a.id ? 'border-foreground/50' : ''}`}
            onClick={() => {
              setSelected(a)
              const init: Record<string, string> = {}
              a.privacy_assessment_sections?.forEach(s => { init[s.id] = s.content })
              setEditContent(init)
            }}
          >
            <CardContent className="p-3">
              <p className="text-sm font-medium leading-tight">{a.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[a.status] ?? ''}`}>
                  {a.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.updated_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section editor */}
      {selected && (
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{selected.title}</h3>
              <p className="text-xs text-muted-foreground">
                {completedSections}/{sections.length} sections complete
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[selected.status] ?? ''}`}>
                {selected.status}
              </span>
              {selected.status === 'draft' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await fetch(`/api/privacy/assessments/${selected.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'in_review' }),
                    })
                    setSelected(prev => prev ? { ...prev, status: 'in_review' } : prev)
                  }}
                >
                  Submit for Review
                </Button>
              )}
              {selected.status === 'in_review' && (
                <Button
                  size="sm"
                  onClick={async () => {
                    await fetch(`/api/privacy/assessments/${selected.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'approved' }),
                    })
                    setSelected(prev => prev ? { ...prev, status: 'approved' } : prev)
                  }}
                >
                  Approve
                </Button>
              )}
            </div>
          </div>

          {sections.map(section => (
            <Card key={section.id}>
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{section.section_title}</CardTitle>
                  {section.is_complete && (
                    <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                      Complete
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <Textarea
                  className="text-sm min-h-[80px] resize-y"
                  value={editContent[section.id] ?? section.content}
                  onChange={e => setEditContent(prev => ({ ...prev, [section.id]: e.target.value }))}
                  placeholder="Enter content for this section…"
                />
                <div className="flex justify-end mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving === section.id}
                    onClick={() => saveSection(section)}
                  >
                    {saving === section.id ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
