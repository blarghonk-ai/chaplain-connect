import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) redirect('/onboarding')

  const orgs = profile.organizations
  const org = (Array.isArray(orgs) ? orgs[0] : orgs) as { name: string; tier: string } | null

  const firstName = profile.full_name?.split(' ')[0] ?? 'Chaplain'

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const stats = [
    {
      label: 'Organization',
      value: org?.name ?? '—',
      note: org?.tier ?? 'Plan',
      dot: 'var(--m-green)',
    },
    {
      label: 'Your Role',
      value: profile.role?.replace('_', ' ') ?? '—',
      note: profile.role === 'super_admin' ? 'Full platform access' : profile.role === 'org_admin' ? 'Full org access' : 'Standard access',
      dot: 'oklch(58% 0.100 78)',
    },
    {
      label: 'Platform Status',
      value: 'Live',
      note: 'All systems operational',
      dot: 'oklch(36% 0.160 148)',
    },
    {
      label: 'GRC Frameworks',
      value: '12',
      note: 'SOC 2, ISO 27001, FedRAMP +',
      dot: 'oklch(42% 0.100 240)',
    },
  ]

  return (
    <>
      {/* Page header */}
      <div className="cc-page-header">
        <div>
          <div className="cc-page-eyebrow">{today}</div>
          <h1 className="cc-page-title">Good morning, {firstName}.</h1>
        </div>
        <Link
          href="/sessions"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8,
            background: 'var(--m-green)', color: 'white',
            fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
          }}
        >
          + New Session
        </Link>
      </div>

      {/* Page content */}
      <div style={{ flex: 1, background: 'var(--m-bg)' }}>
        <div className="cc-page-content" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* Scripture banner */}
          <div style={{
            borderRadius: 16, overflow: 'hidden', position: 'relative',
            background: 'var(--s-bg)', display: 'flex', minHeight: 160,
          }}>
            <div style={{ width: 5, background: 'var(--s-logo)', flexShrink: 0 }} />
            <div style={{ padding: '32px 44px', flex: 1 }}>
              <div style={{
                fontSize: 10.5, color: 'var(--s-muted)', letterSpacing: '0.12em',
                textTransform: 'uppercase', fontWeight: 700, marginBottom: 16,
              }}>
                Daily Scripture
              </div>
              <blockquote
                className="font-lora"
                style={{
                  fontSize: 19, fontStyle: 'italic',
                  color: 'var(--s-text)', lineHeight: 1.8, maxWidth: 700, marginBottom: 16,
                }}
              >
                &ldquo;The Lord is my shepherd; I shall not want. He makes me lie down in green
                pastures. He leads me beside still waters. He restores my soul.&rdquo;
              </blockquote>
              <div style={{ fontSize: 12.5, color: 'var(--s-muted)', fontWeight: 600 }}>
                Psalm 23:1–3 — ESV
              </div>
            </div>
            {/* Decorative cross */}
            <div style={{
              position: 'absolute', right: 48, top: '50%',
              transform: 'translateY(-50%)', opacity: 0.06, pointerEvents: 'none',
            }}>
              <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                <path d="M12 2v20 M2 12h20" />
              </svg>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {stats.map((s, i) => (
              <div key={i} style={{
                background: 'var(--m-surface)', border: '1px solid var(--m-border)',
                borderRadius: 12, padding: '20px 22px',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                  <div style={{ fontSize: 11, color: 'var(--m-muted)', fontWeight: 600, letterSpacing: '0.04em' }}>
                    {s.label}
                  </div>
                </div>
                <div style={{
                  fontSize: s.value.length > 6 ? 18 : 30,
                  fontWeight: 800, color: 'var(--m-text)',
                  letterSpacing: '-0.03em', lineHeight: 1.1,
                }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--m-faint)' }}>{s.note}</div>
              </div>
            ))}
          </div>

          {/* Platform status */}
          <div style={{
            background: 'var(--m-surface)', border: '1px solid var(--m-border)',
            borderRadius: 12, padding: '24px 28px',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 16,
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--m-text)', letterSpacing: '-0.01em' }}>
                Platform Status
              </h2>
              <span style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
                padding: '3px 8px', borderRadius: 5,
                background: 'var(--m-gl)', color: 'var(--m-green)', textTransform: 'uppercase',
              }}>
                Live
              </span>
            </div>
            <ul style={{ fontSize: 13.5, color: 'var(--m-muted)', lineHeight: 2.2, listStyle: 'none', padding: 0 }}>
              <li>✅ Multi-tenant organization setup</li>
              <li>✅ Authentication (email, magic link, Google OAuth)</li>
              <li>✅ Role-based access control + Row Level Security</li>
              <li>✅ Audit log (hash-chained, tamper-evident)</li>
              <li>✅ Real-time chat (Supabase Realtime)</li>
              <li>✅ Scripture browser (1000+ translations)</li>
              <li>✅ AI Chaplain Assistant</li>
              <li>✅ GRC Engine (12 compliance frameworks)</li>
              <li>✅ Privacy management suite</li>
              <li style={{ color: 'var(--m-faint)' }}>⏳ Live video sessions — connect LiveKit</li>
              <li style={{ color: 'var(--m-faint)' }}>⏳ Appointment scheduling — connect Cal.com</li>
              <li style={{ color: 'var(--m-faint)' }}>⏳ Stripe billing — connect keys</li>
            </ul>
          </div>

        </div>
      </div>
    </>
  )
}
