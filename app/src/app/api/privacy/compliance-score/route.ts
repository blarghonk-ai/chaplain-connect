import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface RegScore {
  regulation_short: string
  jurisdiction_name: string
  score: number
  gaps: string[]
  applies_to_us: boolean
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = await createAdminClient()

  const [regsRes, assessmentsRes, locationsRes, consentRes] = await Promise.all([
    admin.from('privacy_regulations').select('*').eq('is_active', true),
    admin.from('privacy_assessments').select('title, assessment_type, status'),
    admin.from('data_locations').select('is_pii, legal_basis, retention_days'),
    admin.from('consent_records').select('purpose, is_active').eq('is_active', true),
  ])

  const regs = regsRes.data ?? []
  const assessments = assessmentsRes.data ?? []
  const locations = locationsRes.data ?? []
  const consents = consentRes.data ?? []

  const assessmentText = assessments.map(a => a.title.toLowerCase()).join(' ')
  const approvedRopas = assessments.filter(a => a.assessment_type === 'ropa' && a.status === 'approved')
  const approvedDpias = assessments.filter(a => a.assessment_type === 'dpia' && a.status === 'approved')
  const piiLocations = locations.filter(l => l.is_pii)
  const piiWithLegalBasis = piiLocations.filter(l => l.legal_basis)
  const piiWithRetention = piiLocations.filter(l => l.retention_days)
  const consentPurposes = new Set(consents.map(c => c.purpose))

  const scores: RegScore[] = []

  for (const reg of regs) {
    const gaps: string[] = []
    let score = 0
    const maxScore = 5

    // 1. ROPA exists and approved (20 pts)
    if (!reg.ropa_required || approvedRopas.length > 0) {
      score++
    } else {
      gaps.push('No approved ROPA (Article 30 record of processing activities)')
    }

    // 2. Legal basis documented for all PII (20 pts)
    if (piiLocations.length === 0 || piiWithLegalBasis.length === piiLocations.length) {
      score++
    } else {
      const missing = piiLocations.length - piiWithLegalBasis.length
      gaps.push(`${missing} PII field${missing > 1 ? 's' : ''} missing legal basis`)
    }

    // 3. Retention periods defined (20 pts)
    if (piiLocations.length === 0 || piiWithRetention.length === piiLocations.length) {
      score++
    } else {
      gaps.push('Some PII fields missing retention period definition')
    }

    // 4. DPIA completed for high-risk processing (20 pts)
    if (!reg.dpia_required || approvedDpias.length > 0) {
      score++
    } else {
      gaps.push(`DPIA required by ${reg.regulation_short} but none approved`)
    }

    // 5. Compliance documentation exists (20 pts)
    const mentioned = assessmentText.includes(reg.regulation_short.toLowerCase())
    const hasConsent = !reg.consent_required || consentPurposes.size > 0
    if (mentioned && hasConsent) {
      score++
    } else {
      if (!mentioned) gaps.push('No compliance documentation referencing this regulation')
      if (reg.consent_required && consentPurposes.size === 0) gaps.push('No consent records on file')
    }

    scores.push({
      regulation_short: reg.regulation_short,
      jurisdiction_name: reg.jurisdiction_name,
      score: Math.round((score / maxScore) * 100),
      gaps,
      applies_to_us: reg.applies_to_us,
    })
  }

  return NextResponse.json({
    scores: scores.sort((a, b) => {
      // Sort: applies_to_us first, then by score ascending (worst first)
      if (a.applies_to_us !== b.applies_to_us) return a.applies_to_us ? -1 : 1
      return a.score - b.score
    }),
  })
}
