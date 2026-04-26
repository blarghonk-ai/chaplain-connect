import Stripe from 'stripe'

// Server-side Stripe client — only use in API routes and Server Components
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_placeholder', {
  apiVersion: '2025-04-30.basil',
})

export const STRIPE_PRICES: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER ?? '',
  professional: process.env.STRIPE_PRICE_PROFESSIONAL ?? '',
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? '',
}

export const TIER_LIMITS = {
  starter:      { chaplains: 3,         users: 50 },
  professional: { chaplains: 10,        users: 500 },
  enterprise:   { chaplains: Infinity,  users: Infinity },
} as const

export const TIER_PRICES = {
  starter:      { monthly: '$99',  annual: '$1,069' },
  professional: { monthly: '$299', annual: '$3,229' },
  enterprise:   { monthly: 'Custom', annual: 'Custom' },
} as const
