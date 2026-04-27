import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Super-admin endpoint: aggregate cookie consent stats for the privacy dashboard
export async function GET() {
  const supabase = await createClient()

  // Auth + role check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use service role for aggregate reads across all records
  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )

  // Total count + category opt-in rates
  const { data: rows, error } = await service
    .from('cookie_consent_records')
    .select('jurisdiction, functional, analytics, marketing, personalization, granted_at, withdrawn_at')
    .order('granted_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const total = rows?.length ?? 0
  const active = rows?.filter(r => !r.withdrawn_at).length ?? 0

  // Category opt-in counts (active records only)
  const activeRows = rows?.filter(r => !r.withdrawn_at) ?? []
  const categories = {
    functional:      activeRows.filter(r => r.functional).length,
    analytics:       activeRows.filter(r => r.analytics).length,
    marketing:       activeRows.filter(r => r.marketing).length,
    personalization: activeRows.filter(r => r.personalization).length,
  }

  // Jurisdiction breakdown
  const byJurisdiction: Record<string, number> = {}
  for (const row of activeRows) {
    const j = row.jurisdiction ?? 'unknown'
    byJurisdiction[j] = (byJurisdiction[j] ?? 0) + 1
  }

  // Recent 20 records
  const recent = (rows ?? []).slice(0, 20).map(r => ({
    jurisdiction: r.jurisdiction,
    functional: r.functional,
    analytics: r.analytics,
    marketing: r.marketing,
    personalization: r.personalization,
    granted_at: r.granted_at,
    withdrawn_at: r.withdrawn_at,
  }))

  return NextResponse.json({
    total,
    active,
    withdrawn: total - active,
    categories,
    byJurisdiction,
    recent,
  })
}
