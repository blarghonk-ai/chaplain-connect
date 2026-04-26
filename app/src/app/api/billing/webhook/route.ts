import { stripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Stripe sends raw body — must disable body parsing
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripe webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      // Cast to any — Stripe subscription shape varies by API version
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub = event.data.object as any
      const customerId = sub.customer as string

      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (org) {
        const periodStart = sub.current_period_start
          ? new Date(sub.current_period_start * 1000).toISOString()
          : null
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null

        await supabase
          .from('subscriptions')
          .upsert({
            org_id: org.id,
            stripe_subscription_id: sub.id,
            status: sub.status,
            period_start: periodStart,
            period_end: periodEnd,
          }, { onConflict: 'org_id' })
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object
      await supabase
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('stripe_subscription_id', sub.id)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object
      const customerId = invoice.customer as string

      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (org) {
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('org_id', org.id)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
