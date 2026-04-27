import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function guardSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'super_admin' ? user : null
}

const ASSESSMENT_SECTIONS: Record<string, { key: string; title: string; sort_order: number }[]> = {
  pia: [
    { key: 'overview', title: 'Feature / Change Overview', sort_order: 1 },
    { key: 'data_flows', title: 'Data Flows Involved', sort_order: 2 },
    { key: 'necessity', title: 'Necessity & Proportionality', sort_order: 3 },
    { key: 'risks', title: 'Privacy Risks Identified', sort_order: 4 },
    { key: 'mitigations', title: 'Risk Mitigations', sort_order: 5 },
    { key: 'sign_off', title: 'Sign-off & Approval', sort_order: 6 },
  ],
  dpia: [
    { key: 'description', title: 'Description of Processing', sort_order: 1 },
    { key: 'necessity_proportionality', title: 'Necessity & Proportionality Assessment', sort_order: 2 },
    { key: 'risk_assessment', title: 'Risk to Rights & Freedoms', sort_order: 3 },
    { key: 'measures', title: 'Measures to Address Risks', sort_order: 4 },
    { key: 'consultation', title: 'Consultation Outcomes', sort_order: 5 },
    { key: 'dpo_opinion', title: 'DPO Opinion', sort_order: 6 },
    { key: 'sign_off', title: 'Controller Decision & Approval', sort_order: 7 },
  ],
  tia: [
    { key: 'transfer_details', title: 'Transfer Details (origin → destination)', sort_order: 1 },
    { key: 'legal_mechanism', title: 'Legal Transfer Mechanism (SCCs, BCRs, adequacy)', sort_order: 2 },
    { key: 'destination_laws', title: 'Destination Country Laws Assessment', sort_order: 3 },
    { key: 'practical_measures', title: 'Practical Supplementary Measures', sort_order: 4 },
    { key: 'residual_risk', title: 'Residual Risk Assessment', sort_order: 5 },
    { key: 'conclusion', title: 'Conclusion & Decision', sort_order: 6 },
  ],
  ropa: [
    { key: 'controller', title: 'Data Controller', sort_order: 1 },
    { key: 'purposes', title: 'Purposes of Processing', sort_order: 2 },
    { key: 'data_categories', title: 'Categories of Personal Data', sort_order: 3 },
    { key: 'recipients', title: 'Categories of Recipients', sort_order: 4 },
    { key: 'transfers', title: 'Transfers to Third Countries', sort_order: 5 },
    { key: 'retention', title: 'Retention Periods', sort_order: 6 },
    { key: 'security', title: 'Security Measures', sort_order: 7 },
    { key: 'legal_basis', title: 'Lawful Basis for Processing', sort_order: 8 },
  ],
}

export async function GET() {
  const user = await guardSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('privacy_assessments')
    .select('*, privacy_assessment_sections(*)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assessments: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await guardSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { assessment_type, title, description, due_date } = await request.json()
  if (!assessment_type || !title?.trim()) {
    return NextResponse.json({ error: 'assessment_type and title required' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { data: assessment, error } = await admin
    .from('privacy_assessments')
    .insert({
      assessment_type,
      title,
      description,
      due_date: due_date ?? null,
      owner_id: user.id,
      status: 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-create sections template for this assessment type
  const sections = ASSESSMENT_SECTIONS[assessment_type] ?? []
  if (sections.length > 0) {
    await admin.from('privacy_assessment_sections').insert(
      sections.map(s => ({
        assessment_id: assessment.id,
        section_key: s.key,
        section_title: s.title,
        sort_order: s.sort_order,
        content: '',
        is_complete: false,
      }))
    )
  }

  return NextResponse.json({ assessment }, { status: 201 })
}
