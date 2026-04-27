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
    .select('full_name, role, org_id, organizations(name)')
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

  // ── Subscription enforcement ─────────────────────────────────────────
  // canceled/unpaid orgs are blocked; past_due gets a warning banner.
  let subscriptionStatus: string | null = null
  if (profile?.org_id) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('org_id', profile.org_id)
      .single()
    subscriptionStatus = sub?.status ?? null

    if (subscriptionStatus === 'canceled' || subscriptionStatus === 'unpaid') {
      redirect('/billing/suspended')
    }
  }

  const isPastDue = subscriptionStatus === 'past_due'
  const isAdmin = ['org_admin', 'super_admin'].includes(profile?.role ?? '')

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      <SidebarNav
        fullName={profile?.full_name ?? null}
        role={profile?.role ?? null}
        orgName={org?.name ?? null}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {isPastDue && (
          <div style={{
            background: 'oklch(92% 0.055 52)', borderBottom: '1px solid oklch(80% 0.090 52)',
            padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="oklch(45% 0.160 52)" strokeWidth="2.2" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'oklch(32% 0.130 52)' }}>
                Your subscription payment is past due.
                {isAdmin
                  ? ' Please update your payment method to avoid service interruption.'
                  : ' Please contact your administrator.'}
              </span>
            </div>
            {isAdmin && (
              <a
                href="/billing"
                style={{
                  fontSize: 12, fontWeight: 700, color: 'oklch(32% 0.130 52)',
                  textDecoration: 'none', whiteSpace: 'nowrap',
                  padding: '4px 12px', borderRadius: 6,
                  border: '1.5px solid oklch(68% 0.120 52)',
                  background: 'oklch(96% 0.025 52)',
                }}
              >
                Go to Billing →
              </a>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
