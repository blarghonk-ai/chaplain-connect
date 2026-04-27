import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function guardSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'super_admin' ? user : null
}

export async function GET() {
  const user = await guardSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('grc_risks')
    .select('*')
    .order('risk_score', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ risks: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await guardSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, description, category, likelihood, impact, treatment } = await request.json()
  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('grc_risks')
    .insert({ title, description, category, likelihood, impact, treatment, owner_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ risk: data }, { status: 201 })
}
