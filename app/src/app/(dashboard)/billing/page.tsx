import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TIER_LIMITS, TIER_PRICES } from '@/lib/stripe/client'
import BillingActions from './_components/billing-actions'

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) redirect('/onboarding')
  if (!['org_admin', 'super_admin'].includes(profile.role)) redirect('/dashboard')

  const [{ data: subscription }, { data: members }, { data: org }] = await Promise.all([
    supabase.from('subscriptions').select('*').eq('org_id', profile.org_id).single(),
    supabase.from('profiles').select('id, role').eq('org_id', profile.org_id),
    supabase.from('organizations').select('stripe_customer_id').eq('id', profile.org_id).single(),
  ])

  const params = await searchParams
  const checkoutSuccess = params.checkout === 'success'

  const chaplainCount = members?.filter(m => ['chaplain', 'org_admin', 'super_admin'].includes(m.role)).length ?? 0
  const userCount = members?.length ?? 0

  const tier = (subscription?.tier ?? 'starter') as keyof typeof TIER_LIMITS
  const limits = TIER_LIMITS[tier]
  const prices = TIER_PRICES[tier]
  const status = subscription?.status ?? 'active'

  const hasStripeCustomer = !!org?.stripe_customer_id

  const TIERS = [
    {
      id: 'starter' as const,
      name: 'Starter',
      description: 'Small nonprofits and community organizations',
      monthly: TIER_PRICES.starter.monthly,
      annual: TIER_PRICES.starter.annual,
      chaplains: TIER_LIMITS.starter.chaplains,
      users: TIER_LIMITS.starter.users,
    },
    {
      id: 'professional' as const,
      name: 'Professional',
      description: 'Hospitals, mid-size agencies, and growing teams',
      monthly: TIER_PRICES.professional.monthly,
      annual: TIER_PRICES.professional.annual,
      chaplains: TIER_LIMITS.professional.chaplains,
      users: TIER_LIMITS.professional.users,
    },
    {
      id: 'enterprise' as const,
      name: 'Enterprise',
      description: 'DoD, federal agencies, large health systems. HIPAA BAA included.',
      monthly: TIER_PRICES.enterprise.monthly,
      annual: TIER_PRICES.enterprise.annual,
      chaplains: Infinity,
      users: Infinity,
    },
  ]

  function statusBadgeVariant(s: string) {
    if (s === 'active' || s === 'trialing') return 'default' as const
    if (s === 'past_due') return 'secondary' as const
    return 'outline' as const
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground text-sm">Manage your subscription and usage</p>
      </div>

      {checkoutSuccess && (
        <div style={{
          background: 'oklch(95% 0.022 148)', border: '1px solid oklch(78% 0.080 148)',
          borderRadius: 10, padding: '12px 18px',
          fontSize: 14, fontWeight: 500, color: 'oklch(32% 0.140 148)',
        }}>
          Subscription activated — welcome aboard!
        </div>
      )}

      {status === 'past_due' && (
        <div style={{
          background: 'oklch(95% 0.035 52)', border: '1px solid oklch(78% 0.100 52)',
          borderRadius: 10, padding: '12px 18px',
          fontSize: 14, fontWeight: 500, color: 'oklch(35% 0.140 52)',
        }}>
          Payment is past due. Update your payment method below to avoid suspension.
        </div>
      )}

      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your active subscription details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold capitalize text-lg">{tier} Plan</p>
              <p className="text-sm text-muted-foreground">{prices.monthly}/month · {prices.annual}/year</p>
            </div>
            <Badge variant={statusBadgeVariant(status)} className="capitalize">{status.replace('_', ' ')}</Badge>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Chaplains</p>
              <p className="font-medium">
                {chaplainCount} / {limits.chaplains === Infinity ? 'Unlimited' : limits.chaplains}
              </p>
              {limits.chaplains !== Infinity && (
                <>
                  <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(100, (chaplainCount / limits.chaplains) * 100)}%` }}
                    />
                  </div>
                  {chaplainCount >= limits.chaplains && (
                    <p className="text-xs text-destructive mt-1">At limit — upgrade to add more</p>
                  )}
                </>
              )}
            </div>
            <div>
              <p className="text-muted-foreground">Total users</p>
              <p className="font-medium">
                {userCount} / {limits.users === Infinity ? 'Unlimited' : limits.users}
              </p>
              {limits.users !== Infinity && (
                <>
                  <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(100, (userCount / limits.users) * 100)}%` }}
                    />
                  </div>
                  {userCount >= limits.users && (
                    <p className="text-xs text-destructive mt-1">At limit — upgrade to add more</p>
                  )}
                </>
              )}
            </div>
          </div>

          {subscription?.period_end && (
            <>
              <Separator />
              <p className="text-xs text-muted-foreground">
                {status === 'canceled' ? 'Access ends' : 'Renews'} on{' '}
                {new Date(subscription.period_end).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>
            </>
          )}

          <Separator />

          <BillingActions hasStripeCustomer={hasStripeCustomer} currentTier={tier} />
        </CardContent>
      </Card>

      {/* Plan comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TIERS.map(t => (
          <Card key={t.id} className={tier === t.id ? 'ring-2 ring-primary' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t.name}</CardTitle>
                {tier === t.id && <Badge>Current</Badge>}
              </div>
              <CardDescription className="text-xs">{t.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-2xl font-bold">{t.monthly}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>✓ {t.chaplains === Infinity ? 'Unlimited' : t.chaplains} chaplains</li>
                <li>✓ {t.users === Infinity ? 'Unlimited' : t.users} users</li>
                {t.id === 'enterprise' && <li>✓ HIPAA BAA included</li>}
                {t.id === 'enterprise' && <li>✓ Dedicated support</li>}
                {t.id === 'enterprise' && <li>✓ Custom SLA</li>}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
