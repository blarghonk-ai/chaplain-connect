import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit/logger'

// GET — list posts for org
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const publishedOnly = searchParams.get('published') === 'true'

  const query = supabase
    .from('posts')
    .select(`
      id, title, content, published, created_at, updated_at,
      profiles!author_id (id, full_name)
    `)
    .order('created_at', { ascending: false })

  if (publishedOnly) query.eq('published', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ posts: data ?? [] })
}

// POST — create a post
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const { title, content, published } = await request.json()
  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      org_id: profile.org_id,
      author_id: user.id,
      title: title.trim(),
      content: content ?? '',
      published: published ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    user_id: user.id,
    org_id: profile.org_id,
    action: 'post.create',
    resource_type: 'post',
    resource_id: post.id,
    metadata: { title: post.title, published: post.published },
  })

  return NextResponse.json({ post }, { status: 201 })
}
