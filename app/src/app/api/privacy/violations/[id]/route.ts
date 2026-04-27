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
  const user = await guardSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { status, resolution_notes } = await request.json()

  const validStatuses = ['open', 'in_remediation', 'resolved', 'dismissed']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
  }

  const admin = await createAdminClient()
  const update: Record<string, unknown> = { status }
  if (resolution_notes) update.resolution_notes = resolution_notes
  if (status === 'resolved' || status === 'dismissed') {
    update.resolved_at = new Date().toISOString()
    update.resolved_by = user.id
  }

  const { data, error } = await admin
    .from('data_violations')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ violation: data })
}
