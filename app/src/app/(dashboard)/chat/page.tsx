import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatClient from './_components/chat-client'

export const metadata = { title: 'Chat — Chaplain Connect' }

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch org members for new-conversation picker
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, full_name')
    .eq('id', user.id)
    .single()

  const { data: members } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('org_id', profile?.org_id ?? '')
    .neq('id', user.id)
    .order('full_name')

  return (
    <div className="h-[calc(100vh-0px)] flex flex-col">
      <div className="p-6 pb-0">
        <h1 className="text-2xl font-bold">Chat</h1>
      </div>
      <ChatClient currentUserId={user.id} members={members ?? []} />
    </div>
  )
}
