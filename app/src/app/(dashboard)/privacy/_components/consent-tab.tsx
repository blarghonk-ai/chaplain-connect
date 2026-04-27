'use client'

import { useEffect, useState } from 'react'
import CookiePreferencesButton from '@/components/privacy/cookie-preferences-button'
import { JURISDICTION_LABELS } from '@/components/privacy/cookie-categories'

// ── Types ─────────────────────────────────────────────────────────────────

interface ConsentRecord {
  id: string
  purpose: string
  legal_basis: string
  regulation_short: string | null
  granted_at: string
  withdrawn_at: string | null
  is_active: boolean
  consent_version: string
}

interface WithdrawalEvent {
  id: string
  purpose: string
  withdrawn_at: string
  status: string
}

interface CookieStats {
  total: number
  active: number
  withdrawn: number
  categories: {
    functional: number
    analytics: number
    marketing: number
    personalization: number
  }
  byJurisdiction: Record<string, number>
  recent: {
    jurisdiction: string
    functional: boolean
    analytics: boolean
    marketing: boolean
    personalization: boolean
    granted_at: string
    withdrawn_at: string | null
  }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────

const PURPOSE_LABELS: Record<string, string> = {
  marketing_communications: 'Marketing Communications',
  analytics_tracking: 'Analytics & Tracking',
  personalization: 'Personalization',
  third_party_sharing: 'Third-Party Sharing',
  research: 'Research & Development',
  ai_training: 'AI Model Training',
}

const BASIS_COLORS: Record<string, { bg: string; color: string }> = {
  consent:              { bg: 'oklch(96% 0.018 235)', color: 'oklch(35% 0.160 235)' },
  legitimate_interest:  { bg: 'oklch(95% 0.016 290)', color: 'oklch(35% 0.120 290)' },
  contract:             { bg: 'oklch(95% 0.022 148)', color: 'oklch(36% 0.140 148)' },
  legal_obligation:     { bg: 'oklch(96% 0.020 52)',  color: 'oklch(42% 0.160 52)'  },
  vital_interests:      { bg: 'oklch(96% 0.018 25)',  color: 'oklch(42% 0.200 25)'  },
  public_task:          { bg: 'var(--m-gl)',           color: 'var(--m-muted)'       },
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:    { bg: 'oklch(96% 0.018 75)',  color: 'oklch(48% 0.150 75)'  },
  processing: { bg: 'oklch(96% 0.018 235)', color: 'oklch(35% 0.160 235)' },
  completed:  { bg: 'oklch(95% 0.022 148)', color: 'oklch(36% 0.140 148)' },
  failed:     { bg: 'oklch(96% 0.018 25)',  color: 'oklch(42% 0.200 25)'  },
}

function Tag({
  label, bg = 'var(--m-gl)', color = 'var(--m-green)',
}: { label: string; bg?: string; color?: string }) {
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em',
      padding: '2px 8px', borderRadius: 4,
      background: bg, color,
      textTransform: 'uppercase',
    }}>
      {label}
    </span>
  )
}

// ── Cookie Consent Stats section ──────────────────────────────────────────

