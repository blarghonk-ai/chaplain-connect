'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$99/mo',
    chaplains: '3 chaplains',
    users: '50 users',
    description: 'Great for small nonprofits and community organizations.',
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '$299/mo',
    chaplains: '10 chaplains',
    users: '500 users',
    description: 'For hospitals, mid-size agencies, and growing teams.',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    chaplains: 'Unlimited chaplains',
    users: 'Unlimited users',
    description: 'DoD, federal agencies, large health systems. HIPAA BAA included.',
  },
]

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<'org' | 'tier'>('org')
  const [orgName, setOrgName] = useState('')
  const [selectedTier, setSelectedTier] = useState('starter')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createOrganization() {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not authenticated.')
      setLoading(false)
      return
    }

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: orgName, slug: slugify(orgName), tier: selectedTier })
      .select()
      .single()

    if (orgError) {
      setError(orgError.message)
      setLoading(false)
      return
    }

    // Assign user as org_admin
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ org_id: org.id, role: 'org_admin' })
      .eq('id', user.id)

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    // Create a starter subscription record
    await supabase
      .from('subscriptions')
      .insert({ org_id: org.id, tier: selectedTier, status: 'trialing' })

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Set up your organization</h1>
          <p className="text-muted-foreground text-sm mt-1">This takes about 2 minutes</p>
        </div>

        {step === 'org' && (
          <Card>
            <CardHeader>
              <CardTitle>Organization details</CardTitle>
              <CardDescription>
                This is the name your chaplains and users will see.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="orgName">Organization name</Label>
                <Input
                  id="orgName"
                  placeholder="St. Mary's Hospital Chaplaincy"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                />
                {orgName && (
                  <p className="text-xs text-muted-foreground">
                    Slug: <code className="bg-muted px-1 rounded">{slugify(orgName)}</code>
                  </p>
                )}
              </div>
              <Button
                onClick={() => setStep('tier')}
                disabled={!orgName.trim()}
                className="w-full"
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'tier' && (
          <div className="space-y-4">
            <div className="grid gap-3">
              {TIERS.map(tier => (
                <Card
                  key={tier.id}
                  className={`cursor-pointer transition-all ${
                    selectedTier === tier.id
                      ? 'ring-2 ring-primary'
                      : 'hover:ring-1 hover:ring-muted-foreground/30'
                  }`}
                  onClick={() => setSelectedTier(tier.id)}
                >
                  <CardContent className="flex items-start justify-between pt-4 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{tier.name}</span>
                        {tier.id === 'professional' && (
                          <Badge variant="secondary">Popular</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{tier.description}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground pt-1">
                        <span>{tier.chaplains}</span>
                        <span>·</span>
                        <span>{tier.users}</span>
                      </div>
                    </div>
                    <span className="font-bold text-lg shrink-0 ml-4">{tier.price}</span>
                  </CardContent>
                </Card>
              ))}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('org')} className="flex-1">
                Back
              </Button>
              <Button
                onClick={createOrganization}
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Creating…' : 'Create organization'}
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Enterprise pricing and HIPAA BAA setup will be handled by our team.
              Start with Starter or Professional — you can upgrade anytime.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
