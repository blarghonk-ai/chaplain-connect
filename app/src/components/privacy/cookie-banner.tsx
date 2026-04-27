'use client'

import { useEffect, useRef, useState } from 'react'
import {
  COOKIE_CATEGORIES,
  JURISDICTION_LABELS,
  JURISDICTION_MESSAGES,
  type OptionalCategoryKey,
} from './cookie-categories'

const ANON_KEY = 'cc_anon_id'
const CONSENT_KEY = 'cc_cookie_consent'

type BannerState = 'hidden' | 'banner' | 'center'
type Prefs = Record<OptionalCategoryKey, boolean>

const DEFAULT_PREFS: Prefs = {
  functional: false,
  analytics: false,
  marketing: false,
  personalization: false,
}

function getOrCreateAnonId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(ANON_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(ANON_KEY, id)
  }
  return id
}

function detectJurisdiction(): string {
  if (typeof window === 'undefined') return 'default'
  const lang = (navigator.language ?? '').toLowerCase()
  if (/^(de|fr|it|es|nl|pl|sv|da|fi|cs|hu|ro|bg|hr|sk|sl|et|lv|lt)\b/.test(lang)) return 'EU'
  if (/^en-gb\b/.test(lang)) return 'UK'
  if (/^en-ca\b/.test(lang)) return 'CA'
  if (/^pt-br\b/.test(lang)) return 'BR'
  if (/^zh\b/.test(lang)) return 'CN'
  if (/^ja\b/.test(lang)) return 'JP'
  if (/^ko\b/.test(lang)) return 'KR'
  if (/^en\b/.test(lang)) return 'US'
  return 'default'
}

