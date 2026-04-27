'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  created_at: string
  updated_at: string
  due_date: string | null
  privacy_assessment_sections: Section[]
}

const TYPE_LABELS: Record<string, string> = {
  pia: 'PIA',
  dpia: 'DPIA',
  tia: 'TIA',
}

const TYPE_DESCRIPTIONS: Record<string, string> = {
  pia: 'Privacy Impact Assessment — for new features or data flows',
  dpia: 'Data Protection Impact Assessment — required for high-risk processing (GDPR Art. 35)',
  tia: 'Transfer Impact Assessment — for cross-border data transfers',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  in_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-800',
}

const TYPE_COLORS: Record<string, string> = {
  pia: 'bg-purple-100 text-purple-800',
  dpia: 'bg-red-100 text-red-800',
  tia: 'bg-blue-100 text-blue-800',
}

export default function AssessmentsTab() {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Assessment | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [editContent, setEditContent] = useState<Record<string, string>>({})
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState<string>('pia')
  const [newDesc, setNewDesc] = useState('')

  useEffect(() => {
    loadAssessments()
  }, [])

  async function loadAssessments() {
    const data = await fetch('/api/privacy/assessments').then(r => r.json())
    const nonRopa = (data.assessments ?? []).filter((a: Assessment) => a.assessment_type !== 'ropa')
    setAssessments(nonRopa)
    setLoading(false)
  }

  async function createAssessment() {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/privacy/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessment_type: newType, title: newTitle, description: newDesc }),
      })
      const data = await res.json()
      if (data.assessment) {
        setNewTitle('')
        setNewDesc('')
        await loadAssessments()
        // Select the newly created one
        const refreshed = await fetch('/api/privacy/assessments').then(r => r.json())
        const all = (refreshed.assessments ?? []).filter((a: Assessment) => a.assessment_type !== 'ropa')
        setAssessments(all)
        const created = all.find((a: Assessment) => a.id === data.assessment.id)
        if (created) {
          setSelected(created)
          const init: Record<string, string> = {}
          created.privacy_assessment_sections?.forEach((s: Section) => { init[s.id] = s.content })
          setEditContent(init)
        }
      }
    } finally {
      setCreating(false)
    }
  }

  async function saveSection(section: Section) {
    if (!selected) return
    setSaving(section.id)
    try {
      await fetch(`/api/privacy/assessments/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: section.id,
          content: editContent[section.id] ?? section.content,
          is_complete: (editContent[section.id] ?? section.content).length > 10,
        }),
      })
      setSelected(prev => {
        if (!prev) return prev
        return {
          ...prev,
          privacy_assessment_sections: prev.privacy_assessment_sections.map(s =>
            s.id === section.id
              ? { ...s, content: editContent[section.id] ?? s.content, is_complete: true }
              : s
          ),
        }
      })
    } finally {
      setSaving(null)
    }
  }

  const sections = selected?.privacy_assessment_sections?.sort((a, b) => a.sort_order - b.sort_order) ?? []
  const completedSections = sections.filter(s => s.is_complete).length

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Left: list + create */}
      <div className="space-y-3">
        {/* Create form */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm">New Assessment</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            <select
              value={newType}
              onChange={e => setNewType(e.target.value)}
              className="h-8 w-full rounded border border-input bg-background px-2 text-sm"
            >
              <option value="pia">PIA</option>
              <option value="dpia">DPIA</option>
              <option value="tia">TIA</option>
            </select>
            <p className="text-xs text-muted-foreground">{TYPE_DESCRIPTIONS[newType]}</p>
            <Input
              placeholder="Title…"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="text-sm h-8"
            />
            <Input
              placeholder="Brief description (optional)…"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="text-sm h-8"
            />
            <Button size="sm" className="w-full" disabled={creating || !newTitle.trim()} onClick={createAssessment}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : assessments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No assessments yet.</p>
        ) : (
          assessments.map(a => (
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
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[a.assessment_type] ?? ''}`}>
                    {TYPE_LABELS[a.assessment_type] ?? a.assessment_type.toUpperCase()}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[a.status] ?? ''}`}>
                    {a.status}
                  </span>
                </div>
                <p className="text-sm font-medium leading-tight">{a.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(a.updated_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Right: section editor */}
      {selected ? (
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[selected.assessment_type] ?? ''}`}>
                  {TYPE_LABELS[selected.assessment_type] ?? selected.assessment_type.toUpperCase()}
                </span>
                <h3 className="font-semibold">{selected.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {completedSections}/{sections.length} sections complete
                {selected.description && ` · ${selected.description}`}
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
      ) : (
        <div className="lg:col-span-3 flex items-center justify-center text-muted-foreground text-sm">
          Select an assessment to view and edit it.
        </div>
      )}
    </div>
  )
}
