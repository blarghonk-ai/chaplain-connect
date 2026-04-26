import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, conversationId } = await request.json()
  if (!message?.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 })

  // Get or create conversation
  let convId = conversationId
  if (!convId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    const { data: conv } = await supabase
      .from('ai_conversations')
      .insert({
        org_id: profile?.org_id,
        user_id: user.id,
        title: message.slice(0, 60),
      })
      .select()
      .single()
    convId = conv?.id
  }

  // Save user message
  await supabase.from('ai_messages').insert({
    ai_conversation_id: convId,
    role: 'user',
    content: message.trim(),
  })

  // Fetch conversation history (last 10 messages)
  const { data: history } = await supabase
    .from('ai_messages')
    .select('role, content')
    .eq('ai_conversation_id', convId)
    .order('created_at', { ascending: true })
    .limit(10)

  const systemPrompt = `You are a compassionate AI chaplain assistant. You support chaplains and ministry workers with:
- Scripture references and theological context
- Pastoral care guidance and counseling support
- Session preparation and reflection
- Empathetic, non-judgmental responses grounded in faith
Keep responses concise, warm, and spiritually grounded.`

  // Call Ollama
  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...(history ?? []).map(m => ({ role: m.role, content: m.content })),
        ],
        stream: false,
      }),
    })

    if (!ollamaRes.ok) {
      throw new Error(`Ollama returned ${ollamaRes.status}`)
    }

    const ollamaData = await ollamaRes.json()
    const assistantContent: string = ollamaData.message?.content ?? ''

    // Save assistant response
    await supabase.from('ai_messages').insert({
      ai_conversation_id: convId,
      role: 'assistant',
      content: assistantContent,
    })

    return NextResponse.json({ reply: assistantContent, conversationId: convId })
  } catch {
    return NextResponse.json(
      { error: 'AI assistant is not available. Please ensure Ollama is running.', conversationId: convId },
      { status: 503 }
    )
  }
}
