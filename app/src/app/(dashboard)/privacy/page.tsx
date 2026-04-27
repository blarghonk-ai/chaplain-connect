import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PrivacyClient from './_components/privacy-client'

export const metadata = { title: 'Privacy Governance — Chaplain Connect' }

export default async function PrivacyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') redirect('/dashboard')

  const admin = await createAdminClient()

  const [locationsRes, assessmentsRes] = await Promise.all([
    admin.from('data_locations').select('data_category, is_pii, storage_system, legal_basis'),
    admin.from('privacy_assessments').select('assessment_type, status, updated_at'),
  ])

  const locations = locationsRes.data ?? []
  const assessments = assessmentsRes.data ?? []

  const piiCount = locations.filter(l => l.is_pii).length
  const categoryBreakdown = locations.reduce<Record<string, number>>((acc, l) => {
    acc[l.data_category] = (acc[l.data_category] ?? 0) + 1
    return acc
  }, {})

  const storageBreakdown = locations.reduce<Record<string, number>>((acc, l) => {
    acc[l.storage_system] = (acc[l.storage_system] ?? 0) + 1
    return acc
  }, {})

  const ropaCount = assessments.filter(a => a.assessment_type === 'ropa').length
  const draftAssessments = assessments.filter(a => a.status === 'draft').length
  const approvedAssessments = assessments.filter(a => a.status === 'approved').length

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Privacy Governance</h1>
        <p className="text-sm text-muted-foreground">
          Data lineage, ROPA, PIAs, DPIAs & TIAs — Internal tool
        </p>
      </div>
      <PrivacyClient
        stats={{
          totalLocations: locations.length,
          piiCount,
          ropaCount,
          draftAssessments,
          approvedAssessments,
          categoryBreakdown,
          storageBreakdown,
        }}
      />
    </div>
  )
}
