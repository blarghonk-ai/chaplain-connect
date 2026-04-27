'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Step =
  | 'loading'
  | 'totp-qr'      // admin: scan QR
  | 'phone-number' // member: enter phone
  | 'phone-otp'    // member: enter SMS code
  | 'success'

function MFASetupInner() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()
  const required = params.get('required') === '1'

  const [role, setRole] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('loading')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // TOTP state
  const [totpFactorId, setTotpFactorId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [totpCode, setTotpCode] = useState('')

  // Phone state
  const [phone, setPhone] = useState('')
  const [phoneFactorId, setPhoneFactorId] = useState('')
  const [phoneChallengeId, setPhoneChallengeId] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [phoneDisplay, setPhoneDisplay] = useState('')

  const isAdmin = role !== null && ['org_admin', 'super_admin'].includes(role)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const r = profile?.role ?? 'chaplain'
      setRole(r)

      if (['org_admin', 'super_admin'].includes(r)) {
        await enrollTotp()
      } else {
        // Members go straight to phone setup
        setStep('phone-number')
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function enrollTotp() {
    setBusy(true)
    setErr(null)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
      if (error) throw error
      setTotpFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setStep('totp-qr')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Setup failed')
    } finally {
      setBusy(false)
    }
  }

  async function verifyTotp() {
    setBusy(true)
    setErr(null)
    try {
      const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId: totpFactorId })
      if (cErr) throw cErr
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: totpFactorId,
        challengeId: ch.id,
        code: totpCode.replace(/\s/g, ''),
      })
      if (vErr) throw vErr
      setStep('success')
      setTimeout(() => router.push('/dashboard'), 1800)
    } catch {
      setErr('Incorrect code — try again.')
      setTotpCode('')
    } finally {
      setBusy(false)
    }
  }

  async function enrollPhone() {
    if (!phone.trim()) { setErr('Enter your phone number.'); return }
    setBusy(true)
    setErr(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.auth.mfa as any).enroll({
        factorType: 'phone',
        phone: phone.trim(),
      })
      if (error) throw error
      const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId: data.id })
      if (cErr) throw cErr
      setPhoneFactorId(data.id)
      setPhoneChallengeId(ch.id)
      setPhoneDisplay(phone.trim())
      setStep('phone-otp')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Could not send code.')
    } finally {
      setBusy(false)
    }
  }

  async function verifyPhone() {
    setBusy(true)
    setErr(null)
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: phoneFactorId,
        challengeId: phoneChallengeId,
        code: smsCode.replace(/\s/g, ''),
      })
      if (error) throw error
      setStep('success')
      setTimeout(() => router.push('/dashboard'), 1800)
    } catch {
      setErr('Incorrect code — try again.')
      setSmsCode('')
    } finally {
      setBusy(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
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
              Secure Your Account
            </div>
            <div style={{ fontSize: 11, color: 'var(--s-muted)', marginTop: 1 }}>
              Two-factor authentication · Chaplain Connect
            </div>
          </div>
        </div>

        <div style={{ padding: '32px 32px' }}>

          {/* Loading */}
          {step === 'loading' && (
            <p style={{ color: 'var(--m-muted)', fontSize: 14 }}>Setting up…</p>
          )}

          {/* ── TOTP: QR code ── */}
          {step === 'totp-qr' && (
            <div>
              {required && (
                <div style={{
                  background: 'oklch(96% 0.018 52)', border: '1px solid oklch(82% 0.060 52)',
                  borderRadius: 8, padding: '10px 14px', marginBottom: 20,
                  fontSize: 13, color: 'oklch(42% 0.160 52)',
                }}>
                  Your role requires an authenticator app. This takes about 2 minutes.
                </div>
              )}

              <p style={{ fontSize: 14, color: 'var(--m-muted)', lineHeight: 1.6, marginBottom: 20 }}>
                Open <strong style={{ color: 'var(--m-text)' }}>Google Authenticator</strong>,{' '}
                <strong style={{ color: 'var(--m-text)' }}>Authy</strong>, or any authenticator app and scan this code.
              </p>

              {/* QR code */}
              {qrCode && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                  <div style={{
                    background: 'white', border: '1px solid var(--m-border)',
                    borderRadius: 12, padding: 16,
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCode} alt="Authenticator QR code" width={180} height={180} />
                  </div>
                </div>
              )}

              {/* Manual entry */}
              <details style={{ marginBottom: 24 }}>
                <summary style={{
                  fontSize: 12.5, color: 'var(--m-green)', fontWeight: 600,
                  cursor: 'pointer', listStyle: 'none',
                }}>
                  Can&apos;t scan? Enter key manually
                </summary>
                <div style={{
                  marginTop: 10, background: 'var(--m-gl)',
                  border: '1px solid var(--m-border)', borderRadius: 8,
                  padding: '10px 14px',
                }}>
                  <p style={{ fontSize: 11, color: 'var(--m-muted)', marginBottom: 6 }}>
                    Enter this key in your authenticator app:
                  </p>
                  <code style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
                    color: 'var(--m-text)', letterSpacing: '0.08em',
                    wordBreak: 'break-all',
                  }}>
                    {secret}
                  </code>
                </div>
              </details>

              {/* Verify input */}
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--m-text)' }}>
                Enter the 6-digit code from your app
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000 000"
                maxLength={7}
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/[^0-9 ]/g, ''))}
                onKeyDown={e => e.key === 'Enter' && verifyTotp()}
                style={inputStyle}
              />

              {err && <p style={errStyle}>{err}</p>}

              <button
                onClick={verifyTotp}
                disabled={busy || totpCode.replace(/\s/g, '').length < 6}
                style={{ ...primaryBtn, marginTop: 16, width: '100%' }}
              >
                {busy ? 'Verifying…' : 'Verify & Activate'}
              </button>
            </div>
          )}

          {/* ── Phone: enter number ── */}
          {step === 'phone-number' && (
            <div>
              <p style={{ fontSize: 14, color: 'var(--m-muted)', lineHeight: 1.6, marginBottom: 20 }}>
                We&apos;ll send a verification code to your mobile number whenever you sign in.
                No app required.
              </p>

              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--m-text)' }}>
                Mobile phone number
              </label>
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                autoComplete="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && enrollPhone()}
                style={inputStyle}
              />
              <p style={{ fontSize: 11.5, color: 'var(--m-faint)', marginTop: 6 }}>
                Include country code, e.g. +1 for US/Canada
              </p>

              {err && <p style={errStyle}>{err}</p>}

              <button
                onClick={enrollPhone}
                disabled={busy || !phone.trim()}
                style={{ ...primaryBtn, marginTop: 16, width: '100%' }}
              >
                {busy ? 'Sending…' : 'Send Verification Code'}
              </button>

              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--m-border)' }}>
                <p style={{ fontSize: 12.5, color: 'var(--m-faint)', marginBottom: 10 }}>
                  Prefer an authenticator app instead?
                </p>
                <button
                  onClick={enrollTotp}
                  disabled={busy}
                  style={ghostBtn}
                >
                  Use authenticator app
                </button>
              </div>
            </div>
          )}

          {/* ── Phone: enter OTP ── */}
          {step === 'phone-otp' && (
            <div>
              <p style={{ fontSize: 14, color: 'var(--m-muted)', lineHeight: 1.6, marginBottom: 20 }}>
                We sent a 6-digit code to{' '}
                <strong style={{ color: 'var(--m-text)' }}>{phoneDisplay}</strong>.
                Enter it below to confirm.
              </p>

              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--m-text)' }}>
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={smsCode}
                onChange={e => setSmsCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && verifyPhone()}
                style={inputStyle}
              />

              {err && <p style={errStyle}>{err}</p>}

              <button
                onClick={verifyPhone}
                disabled={busy || smsCode.length < 6}
                style={{ ...primaryBtn, marginTop: 16, width: '100%' }}
              >
                {busy ? 'Verifying…' : 'Verify & Activate'}
              </button>

              <button
                onClick={() => setStep('phone-number')}
                style={{ ...ghostBtn, marginTop: 10, width: '100%' }}
              >
                Use a different number
              </button>
            </div>
          )}

          {/* ── Success ── */}
          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'oklch(95% 0.022 148)', margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="oklch(36% 0.160 148)" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--m-text)', marginBottom: 8 }}>
                Two-factor authentication active
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--m-muted)' }}>
                Your account is now secured. Redirecting…
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  fontSize: 15, fontFamily: 'var(--font-mono)',
  letterSpacing: '0.06em',
  border: '1.5px solid var(--m-border)', borderRadius: 8,
  background: 'var(--m-surface)', color: 'var(--m-text)',
  outline: 'none', boxSizing: 'border-box',
}

const primaryBtn: React.CSSProperties = {
  padding: '11px 20px', borderRadius: 8, border: 'none',
  background: 'var(--m-green)', color: 'white',
  fontSize: 14, fontWeight: 700, cursor: 'pointer',
}

const ghostBtn: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 8,
  border: '1.5px solid var(--m-border)',
  background: 'transparent', color: 'var(--m-muted)',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
}

const errStyle: React.CSSProperties = {
  fontSize: 13, color: 'oklch(42% 0.200 25)',
  background: 'oklch(97% 0.010 25)', border: '1px solid oklch(88% 0.040 25)',
  borderRadius: 6, padding: '8px 12px', marginTop: 10,
}

export default function MFASetupPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--m-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--m-muted)', fontSize: 14 }}>Loading…</p>
      </div>
    }>
      <MFASetupInner />
    </Suspense>
  )
}
