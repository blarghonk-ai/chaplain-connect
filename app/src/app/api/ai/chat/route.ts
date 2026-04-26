import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'AI assistant is not configured. Add GROQ_API_KEY to your environment.' }, { status: 503 })
  }

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

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...(history ?? []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      max_tokens: 1024,
    })

    const assistantContent = completion.choices[0]?.message?.content ?? ''

    // Save assistant response
    await supabase.from('ai_messages').insert({
      ai_conversation_id: convId,
      role: 'assistant',
      content: assistantContent,
    })

    return NextResponse.json({ reply: assistantContent, conversationId: convId })
  } catch (err) {
    console.error('[ai/chat] Groq error:', err)
    return NextResponse.json(
      { error: 'AI assistant is unavailable. Please try again shortly.', conversationId: convId },
      { status: 503 }
    )
  }
}
