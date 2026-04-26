import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit/logger'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/team — invite a new member
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id || !['org_admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, role } = await request.json()
  if (!email || !role) return NextResponse.json({ error: 'email and role required' }, { status: 400 })

  // Check if already a member
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('org_id', profile.org_id)
    .eq('id', (await supabase.from('profiles').select('id').eq('id', user.id).single()).data?.id ?? '')
    .single()

  // Upsert invitation
  const { data: invitation, error } = await supabase
    .from('invitations')
    .upsert({ org_id: profile.org_id, email, role, invited_by: user.id }, { onConflict: 'token' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    org_id: profile.org_id,
    user_id: user.id,
    action: 'invite_member',
    resource_type: 'invitation',
    resource_id: invitation?.id,
    metadata: { email, role },
    ip_address: request.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json({ invitation })
}

// DELETE /api/team — remove a member
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id || !['org_admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { memberId } = await request.json()
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })
  if (memberId === user.id) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })

  const { error } = await supabase
    .from('profiles')
    .update({ org_id: null, role: 'user' })
    .eq('id', memberId)
    .eq('org_id', profile.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    org_id: profile.org_id,
    user_id: user.id,
    action: 'remove_member',
    resource_type: 'profile',
    resource_id: memberId,
  })

  return NextResponse.json({ success: true })
}

// PATCH /api/team — change a member's role
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id || !['org_admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { memberId, role } = await request.json()
  if (!memberId || !role) return NextResponse.json({ error: 'memberId and role required' }, { status: 400 })

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', memberId)
    .eq('org_id', profile.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    org_id: profile.org_id,
    user_id: user.id,
    action: 'change_member_role',
    resource_type: 'profile',
    resource_id: memberId,
    metadata: { new_role: role },
  })

  return NextResponse.json({ success: true })
}
