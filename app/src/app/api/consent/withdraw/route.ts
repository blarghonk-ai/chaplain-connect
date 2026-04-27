import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { purpose, org_id } = await request.json()
  if (!purpose) return NextResponse.json({ error: 'purpose required' }, { status: 400 })

  const now = new Date().toISOString()

  // Deactivate consent record
  const { error: consentErr } = await supabase
    .from('consent_records')
    .update({ is_active: false, withdrawn_at: now })
    .eq('user_id', user.id)
    .eq('purpose', purpose)
    .eq('is_active', true)

  if (consentErr) return NextResponse.json({ error: consentErr.message }, { status: 500 })

  // Create withdrawal event for RetentionAgent to process
  const { data: withdrawal, error: withdrawalErr } = await supabase
    .from('consent_withdrawal_events')
    .insert({
      user_id: user.id,
      org_id: org_id ?? null,
      purpose,
      withdrawn_at: now,
      status: 'pending',
    })
    .select()
    .single()

  if (withdrawalErr) return NextResponse.json({ error: withdrawalErr.message }, { status: 500 })
  return NextResponse.json({ withdrawal, message: 'Consent withdrawn. Data deletion will be initiated per our retention policy.' })
}
