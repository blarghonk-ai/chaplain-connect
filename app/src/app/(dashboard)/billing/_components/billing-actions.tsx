'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

type Tier = 'starter' | 'professional' | 'enterprise'

export default function BillingActions({
  hasStripeCustomer,
  currentTier,
}: {
  hasStripeCustomer: boolean
  currentTier: Tier
}) {
  const [portalLoading, setPortalLoading] = useState(false)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function openPortal() {
    setPortalLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to open billing portal')
      window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setPortalLoading(false)
    }
  }

  async function startCheckout(tier: Tier) {
    setUpgradeLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start checkout')
      window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setUpgradeLoading(false)
    }
  }

  const nextTier: Tier | null =
    currentTier === 'starter' ? 'professional' :
    currentTier === 'professional' ? 'enterprise' :
    null

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <div className="flex gap-2 flex-wrap">
        {hasStripeCustomer && (
          <Button
            variant="outline"
            onClick={openPortal}
            disabled={portalLoading}
          >
            {portalLoading ? 'Opening…' : 'Manage billing'}
          </Button>
        )}
        {nextTier && nextTier !== 'enterprise' && (
          <Button
            variant="outline"
            onClick={() => startCheckout(nextTier)}
            disabled={upgradeLoading}
          >
            {upgradeLoading ? 'Redirecting…' : `Upgrade to ${nextTier.charAt(0).toUpperCase() + nextTier.slice(1)}`}
          </Button>
        )}
        {nextTier === 'enterprise' && (
          <Button variant="outline" onClick={() => {
            window.location.href = 'mailto:sales@chaplainconnect.com?subject=Enterprise Plan Inquiry'
          }}>
            Contact sales for Enterprise
          </Button>
        )}
        {!hasStripeCustomer && (
          <p className="text-xs text-muted-foreground">
            No Stripe account linked. Contact{' '}
            <a href="mailto:billing@chaplainconnect.com" className="underline">
              billing@chaplainconnect.com
            </a>{' '}
            to set up billing.
          </p>
        )}
      </div>
    </div>
  )
}