function CookieConsentSection() {
  const [stats, setStats] = useState<CookieStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRecent, setShowRecent] = useState(false)

  useEffect(() => {
    fetch('/api/consent/cookie-stats')
      .then(r => r.json())
      .then(d => { if (!d.error) setStats(d) })
      .finally(() => setLoading(false))
  }, [])

  const rate = (n: number) =>
    stats && stats.active > 0 ? Math.round((n / stats.active) * 100) : 0

  return (
    <div style={{
      background: 'var(--m-surface)', border: '1px solid var(--m-border)',
      borderRadius: 12, overflow: 'hidden', marginBottom: 28,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 22px', background: 'var(--s-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6, background: 'var(--s-active)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="var(--s-logo)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2v20 M2 12h20" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--s-text)' }}>
              Cookie Consent Records
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--s-muted)' }}>
              Agentic consent management · All jurisdictions
            </div>
          </div>
        </div>
        <CookiePreferencesButton
          style={{
            padding: '6px 14px', borderRadius: 6,
            border: '1.5px solid var(--s-border)',
            background: 'var(--s-hover)', color: 'var(--s-text)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Preview Banner
        </CookiePreferencesButton>
      </div>

      <div style={{ padding: '18px 22px' }}>
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--m-faint)' }}>Loading consent metrics…</p>
        ) : !stats ? (
          <p style={{ fontSize: 13, color: 'var(--m-faint)' }}>No data available.</p>
        ) : (
          <>
            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Total Records', value: stats.total, dot: 'var(--m-green)' },
                { label: 'Active', value: stats.active, dot: 'oklch(36% 0.160 148)' },
                { label: 'Withdrawn', value: stats.withdrawn, dot: 'oklch(42% 0.200 25)' },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'var(--m-gl)', border: '1px solid var(--m-border)',
                  borderRadius: 8, padding: '12px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--m-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {s.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--m-text)', letterSpacing: '-0.03em' }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Category opt-in rates */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--m-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
                Category Opt-In Rates (active records)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(Object.entries(stats.categories) as [string, number][]).map(([key, count]) => {
                  const pct = rate(count)
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 100, fontSize: 12.5, fontWeight: 600, color: 'var(--m-text)', textTransform: 'capitalize' }}>
                        {key}
                      </div>
                      <div style={{ flex: 1, height: 7, background: 'var(--m-border)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%',
                          background: pct > 50 ? 'var(--m-green)' : 'oklch(48% 0.150 75)',
                          borderRadius: 4, transition: 'width 0.3s',
                        }} />
                      </div>
                      <div style={{ width: 60, fontSize: 12, color: 'var(--m-muted)', textAlign: 'right' }}>
                        {pct}% ({count})
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Jurisdiction breakdown */}
            {Object.keys(stats.byJurisdiction).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--m-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
                  By Jurisdiction
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(stats.byJurisdiction).map(([jur, count]) => (
                    <div key={jur} style={{
                      fontSize: 12, background: 'var(--m-gl)', border: '1px solid var(--m-border)',
                      borderRadius: 6, padding: '5px 10px',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ fontWeight: 600, color: 'var(--m-text)' }}>
                        {JURISDICTION_LABELS[jur] ?? jur}
                      </span>
                      <span style={{
                        fontSize: 10.5, fontWeight: 800,
                        background: 'var(--m-green)', color: 'white',
                        borderRadius: 10, padding: '1px 6px',
                      }}>
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent records toggle */}
            {stats.recent.length > 0 && (
              <div>
                <button
                  onClick={() => setShowRecent(r => !r)}
                  style={{
                    fontSize: 12, color: 'var(--m-green)', fontWeight: 600,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    style={{ transform: showRecent ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                  {showRecent ? 'Hide' : 'Show'} recent records ({stats.recent.length})
                </button>

                {showRecent && (
                  <div style={{ marginTop: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--m-border)' }}>
                    {/* Header */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '100px 60px 60px 60px 60px 100px',
                      padding: '7px 12px', background: 'var(--m-gl)',
                      borderBottom: '1px solid var(--m-border)',
                    }}>
                      {['Jurisdiction', 'Func', 'Analytics', 'Market', 'Personal', 'Date'].map(h => (
                        <div key={h} style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--m-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {h}
                        </div>
                      ))}
                    </div>
                    {stats.recent.map((r, i) => (
                      <div key={i} style={{
                        display: 'grid', gridTemplateColumns: '100px 60px 60px 60px 60px 100px',
                        padding: '7px 12px',
                        borderBottom: i < stats.recent.length - 1 ? '1px solid var(--m-border)' : 'none',
                        background: i % 2 === 1 ? 'var(--m-gl)' : 'transparent',
                      }}>
                        <div style={{ fontSize: 11, color: 'var(--m-muted)' }}>
                          {JURISDICTION_LABELS[r.jurisdiction]?.split(' · ')[0] ?? r.jurisdiction}
                        </div>
                        {(['functional', 'analytics', 'marketing', 'personalization'] as const).map(k => (
                          <div key={k} style={{ fontSize: 11 }}>
                            {r[k]
                              ? <span style={{ color: 'oklch(36% 0.160 148)' }}>✓</span>
                              : <span style={{ color: 'var(--m-faint)' }}>–</span>}
                          </div>
                        ))}
                        <div style={{ fontSize: 10.5, color: 'var(--m-faint)', fontFamily: 'var(--font-mono)' }}>
                          {new Date(r.granted_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Main ConsentTab component ─────────────────────────────────────────────

export default function ConsentTab() {
  const [consents, setConsents] = useState<ConsentRecord[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [withdrawing, setWithdrawing] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/consent/grant').then(r => r.json()),
      fetch('/api/consent/withdrawals').then(r => r.json()),
    ]).then(([consentData, withdrawalData]) => {
      setConsents(consentData.consents ?? [])
      setWithdrawals(withdrawalData.withdrawals ?? [])
    }).finally(() => setLoading(false))
  }, [])

  async function withdrawConsent(purpose: string) {
    setWithdrawing(purpose)
    try {
      await fetch('/api/consent/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose }),
      })
      const [consentData, withdrawalData] = await Promise.all([
        fetch('/api/consent/grant').then(r => r.json()),
        fetch('/api/consent/withdrawals').then(r => r.json()),
      ])
      setConsents(consentData.consents ?? [])
      setWithdrawals(withdrawalData.withdrawals ?? [])
    } finally {
      setWithdrawing(null)
    }
  }

  const activeConsents = consents.filter(c => c.is_active)
  const historicConsents = consents.filter(c => !c.is_active)

  return (
    <div>
      {/* Cookie consent platform overview (super_admin) */}
      <CookieConsentSection />

      {/* ── User's own consent grants ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--m-text)', marginBottom: 12 }}>
          Your Active Consent Grants{' '}
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--m-muted)' }}>
            ({activeConsents.length})
          </span>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--m-faint)' }}>Loading consent records…</p>
        ) : activeConsents.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--m-faint)' }}>No active consent records.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeConsents.map(c => {
              const basis = BASIS_COLORS[c.legal_basis] ?? { bg: 'var(--m-gl)', color: 'var(--m-muted)' }
              return (
                <div key={c.id} style={{
                  background: 'var(--m-surface)', border: '1px solid var(--m-border)',
                  borderRadius: 10, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--m-text)' }}>
                        {PURPOSE_LABELS[c.purpose] ?? c.purpose.replace(/_/g, ' ')}
                      </span>
                      <Tag label={c.legal_basis.replace(/_/g, ' ')} bg={basis.bg} color={basis.color} />
                      {c.regulation_short && (
                        <span style={{
                          fontSize: 10.5, fontFamily: 'var(--font-mono)',
                          background: 'var(--m-gl)', color: 'var(--m-muted)',
                          padding: '2px 6px', borderRadius: 4,
                        }}>
                          {c.regulation_short}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--m-faint)' }}>
                      Granted {new Date(c.granted_at).toLocaleDateString()} · v{c.consent_version}
                    </span>
                  </div>
                  <button
                    disabled={withdrawing === c.purpose}
                    onClick={() => withdrawConsent(c.purpose)}
                    style={{
                      padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      border: '1.5px solid oklch(78% 0.060 25)', cursor: 'pointer',
                      background: 'transparent', color: 'oklch(42% 0.200 25)', flexShrink: 0,
                    }}
                  >
                    {withdrawing === c.purpose ? 'Withdrawing…' : 'Withdraw'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Withdrawal log */}
      {withdrawals.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--m-text)', marginBottom: 12 }}>
            Withdrawal Log
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {withdrawals.map(w => {
              const statusStyle = STATUS_COLORS[w.status] ?? { bg: 'var(--m-gl)', color: 'var(--m-muted)' }
              return (
                <div key={w.id} style={{
                  background: 'var(--m-surface)', border: '1px solid var(--m-border)',
                  borderRadius: 10, padding: '10px 16px', opacity: 0.8,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--m-text)', marginBottom: 2 }}>
                      {PURPOSE_LABELS[w.purpose] ?? w.purpose.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--m-faint)' }}>
                      Withdrawn {new Date(w.withdrawn_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Tag label={w.status} bg={statusStyle.bg} color={statusStyle.color} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Consent history */}
      {historicConsents.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--m-muted)', marginBottom: 10 }}>
            Consent History
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {historicConsents.map((c, i) => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, fontSize: 12,
                color: 'var(--m-faint)', padding: '8px 0',
                borderBottom: i < historicConsents.length - 1 ? '1px solid var(--m-border)' : 'none',
              }}>
                <span style={{ flex: 1, fontWeight: 500 }}>
                  {PURPOSE_LABELS[c.purpose] ?? c.purpose.replace(/_/g, ' ')}
                </span>
                <span>Granted {new Date(c.granted_at).toLocaleDateString()}</span>
                {c.withdrawn_at && (
                  <span>Withdrawn {new Date(c.withdrawn_at).toLocaleDateString()}</span>
                )}
                <span style={{ textDecoration: 'line-through', opacity: 0.5 }}>inactive</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
