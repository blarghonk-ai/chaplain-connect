import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const admin = await createAdminClient()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status) updates.status = body.status
  if (body.resolution_notes) updates.resolution_notes = body.resolution_notes
  if (body.status === 'resolved') updates.resolved_at = new Date().toISOString()

  const { error } = await admin.from('grc_vulnerabilities').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
