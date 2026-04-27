import { stripe, STRIPE_PRICES } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id || !['org_admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const tier = body.tier as 'starter' | 'professional' | 'enterprise'
  const priceId = STRIPE_PRICES[tier]
  if (!priceId) {
    return NextResponse.json({ error: 'Invalid tier or price not configured' }, { status: 400 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('stripe_customer_id, name')
    .eq('id', profile.org_id)
    .single()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://chaplain-connect.vercel.app'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    ...(org?.stripe_customer_id
      ? { customer: org.stripe_customer_id }
      : { customer_email: user.email }
    ),
    metadata: { org_id: profile.org_id },
    success_url: `${appUrl}/billing?checkout=success`,
    cancel_url: `${appUrl}/billing`,
    subscription_data: {
      metadata: { org_id: profile.org_id },
    },
  })

  return NextResponse.json({ url: session.url })
}
