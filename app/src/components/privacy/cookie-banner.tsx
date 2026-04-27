'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

const ANON_KEY = 'cc_anon_id'
const CONSENT_KEY = 'cc_cookie_consent'

function getOrCreateAnonId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(ANON_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(ANON_KEY, id)
  }
  return id
}

interface Preferences {
  functional: boolean
  analytics: boolean
  marketing: boolean
  personalization: boolean
}

export default function CookieBanner() {
  const [show, setShow] = useState(false)
  const [showManage, setShowManage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [prefs, setPrefs] = useState<Preferences>({
    functional: false,
    analytics: false,
    marketing: false,
    personalization: false,
  })

  useEffect(() => {
    // Only show if no consent decision recorded
    const hasConsent = localStorage.getItem(CONSENT_KEY)
    if (!hasConsent) {
      // Small delay so it doesn't flash immediately on load
      const t = setTimeout(() => setShow(true), 800)
      return () => clearTimeout(t)
    }
  }, [])

  async function saveConsent(acceptAll: boolean) {
    setSaving(true)
    const anonId = getOrCreateAnonId()
    const chosen = acceptAll
      ? { functional: true, analytics: true, marketing: true, personalization: true }
      : prefs

    try {
      await fetch('/api/consent/cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymous_id: anonId, ...chosen }),
      })
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...chosen, at: Date.now() }))
    } finally {
      setSaving(false)
      setShow(false)
    }
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t shadow-lg">
      {!showManage ? (
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">We use cookies</span> to provide and improve our services.
            By continuing, you agree to our use of essential cookies.{' '}
            <button className="underline text-foreground" onClick={() => setShowManage(true)}>
              Manage preferences
            </button>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowManage(true)}>
              Manage
            </Button>
            <Button size="sm" disabled={saving} onClick={() => saveConsent(true)}>
              {saving ? 'Saving…' : 'Accept All'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto space-y-4">
          <div>
            <p className="font-semibold text-sm">Cookie Preferences</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose which cookies you allow. Essential cookies are always active.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              { key: 'functional' as const, label: 'Functional', desc: 'Remember your preferences and settings' },
              { key: 'analytics' as const, label: 'Analytics', desc: 'Understand how you use the platform' },
              { key: 'marketing' as const, label: 'Marketing', desc: 'Show relevant content and offers' },
              { key: 'personalization' as const, label: 'Personalization', desc: 'Tailor the experience to you' },
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer p-2 rounded border hover:bg-muted/30">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={prefs[key]}
                  onChange={e => setPrefs(p => ({ ...p, [key]: e.target.checked }))}
                />
                <div>
                  <p className="font-medium text-xs">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={saving} onClick={() => saveConsent(false)}>
              {saving ? 'Saving…' : 'Save Preferences'}
            </Button>
            <Button size="sm" disabled={saving} onClick={() => saveConsent(true)}>
              Accept All
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
