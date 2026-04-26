'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

type Message = { role: 'user' | 'assistant'; content: string }

export default function AIClient() {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [convId, setConvId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!draft.trim() || loading) return
    const userMsg = draft.trim()
    setDraft('')
    setError(null)
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMsg, conversationId: convId }),
    })

    const data = await res.json()
    if (data.conversationId) setConvId(data.conversationId)

    if (!res.ok || data.error) {
      setError(data.error ?? 'Something went wrong. Please try again.')
      setMessages(prev => prev.slice(0, -1))
      setDraft(userMsg)
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    }

    setLoading(false)
  }

  return (
    <div className="flex flex-1 flex-col p-6 pt-4 min-h-0">
      {error && (
        <div className="mb-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm">
          {error}
        </div>
      )}

      <Card className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm space-y-2 py-12">
              <p className="text-4xl">✝</p>
              <p className="font-medium">How can I assist you today?</p>
              <p className="text-xs max-w-sm text-center">
                Ask for scripture references, pastoral care guidance, session preparation help, or theological context.
              </p>
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {[
                  'Find verses about comfort and grief',
                  'Help me prepare for a hospital visit',
                  'What does the Bible say about hope?',
                ].map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => setDraft(prompt)}
                    className="text-xs border rounded-full px-3 py-1 hover:bg-muted transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-xl px-4 py-2.5 text-sm text-muted-foreground animate-pulse">
                Thinking…
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <Separator />
        <div className="p-3 flex gap-2">
          <Input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask about scripture, pastoral care, or session prep…"
            disabled={loading}
          />
          <Button onClick={send} disabled={loading || !draft.trim()}>Send</Button>
        </div>
      </Card>
    </div>
  )
}
