'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

// Countries we have privacy regulation coverage for
const JURISDICTION_OPTIONS = [
  { code: 'US',    label: 'United States' },
  { code: 'US-CA', label: 'California, USA (CCPA/CPRA)' },
  { code: 'US-VA', label: 'Virginia, USA (VCDPA)' },
  { code: 'US-CO', label: 'Colorado, USA (CPA)' },
  { code: 'US-CT', label: 'Connecticut, USA (CTDPA)' },
  { code: 'US-TX', label: 'Texas, USA (TDPSA)' },
  { code: 'CA',    label: 'Canada (PIPEDA)' },
  { code: 'GB',    label: 'United Kingdom (UK GDPR)' },
  { code: 'DE',    label: 'Germany (GDPR)' },
  { code: 'FR',    label: 'France (GDPR)' },
  { code: 'NL',    label: 'Netherlands (GDPR)' },
  { code: 'IE',    label: 'Ireland (GDPR)' },
  { code: 'SE',    label: 'Sweden (GDPR)' },
  { code: 'DK',    label: 'Denmark (GDPR)' },
  { code: 'FI',    label: 'Finland (GDPR)' },
  { code: 'NO',    label: 'Norway (GDPR)' },
  { code: 'CH',    label: 'Switzerland' },
  { code: 'BR',    label: 'Brazil (LGPD)' },
  { code: 'AU',    label: 'Australia (Privacy Act)' },
  { code: 'SG',    label: 'Singapore (PDPA)' },
  { code: 'JP',    label: 'Japan (APPI)' },
  { code: 'KR',    label: 'South Korea (PIPA)' },
  { code: 'IN',    label: 'India (DPDP)' },
  { code: 'CN',    label: 'China (PIPL)' },
  { code: 'TH',    label: 'Thailand (PDPA)' },
  { code: 'AE',    label: 'UAE (PDPL)' },
]

type Org = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  tier: string
  country_code: string | null
  created_at: string
}

export default function SettingsClient({ org }: { org: Org | null }) {
  const router = useRouter()
  const [name, setName] = useState(org?.name ?? '')
  const [countryCode, setCountryCode] = useState(org?.country_code ?? 'US')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSaved(false)
    setError(null)

    const res = await fetch('/api/org', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, country_code: countryCode }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
    } else {
      setSaved(true)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Org details */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>Update your organization&apos;s name and jurisdiction</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="orgName">Organization name</Label>
              <Input
                id="orgName"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>URL slug</Label>
              <Input value={org?.slug ?? ''} disabled className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Slug cannot be changed after creation</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="countryCode">Primary jurisdiction</Label>
              <select
                id="countryCode"
                value={countryCode}
                onChange={e => setCountryCode(e.target.value)}
                className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {JURISDICTION_OPTIONS.map(o => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Used by the PrivacyAgent to determine which data protection regulations apply to your organization.
                HIPAA is always enforced as Chaplain Connect processes health-related data.
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {saved && <p className="text-sm text-green-600">Saved successfully</p>}
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Plan info */}
      <Card>
        <CardHeader>
          <CardTitle>Plan & Billing</CardTitle>
          <CardDescription>Your current subscription plan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Current plan</span>
            <Badge className="capitalize">{org?.tier}</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Organization created</span>
            <span>{org?.created_at ? new Date(org.created_at).toLocaleDateString() : '—'}</span>
          </div>
          <a
            href="/billing"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Manage billing →
          </a>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions for your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete organization</p>
              <p className="text-xs text-muted-foreground">
                Permanently delete this organization and all its data. This cannot be undone.
              </p>
            </div>
            <Button variant="destructive" disabled>
              Delete org
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Contact support to delete your organization.</p>
        </CardContent>
      </Card>
    </div>
  )
}
