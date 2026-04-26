'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

type Org = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  tier: string
  created_at: string
}

export default function SettingsClient({ org }: { org: Org | null }) {
  const router = useRouter()
  const [name, setName] = useState(org?.name ?? '')
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
      body: JSON.stringify({ name }),
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
          <CardDescription>Update your organization&apos;s name and branding</CardDescription>
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
          <Button variant="outline" asChild>
            <a href="/dashboard/billing">Manage billing →</a>
          </Button>
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
