import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit/logger'

// GET — list conversations for current user
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('conversation_members')
    .select(`
      conversation_id,
      conversations (
        id,
        name,
        is_group,
        created_at
      )
    `)
    .eq('profile_id', user.id)
    .order('joined_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const conversations = (data ?? []).map((row) => {
    const conv = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations
    return conv
  }).filter(Boolean)

  return NextResponse.json({ conversations })
}

// POST — create a new direct message conversation
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recipientId, name, isGroup } = await request.json()

  // Get org_id from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return NextResponse.json({ error: 'No org found' }, { status: 400 })

  const { data: conv, error } = await supabase
    .from('conversations')
    .insert({ org_id: profile.org_id, name: name ?? null, is_group: isGroup ?? false })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Add creator as member
  await supabase.from('conversation_members').insert({ conversation_id: conv.id, profile_id: user.id })

  // Add recipient for DMs
  if (recipientId && recipientId !== user.id) {
    await supabase.from('conversation_members').insert({ conversation_id: conv.id, profile_id: recipientId })
  }

  await logAuditEvent({ user_id: user.id, org_id: profile.org_id, action: 'conversation.create', resource_type: 'conversation', resource_id: conv.id })

  return NextResponse.json({ conversation: conv }, { status: 201 })
}
