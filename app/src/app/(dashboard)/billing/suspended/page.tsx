import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SuspendedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) redirect('/onboarding')

  // If subscription is active again, redirect back
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('org_id', profile.org_id)
    .single()

  if (sub?.status === 'active' || sub?.status === 'trialing') {
    redirect('/dashboard')
  }

  const isAdmin = ['org_admin', 'super_admin'].includes(profile.role)

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--m-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
    }}>
      <div style={{
        background: 'var(--m-surface)', border: '1px solid var(--m-border)',
        borderRadius: 16, width: '100%', maxWidth: 480,
        boxShadow: '0 4px 24px oklch(0% 0 0 / 0.08)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'var(--s-bg)', padding: '22px 32px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: 'var(--s-active)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="var(--s-logo)" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 2v20 M2 12h20" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--s-text)', letterSpacing: '-0.01em' }}>
              Subscription Suspended
            </div>
            <div style={{ fontSize: 11, color: 'var(--s-muted)', marginTop: 1 }}>
              Chaplain Connect
            </div>
          </div>
        </div>

        <div style={{ padding: '32px 32px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'oklch(95% 0.018 25)', margin: '0 0 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="oklch(50% 0.200 25)" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4 M12 16h.01" />
            </svg>
          </div>

          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--m-text)', marginBottom: 10 }}>
            Your account has been suspended
          </h2>

          <p style={{ fontSize: 14, color: 'var(--m-muted)', lineHeight: 1.6, marginBottom: 24 }}>
            {isAdmin
              ? 'Access to Chaplain Connect has been suspended due to a billing issue. Please update your payment method to restore access for your organization.'
              : 'Your organization\'s subscription has lapsed. Please contact your administrator to resolve the billing issue.'}
          </p>

          {isAdmin ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <form action="/api/billing/portal" method="POST">
                <button type="submit" style={{
                  width: '100%', padding: '12px 20px', borderRadius: 8, border: 'none',
                  background: 'var(--m-green)', color: 'white',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>
                  Update payment method
                </button>
              </form>
              <a href="mailto:billing@chaplainconnect.com" style={{
                display: 'block', textAlign: 'center', padding: '10px 20px',
                borderRadius: 8, border: '1.5px solid var(--m-border)',
                color: 'var(--m-muted)', fontSize: 13, fontWeight: 600,
                textDecoration: 'none',
              }}>
                Contact billing support
              </a>
            </div>
          ) : (
            <a href="mailto:billing@chaplainconnect.com" style={{
              display: 'block', textAlign: 'center', padding: '12px 20px',
              borderRadius: 8, border: '1.5px solid var(--m-border)',
              color: 'var(--m-muted)', fontSize: 13, fontWeight: 600,
              textDecoration: 'none',
            }}>
              Contact your administrator
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