export default function CookieBanner() {
  const [state, setState] = useState<BannerState>('hidden')
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [jurisdiction, setJurisdiction] = useState('default')
  const fromBannerRef = useRef(true)  // track whether center was opened from the banner

  useEffect(() => {
    const jur = detectJurisdiction()
    setJurisdiction(jur)

    const existing = localStorage.getItem(CONSENT_KEY)

    // Listen for "manage preferences" custom event dispatched by CookiePreferencesButton
    function onShowPrefs() {
      if (existing) {
        try {
          const saved = JSON.parse(existing)
          setPrefs({
            functional: saved.functional ?? false,
            analytics: saved.analytics ?? false,
            marketing: saved.marketing ?? false,
            personalization: saved.personalization ?? false,
          })
        } catch { /* ignore */ }
      }
      fromBannerRef.current = false
      setState('center')
    }

    window.addEventListener('cc:show-prefs', onShowPrefs)

    if (!existing) {
      fromBannerRef.current = true
      const t = setTimeout(() => setState('banner'), 700)
      return () => {
        clearTimeout(t)
        window.removeEventListener('cc:show-prefs', onShowPrefs)
      }
    }

    return () => window.removeEventListener('cc:show-prefs', onShowPrefs)
  }, [])

  async function save(acceptAll: boolean, rejectAll = false) {
    setSaving(true)
    const anonId = getOrCreateAnonId()
    const chosen: Prefs = acceptAll
      ? { functional: true, analytics: true, marketing: true, personalization: true }
      : rejectAll
      ? { ...DEFAULT_PREFS }
      : prefs

    try {
      await fetch('/api/consent/cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymous_id: anonId, ...chosen }),
      })
      localStorage.setItem(
        CONSENT_KEY,
        JSON.stringify({ ...chosen, at: Date.now(), jurisdiction }),
      )
    } finally {
      setSaving(false)
      setState('hidden')
    }
  }

  function openCenter() {
    fromBannerRef.current = true
    setState('center')
  }
  function closeCenter() {
    setState(fromBannerRef.current ? 'banner' : 'hidden')
  }

  function toggleExpanded(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const msg = JURISDICTION_MESSAGES[jurisdiction] ?? JURISDICTION_MESSAGES.default

  if (state === 'hidden') return null

  // ── Compact banner ────────────────────────────────────────────────────
  if (state === 'banner') {
    return (
      <div
        role="dialog"
        aria-label="Cookie consent"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          background: 'var(--m-surface)',
          borderTop: '1px solid var(--m-border)',
          boxShadow: '0 -4px 24px oklch(0% 0 0 / 0.09)',
        }}
      >
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '14px 24px',
          display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
        }}>
          {/* Cross logo */}
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--s-active)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="var(--s-logo)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2v20 M2 12h20" />
            </svg>
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 240 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--m-text)' }}>
              {msg.headline}
            </span>{' '}
            <span style={{ fontSize: 13.5, color: 'var(--m-muted)', lineHeight: 1.5 }}>
              {msg.body}
            </span>
            {msg.regulation && (
              <span style={{
                marginLeft: 6, fontSize: 10.5, fontWeight: 700,
                background: 'var(--m-gl)', color: 'var(--m-green)',
                padding: '2px 7px', borderRadius: 4, letterSpacing: '0.04em',
              }}>
                {msg.regulation}
              </span>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => save(false, true)}
              disabled={saving}
              style={ghostBtnStyle}
            >
              Essential Only
            </button>
            <button onClick={openCenter} style={secondaryBtnStyle}>
              Customize
            </button>
            <button
              onClick={() => save(true)}
              disabled={saving}
              style={primaryBtnStyle}
            >
              {saving ? 'Saving…' : 'Accept All'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Preference center modal ───────────────────────────────────────────
  const anonId = getOrCreateAnonId()

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cookie Preference Center"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'oklch(0% 0 0 / 0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: 'var(--m-surface)', borderRadius: 16,
        width: '100%', maxWidth: 660,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 64px oklch(0% 0 0 / 0.28)',
        border: '1px solid var(--m-border)',
      }}>

        {/* ── Modal header ── */}
        <div style={{
          background: 'var(--s-bg)', padding: '18px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, background: 'var(--s-active)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="var(--s-logo)" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2v20 M2 12h20" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--s-text)', letterSpacing: '-0.01em' }}>
                Cookie Preference Center
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--s-muted)', marginTop: 1 }}>
                {JURISDICTION_LABELS[jurisdiction] ?? JURISDICTION_LABELS.default}
                {' · '}Chaplain Connect
              </div>
            </div>
          </div>
          <button
            onClick={closeCenter}
            title="Close"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--s-muted)', padding: 6, borderRadius: 6,
              display: 'flex', alignItems: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Intro strip ── */}
        <div style={{
          padding: '12px 24px', flexShrink: 0,
          background: 'var(--m-gl)', borderBottom: '1px solid var(--m-border)',
        }}>
          <p style={{ fontSize: 13, color: 'var(--m-muted)', lineHeight: 1.65, margin: 0 }}>
            {msg.body}{' '}
            Choices are stored for 1 year and can be updated at any time.{' '}
            <a href="/privacy" style={{ color: 'var(--m-green)', fontWeight: 600, textDecoration: 'none' }}>
              Privacy Policy
            </a>
            {' · '}
            <a href="/privacy#cookies" style={{ color: 'var(--m-green)', fontWeight: 600, textDecoration: 'none' }}>
              Cookie Policy
            </a>
          </p>
        </div>

        {/* ── Categories ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {COOKIE_CATEGORIES.map((cat, idx) => {
            const isOn = cat.alwaysOn
              ? true
              : prefs[cat.key as OptionalCategoryKey]
            const isExp = expanded.has(cat.key)
            const isLast = idx === COOKIE_CATEGORIES.length - 1

            return (
              <div
                key={cat.key}
                style={{ borderBottom: isLast ? 'none' : '1px solid var(--m-border)' }}
              >
                <div style={{ padding: '16px 24px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {/* Toggle */}
                  <div style={{ paddingTop: 2, flexShrink: 0 }}>
                    {cat.alwaysOn ? (
                      <div style={{
                        fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em',
                        background: 'var(--m-gl)', color: 'var(--m-green)',
                        padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap',
                        border: '1px solid var(--m-glb)',
                      }}>
                        ALWAYS ON
                      </div>
                    ) : (
                      <button
                        role="switch"
                        aria-checked={isOn}
                        onClick={() =>
                          setPrefs(p => ({
                            ...p,
                            [cat.key as OptionalCategoryKey]: !p[cat.key as OptionalCategoryKey],
                          }))
                        }
                        style={{
                          width: 42, height: 24, borderRadius: 12, border: 'none',
                          cursor: 'pointer', position: 'relative',
                          background: isOn ? 'var(--m-green)' : 'var(--m-border)',
                          transition: 'background 0.18s', flexShrink: 0,
                          outline: 'none',
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 3,
                          left: isOn ? 21 : 3,
                          width: 18, height: 18, borderRadius: '50%',
                          background: 'white',
                          transition: 'left 0.18s',
                          boxShadow: '0 1px 3px oklch(0% 0 0 / 0.25)',
                        }} />
                      </button>
                    )}
                  </div>

                  {/* Text content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--m-text)' }}>
                        {cat.label}
                      </span>
                      <span style={{
                        fontSize: 10.5, color: 'var(--m-faint)',
                        fontStyle: 'italic',
                      }}>
                        {cat.legalBasis}
                      </span>
                    </div>
                    <p style={{ fontSize: 12.5, color: 'var(--m-muted)', lineHeight: 1.55, margin: '0 0 6px' }}>
                      {cat.description}
                    </p>

                    {cat.entries.length > 0 ? (
                      <>
                        <button
                          onClick={() => toggleExpanded(cat.key)}
                          style={{
                            fontSize: 12, color: 'var(--m-green)', fontWeight: 600,
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: 0, display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <svg
                            width="10" height="10" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                            style={{ transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                          {isExp ? 'Hide' : 'Show'} {cat.entries.length} {cat.entries.length === 1 ? 'entry' : 'entries'}
                        </button>

                        {isExp && (
                          <div style={{
                            marginTop: 10, borderRadius: 8, overflow: 'hidden',
                            border: '1px solid var(--m-border)',
                          }}>
                            {/* Table header */}
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: '130px 1fr 70px 110px',
                              padding: '7px 12px',
                              background: 'var(--m-gl)',
                              borderBottom: '1px solid var(--m-border)',
                            }}>
                              {['Name / Key', 'Purpose', 'Duration', 'Provider'].map(h => (
                                <div key={h} style={{
                                  fontSize: 9.5, fontWeight: 800, color: 'var(--m-muted)',
                                  textTransform: 'uppercase', letterSpacing: '0.07em',
                                }}>
                                  {h}
                                </div>
                              ))}
                            </div>
                            {cat.entries.map((entry, i) => (
                              <div
                                key={i}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '130px 1fr 70px 110px',
                                  padding: '8px 12px',
                                  borderBottom: i < cat.entries.length - 1
                                    ? '1px solid var(--m-border)'
                                    : 'none',
                                  background: i % 2 === 1 ? 'var(--m-gl)' : 'transparent',
                                }}
                              >
                                <div style={{
                                  fontSize: 11, fontFamily: 'var(--font-mono)',
                                  color: 'var(--m-text)', fontWeight: 500,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {entry.name}
                                </div>
                                <div style={{ fontSize: 11.5, color: 'var(--m-muted)', paddingRight: 8 }}>
                                  {entry.purpose}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--m-faint)' }}>
                                  {entry.duration}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--m-faint)' }}>
                                  {entry.provider}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: 11.5, color: 'var(--m-faint)', fontStyle: 'italic' }}>
                        No entries currently in this category
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid var(--m-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, flexWrap: 'wrap', gap: 10,
          background: 'var(--m-surface)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--m-faint)', fontFamily: 'var(--font-mono)' }}>
            Consent ID: {anonId.slice(0, 8)}…
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => save(false, true)}
              disabled={saving}
              style={ghostBtnStyle}
            >
              Essential Only
            </button>
            <button
              onClick={() => save(false)}
              disabled={saving}
              style={secondaryBtnStyle}
            >
              {saving ? 'Saving…' : 'Save Preferences'}
            </button>
            <button
              onClick={() => save(true)}
              disabled={saving}
              style={primaryBtnStyle}
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shared button styles ──────────────────────────────────────────────────

const primaryBtnStyle: React.CSSProperties = {
  padding: '9px 20px', borderRadius: 7, border: 'none',
  background: 'var(--m-green)', color: 'white',
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 7,
  border: '1.5px solid var(--m-glb)',
  background: 'var(--m-gl)', color: 'var(--m-green)',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
}

const ghostBtnStyle: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 7,
  border: '1.5px solid var(--m-border)',
  background: 'transparent', color: 'var(--m-muted)',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
