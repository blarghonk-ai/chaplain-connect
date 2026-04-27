import { stripe } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
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

  const { data: org } = await supabase
    .from('organizations')
    .select('stripe_customer_id')
    .eq('id', profile.org_id)
    .single()

  if (!org?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found. Contact support.' }, { status: 400 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://chaplain-connect.vercel.app'}/billing`,
  })

  return NextResponse.json({ url: session.url })
}
