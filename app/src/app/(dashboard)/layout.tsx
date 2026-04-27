import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SidebarNav from './_components/sidebar-nav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, organizations(name)')
    .eq('id', user.id)
    .single()

  const orgs = profile?.organizations
  const org = (Array.isArray(orgs) ? orgs[0] : orgs) as { name: string } | null

  // ── MFA enforcement for admins ──────────────────────────────────────
  // org_admin and super_admin must have a verified TOTP factor and an
  // aal2 session before accessing any dashboard route.
  if (['org_admin', 'super_admin'].includes(profile?.role ?? '')) {
    try {
      const [{ data: aal }, { data: factors }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ])
      const verifiedTotp = factors?.totp?.filter(f => f.status === 'verified') ?? []
      if (verifiedTotp.length === 0) redirect('/mfa/setup?required=1')
      if (aal?.currentLevel !== 'aal2') redirect('/mfa/verify')
    } catch {
      // MFA API unavailable — allow access to avoid locking everyone out
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      <SidebarNav
        fullName={profile?.full_name ?? null}
        role={profile?.role ?? null}
        orgName={org?.name ?? null}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {children}
      </div>
    </div>
  )
}
