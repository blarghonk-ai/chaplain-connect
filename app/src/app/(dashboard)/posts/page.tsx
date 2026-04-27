import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PostsClient from './_components/posts-client'

export const metadata = { title: 'Content — Chaplain Connect' }

export default async function PostsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const canWrite = ['chaplain', 'org_admin', 'super_admin'].includes(profile?.role ?? '')

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Content</h1>
      <PostsClient currentUserId={user.id} canWrite={canWrite} />
    </div>
  )
}
