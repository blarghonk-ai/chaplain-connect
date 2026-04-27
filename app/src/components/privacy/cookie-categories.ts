// Cookie registry — the canonical list of every cookie/storage item the platform sets.
// Each category corresponds to a consent toggle in the preference center.
// This is the source of truth for the cookie banner, preference center, and cookie policy.

export type OptionalCategoryKey = 'functional' | 'analytics' | 'marketing' | 'personalization'
export type CategoryKey = 'necessary' | OptionalCategoryKey

export interface CookieEntry {
  name: string          // Cookie / storage key name (use * as wildcard)
  purpose: string       // Plain-English description
  duration: string      // 'Session' | '1 year' | etc.
  provider: string      // Company that sets this
  type: 'cookie' | 'localStorage' | 'sessionStorage'
}

export interface CookieCategory {
  key: CategoryKey
  label: string
  shortLabel: string
  description: string
  legalBasis: string
  alwaysOn: boolean
  entries: CookieEntry[]
}

export const COOKIE_CATEGORIES: CookieCategory[] = [
  {
    key: 'necessary',
    label: 'Strictly Necessary',
    shortLabel: 'Necessary',
    description:
      'Required for the platform to function. These cannot be disabled. They include authentication, security, and your own consent preference storage.',
    legalBasis: 'Legitimate interest / Contractual necessity',
    alwaysOn: true,
    entries: [
      {
        name: 'sb-*-auth-token',
        purpose: 'Supabase authentication session — keeps you securely logged in',
        duration: 'Session',
        provider: 'Supabase',
        type: 'cookie',
      },
      {
        name: 'sb-*-auth-token-code-verifier',
        purpose: 'PKCE code verifier for OAuth 2.0 authentication flow',
        duration: 'Session',
        provider: 'Supabase',
        type: 'sessionStorage',
      },
      {
        name: 'cc_anon_id',
        purpose: 'Anonymous visitor identifier for consent record linkage (pre-login)',
        duration: '1 year',
        provider: 'Chaplain Connect',
        type: 'localStorage',
      },
      {
        name: 'cc_cookie_consent',
        purpose: 'Stores your cookie consent choices so we do not re-prompt on every visit',
        duration: '1 year',
        provider: 'Chaplain Connect',
        type: 'localStorage',
      },
    ],
  },
  {
    key: 'functional',
    label: 'Functional',
    shortLabel: 'Functional',
    description:
      'Enable enhanced functionality such as remembering your UI preferences, sidebar state, and display settings across sessions.',
    legalBasis: 'Consent',
    alwaysOn: false,
    entries: [
      {
        name: 'cc_ui_prefs',
        purpose: 'Remembers sidebar collapsed state, panel layouts, and display preferences',
        duration: '1 year',
        provider: 'Chaplain Connect',
        type: 'localStorage',
      },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics & Performance',
    shortLabel: 'Analytics',
    description:
      'Help us understand how chaplains use the platform so we can improve it. All data is aggregated — no personal data is shared with third parties.',
    legalBasis: 'Consent',
    alwaysOn: false,
    entries: [
      {
        name: '__vercel_speed_insights',
        purpose: 'Aggregate page load and Core Web Vitals performance metrics',
        duration: '1 year',
        provider: 'Vercel',
        type: 'cookie',
      },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    shortLabel: 'Marketing',
    description:
      'Used to deliver relevant content and measure outreach effectiveness. We currently do not use marketing or advertising cookies.',
    legalBasis: 'Consent',
    alwaysOn: false,
    entries: [],
  },
  {
    key: 'personalization',
    label: 'Personalization',
    shortLabel: 'Personalization',
    description:
      'Power AI-driven personalization of your ministry experience, including tailored scripture suggestions, session prep, and Chaplain AI context memory.',
    legalBasis: 'Consent',
    alwaysOn: false,
    entries: [
      {
        name: 'cc_ai_prefs',
        purpose: 'Chaplain AI context preferences and ministry personalization settings',
        duration: '6 months',
        provider: 'Chaplain Connect',
        type: 'localStorage',
      },
    ],
  },
]

// Jurisdiction-aware messaging — GDPR opt-in model vs CCPA/US opt-out model
export interface JurisdictionMessage {
  headline: string
  body: string
  model: 'opt_in' | 'opt_out'
  regulation: string
}

export const JURISDICTION_MESSAGES: Record<string, JurisdictionMessage> = {
  EU: {
    headline: 'Your Privacy, Your Choice',
    body: 'Under the GDPR, we require your explicit consent before placing any non-essential cookies or trackers. You may accept all, reject non-essential, or customize below.',
    model: 'opt_in',
    regulation: 'GDPR',
  },
  UK: {
    headline: 'Your Privacy, Your Choice',
    body: 'Under UK GDPR and PECR, we need your consent before setting any non-essential cookies. You can accept, reject, or manage your preferences below.',
    model: 'opt_in',
    regulation: 'UK GDPR / PECR',
  },
  CA: {
    headline: 'Your Privacy Rights',
    body: 'Under PIPEDA and provincial privacy laws, you can choose which cookies to allow. Essential cookies are required for the platform to function.',
    model: 'opt_in',
    regulation: 'PIPEDA',
  },
  BR: {
    headline: 'Suas Preferências de Privacidade',
    body: "Under Brazil's LGPD, you have the right to manage your data and consent choices. You may accept all or customize your preferences.",
    model: 'opt_in',
    regulation: 'LGPD',
  },
  CN: {
    headline: 'Your Privacy Rights',
    body: "Under China's PIPL, your consent is required for personal data processing. Please review and confirm your preferences.",
    model: 'opt_in',
    regulation: 'PIPL',
  },
  US: {
    headline: 'We Use Cookies',
    body: 'We use essential cookies to provide our service and optional cookies to improve your experience. You can manage your preferences or accept all below.',
    model: 'opt_out',
    regulation: '',
  },
  default: {
    headline: 'We Use Cookies',
    body: 'We use essential cookies to provide our service and optional cookies to improve your experience. You can manage your preferences or accept all below.',
    model: 'opt_out',
    regulation: '',
  },
}

export const JURISDICTION_LABELS: Record<string, string> = {
  EU: '🇪🇺 European Union · GDPR',
  UK: '🇬🇧 United Kingdom · UK GDPR',
  CA: '🇨🇦 Canada · PIPEDA',
  BR: '🇧🇷 Brazil · LGPD',
  CN: '🇨🇳 China · PIPL',
  JP: '🇯🇵 Japan · APPI',
  KR: '🇰🇷 South Korea · PIPA',
  US: '🇺🇸 United States',
  default: '🌐 Global',
}
