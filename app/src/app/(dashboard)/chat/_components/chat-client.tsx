'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

type Member = { id: string; full_name: string | null }

type Conversation = {
  id: string
  name: string | null
  is_group: boolean
  created_at: string
}

type Message = {
  id: string
  body: string
  created_at: string
  sender_id: string
  profiles: { full_name: string | null } | { full_name: string | null }[] | null
}

function senderName(msg: Message, currentUserId: string): string {
  if (msg.sender_id === currentUserId) return 'You'
  const p = Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles
  return p?.full_name ?? 'Unknown'
}

export default function ChatClient({
  currentUserId,
  members,
}: {
  currentUserId: string
  members: Member[]
}) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [showNewDM, setShowNewDM] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load conversations
  const loadConversations = useCallback(async () => {
    const res = await fetch('/api/chat/conversations')
    const data = await res.json()
    setConversations(data.conversations ?? [])
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConvId) return
    setMessages([])

    fetch(`/api/chat/messages?conversationId=${activeConvId}`)
      .then(r => r.json())
      .then(data => setMessages(data.messages ?? []))

    // Realtime subscription
    const channel = supabase
      .channel(`messages:${activeConvId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${activeConvId}`,
        },
        async (payload) => {
          // Fetch sender name for the new message
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', payload.new.sender_id)
            .single()

          const newMsg: Message = {
            ...(payload.new as Message),
            profiles: profile ?? null,
          }
          setMessages(prev => [...prev, newMsg])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeConvId, supabase])

  async function sendMessage() {
    if (!draft.trim() || !activeConvId || sending) return
    setSending(true)
    await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: activeConvId, body: draft }),
    })
    setDraft('')
    setSending(false)
  }

  async function startDM(recipientId: string) {
    const res = await fetch('/api/chat/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId, isGroup: false }),
    })
    const data = await res.json()
    if (data.conversation) {
      await loadConversations()
      setActiveConvId(data.conversation.id)
    }
    setShowNewDM(false)
  }

  return (
    <div className="flex flex-1 gap-0 p-6 pt-4 min-h-0">
      {/* Sidebar — conversation list */}
      <div className="w-64 shrink-0 flex flex-col border rounded-l-lg bg-muted/20">
        <div className="p-3 flex items-center justify-between">
          <span className="text-sm font-medium">Conversations</span>
          <Button size="sm" variant="outline" onClick={() => setShowNewDM(v => !v)}>
            + New
          </Button>
        </div>
        <Separator />

        {/* New DM picker */}
        {showNewDM && (
          <div className="p-2 border-b space-y-1">
            <p className="text-xs text-muted-foreground px-1">Start a conversation with:</p>
            {members.map(m => (
              <button
                key={m.id}
                onClick={() => startDM(m.id)}
                className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors"
              >
                {m.full_name ?? 'Unknown'}
              </button>
            ))}
            {members.length === 0 && (
              <p className="text-xs text-muted-foreground px-1">No other members yet</p>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setActiveConvId(conv.id)}
              className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-muted ${
                activeConvId === conv.id ? 'bg-muted font-medium' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                {conv.is_group && <Badge variant="secondary" className="text-xs px-1 py-0">group</Badge>}
                <span className="truncate">{conv.name ?? 'Direct message'}</span>
              </div>
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="p-3 text-xs text-muted-foreground">No conversations yet. Start one above.</p>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <Card className="flex-1 flex flex-col rounded-l-none border-l-0 min-h-0">
        {!activeConvId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a conversation or start a new one
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => {
                const isMe = msg.sender_id === currentUserId
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-muted-foreground mb-0.5">
                      {senderName(msg, currentUserId)}
                    </span>
                    <div
                      className={`max-w-[70%] rounded-xl px-3 py-2 text-sm ${
                        isMe
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {msg.body}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
            <Separator />
            <div className="p-3 flex gap-2">
              <Input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Type a message…"
                disabled={sending}
              />
              <Button onClick={sendMessage} disabled={sending || !draft.trim()}>
                Send
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
