'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import dynamic from 'next/dynamic'

// Dynamically import editor to avoid SSR issues
const TiptapEditor = dynamic(() => import('./tiptap-editor'), { ssr: false, loading: () => <div className="h-64 bg-muted animate-pulse rounded-md" /> })

type Post = {
  id: string
  title: string
  content: string
  published: boolean
  created_at: string
  updated_at: string
  profiles: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null
}

function authorName(post: Post): string {
  const p = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles
  return p?.full_name ?? 'Unknown'
}

export default function PostsClient({
  currentUserId,
  canWrite,
}: {
  currentUserId: string
  canWrite: boolean
}) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'editor'>('list')
  const [editingPost, setEditingPost] = useState<Post | null>(null)

  // Editor state
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setError] = useState<string | null>(null)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/posts')
    const data = await res.json()
    setPosts(data.posts ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadPosts() }, [loadPosts])

  function openNew() {
    setEditingPost(null)
    setTitle('')
    setContent('')
    setError(null)
    setView('editor')
  }

  function openEdit(post: Post) {
    setEditingPost(post)
    setTitle(post.title)
    setContent(post.content)
    setError(null)
    setView('editor')
  }

  async function save(published: boolean) {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError(null)

    if (editingPost) {
      const res = await fetch(`/api/posts/${editingPost.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, published }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setSaving(false); return }
    } else {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, published }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setSaving(false); return }
    }

    await loadPosts()
    setView('list')
    setSaving(false)
  }

  async function deletePost(id: string) {
    if (!confirm('Delete this post?')) return
    await fetch(`/api/posts/${id}`, { method: 'DELETE' })
    loadPosts()
  }

  if (view === 'editor') {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{editingPost ? 'Edit post' : 'New post'}</h2>
          <Button variant="outline" size="sm" onClick={() => setView('list')}>← Back</Button>
        </div>

        <Input
          placeholder="Post title…"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="text-lg font-medium"
        />

        <div className="border rounded-lg overflow-hidden">
          <TiptapEditor content={content} onChange={setContent} />
        </div>

        {saveError && <p className="text-sm text-destructive">{saveError}</p>}

        <div className="flex gap-2">
          <Button onClick={() => save(false)} disabled={saving} variant="outline">
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
          <Button onClick={() => save(true)} disabled={saving}>
            {saving ? 'Publishing…' : 'Publish'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <Button onClick={openNew}>+ New post</Button>
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && posts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No posts yet. {canWrite ? 'Create your first post above.' : 'Check back soon.'}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {posts.map(post => {
          const isAuthor = Array.isArray(post.profiles)
            ? post.profiles[0]?.id === currentUserId
            : post.profiles?.id === currentUserId

          return (
            <Card key={post.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">{post.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {authorName(post)} · {new Date(post.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={post.published ? 'default' : 'secondary'}>
                      {post.published ? 'Published' : 'Draft'}
                    </Badge>
                    {(isAuthor || canWrite) && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openEdit(post)}>Edit</Button>
                        <Button size="sm" variant="destructive" onClick={() => deletePost(post.id)}>Delete</Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              {post.content && (
                <>
                  <Separator />
                  <CardContent className="pt-3">
                    <div
                      className="prose prose-sm max-w-none text-sm"
                      dangerouslySetInnerHTML={{ __html: post.content }}
                    />
                  </CardContent>
                </>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
