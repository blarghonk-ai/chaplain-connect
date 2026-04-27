'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type FactorType = 'totp' | 'phone' | null

export default function MFAVerifyPage() {
  const supabase = createClient()
  const router = useRouter()

  const [factorType, setFactorType] = useState<FactorType>(null)
  const [factorId, setFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [code, setCode] = useState('')
  const [phoneHint, setPhoneHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Check if already at aal2 — if so, no need to verify
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.currentLevel === 'aal2') { router.push('/dashboard'); return }

      // Find the verified factor to challenge
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totp = factors?.totp?.find(f => f.status === 'verified')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const phone = (factors as any)?.phone?.find((f: any) => f.status === 'verified')

      const factor = totp ?? phone
      if (!factor) {
        // No verified factor — send to setup
        router.push('/mfa/setup?required=1')
        return
      }

      const type: FactorType = totp ? 'totp' : 'phone'
      setFactorType(type)
      setFactorId(factor.id)
      if (type === 'phone') setPhoneHint(factor.phone ?? '')

      // Create challenge (for phone, this triggers an SMS)
      const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId: factor.id })
      if (cErr) { setErr('Could not initiate challenge. Try again.'); setLoading(false); return }
      setChallengeId(ch.id)
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function verify() {
    setBusy(true)
    setErr(null)
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: code.replace(/\s/g, ''),
      })
      if (error) throw error
      router.push('/dashboard')
    } catch {
      setErr('Incorrect code — please try again.')
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  const isTotp = factorType === 'totp'
  const isPhone = factorType === 'phone'

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--m-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
    }}>
      <div style={{
        background: 'var(--m-surface)', border: '1px solid var(--m-border)',
        borderRadius: 16, width: '100%', maxWidth: 420,
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
              Verify Identity
            </div>
            <div style={{ fontSize: 11, color: 'var(--s-muted)', marginTop: 1 }}>
              Two-factor authentication · Chaplain Connect
            </div>
          </div>
        </div>

        <div style={{ padding: '32px 32px' }}>
          {loading ? (
            <p style={{ fontSize: 14, color: 'var(--m-muted)' }}>
              {isPhone ? 'Sending verification code…' : 'Loading…'}
            </p>
          ) : (
            <>
              <p style={{ fontSize: 14, color: 'var(--m-muted)', lineHeight: 1.6, marginBottom: 24 }}>
                {isTotp && 'Enter the 6-digit code from your authenticator app to continue.'}
                {isPhone && (
                  <>
                    We sent a verification code to{' '}
                    <strong style={{ color: 'var(--m-text)' }}>
                      {phoneHint || 'your phone'}
                    </strong>.
                  </>
                )}
              </p>

              <label style={{
                display: 'block', marginBottom: 6,
                fontSize: 13, fontWeight: 600, color: 'var(--m-text)',
              }}>
                {isTotp ? 'Authenticator code' : 'Verification code'}
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder={isTotp ? '000 000' : '000000'}
                maxLength={isTotp ? 7 : 6}
                value={code}
                onChange={e => setCode(
                  isTotp
                    ? e.target.value.replace(/[^0-9 ]/g, '')
                    : e.target.value.replace(/\D/g, '')
                )}
                onKeyDown={e => e.key === 'Enter' && !busy && verify()}
                style={{
                  width: '100%', padding: '12px 14px',
                  fontSize: 22, fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.12em', textAlign: 'center',
                  border: '1.5px solid var(--m-border)', borderRadius: 8,
                  background: 'var(--m-surface)', color: 'var(--m-text)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />

              {err && (
                <div style={{
                  fontSize: 13, color: 'oklch(42% 0.200 25)',
                  background: 'oklch(97% 0.010 25)', border: '1px solid oklch(88% 0.040 25)',
                  borderRadius: 6, padding: '8px 12px', marginTop: 10,
                }}>
                  {err}
                </div>
              )}

              <button
                onClick={verify}
                disabled={busy || code.replace(/\s/g, '').length < 6}
                style={{
                  width: '100%', marginTop: 16,
                  padding: '12px 20px', borderRadius: 8, border: 'none',
                  background: 'var(--m-green)', color: 'white',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {busy ? 'Verifying…' : 'Verify & Sign In'}
              </button>

              {isTotp && (
                <p style={{ fontSize: 12, color: 'var(--m-faint)', textAlign: 'center', marginTop: 16 }}>
                  Open your authenticator app to find the current code.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
