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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await guardSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('agent_registry')
    .select('*, agent_rules(*)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ agent: data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await guardSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status) updates.status = body.status
  if (body.config) updates.config = body.config

  const admin = await createAdminClient()
  const { error } = await admin.from('agent_registry').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
