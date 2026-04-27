import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: regs, error } = await admin
    .from('privacy_regulations')
    .select('*')
    .eq('is_active', true)
    .order('applies_to_us', { ascending: false })
    .order('jurisdiction_code')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ regulations: regs ?? [] })
}
