import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function guardSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'super_admin' ? user : null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await guardSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('privacy_assessments')
    .select('*, privacy_assessment_sections(*)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assessment: data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await guardSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const admin = await createAdminClient()

  // Handle section content update
  if (body.section_id && body.content !== undefined) {
    const { error } = await admin
      .from('privacy_assessment_sections')
      .update({
        content: body.content,
        is_complete: body.is_complete ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.section_id)
      .eq('assessment_id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // Handle assessment-level update
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status) {
    updates.status = body.status
    if (body.status === 'approved') {
      updates.approved_at = new Date().toISOString()
      updates.approved_by = user.id
    }
  }
  if (body.title) updates.title = body.title
  if (body.description !== undefined) updates.description = body.description
  if (body.due_date !== undefined) updates.due_date = body.due_date

  const { error } = await admin
    .from('privacy_assessments')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
