import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function guardSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'super_admin' ? user : null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await guardSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action, resolution_notes } = await request.json()
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const now = new Date().toISOString()

  const approvalStatus = action === 'approve' ? 'approved' : 'rejected'

  const { error: decisionErr } = await admin
    .from('agent_decisions')
    .update({
      approval_status: approvalStatus,
      approved_by: user.id,
      approved_at: now,
      action_executed_at: action === 'approve' ? now : null,
    })
    .eq('id', id)

  if (decisionErr) return NextResponse.json({ error: decisionErr.message }, { status: 500 })

  // Resolve the approval queue entry
  const { error: queueErr } = await admin
    .from('agent_approval_queue')
    .update({ resolved_at: now, resolution_notes: resolution_notes ?? null })
    .eq('decision_id', id)

  if (queueErr) return NextResponse.json({ error: queueErr.message }, { status: 500 })
  return NextResponse.json({ success: true, status: approvalStatus })
}
