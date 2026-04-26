import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

interface AuditEvent {
  org_id?: string
  user_id?: string
  action: string
  resource_type: string
  resource_id?: string
  metadata?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
}

export async function logAuditEvent(event: AuditEvent) {
  try {
    const supabase = await createClient()

    // Get the last hash for chaining
    const { data: last } = await supabase
      .from('audit_logs')
      .select('hash')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const prev_hash = last?.hash ?? '0000000000000000'

    // Compute hash: SHA-256 of prev_hash + action + timestamp
    const content = `${prev_hash}|${event.action}|${event.resource_type}|${event.resource_id ?? ''}|${Date.now()}`
    const hash = createHash('sha256').update(content).digest('hex')

    await supabase.from('audit_logs').insert({
      ...event,
      prev_hash,
      hash,
    })
  } catch {
    // Never throw from audit logger — log silently
    console.error('[audit] failed to write audit log')
  }
}
