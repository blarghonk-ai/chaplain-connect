import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GRCClient from './_components/grc-client'

export const metadata = { title: 'GRC Engine — Chaplain Connect' }

export default async function GRCPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') redirect('/dashboard')

  // Use admin client to bypass RLS for the GRC tool (super_admin internal tool)
  const admin = await createAdminClient()

  const [frameworksRes, implementationsRes, vulnsRes, risksRes] = await Promise.all([
    admin.from('grc_frameworks').select('id, key, name, version').order('name'),
    admin.from('grc_implementations').select('status'),
    admin.from('grc_vulnerabilities').select('severity, status'),
    admin.from('grc_risks').select('risk_score, status'),
  ])

  // Compute readiness stats
  const implementations = implementationsRes.data ?? []
  const total = implementations.length
  const implemented = implementations.filter(i =>
    ['implemented', 'evidence_collected', 'audited'].includes(i.status)
  ).length
  const readinessPct = total > 0 ? Math.round((implemented / total) * 100) : 0

  const vulns = vulnsRes.data ?? []
  const openCritical = vulns.filter(v => v.severity === 'critical' && v.status === 'open').length
  const openHigh = vulns.filter(v => v.severity === 'high' && v.status === 'open').length

  const risks = risksRes.data ?? []
  const highRisks = risks.filter(r => r.risk_score >= 15 && r.status === 'open').length

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GRC Engine</h1>
        <p className="text-sm text-muted-foreground">Governance, Risk & Compliance — Internal tool</p>
      </div>
      <GRCClient
        frameworks={frameworksRes.data ?? []}
        stats={{ total, implemented, readinessPct, openCritical, openHigh, highRisks }}
      />
    </div>
  )
}
