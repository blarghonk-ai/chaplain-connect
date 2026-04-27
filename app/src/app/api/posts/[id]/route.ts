import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit/logger'

// PATCH — update post
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if (body.title !== undefined) updates.title = body.title
  if (body.content !== undefined) updates.content = body.content
  if (body.published !== undefined) updates.published = body.published
  updates.updated_at = new Date().toISOString()

  const { data: post, error } = await supabase
    .from('posts')
    .update(updates)
    .eq('id', id)
    .eq('author_id', user.id)   // RLS + app-level: only author can update
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  await logAuditEvent({
    user_id: user.id,
    org_id: profile?.org_id,
    action: 'post.update',
    resource_type: 'post',
    resource_id: id,
    metadata: { changes: Object.keys(updates) },
  })

  return NextResponse.json({ post })
}

// DELETE — delete post
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('org_id, role').eq('id', user.id).single()
  const isAdmin = ['org_admin', 'super_admin'].includes(profile?.role ?? '')

  const query = supabase.from('posts').delete().eq('id', id)
  if (!isAdmin) query.eq('author_id', user.id)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    user_id: user.id,
    org_id: profile?.org_id,
    action: 'post.delete',
    resource_type: 'post',
    resource_id: id,
  })

  return NextResponse.json({ success: true })
}
