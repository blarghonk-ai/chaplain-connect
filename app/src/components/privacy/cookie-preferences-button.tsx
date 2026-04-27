'use client'

interface Props {
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

// Dispatches the 'cc:show-prefs' custom event that CookieBanner listens for.
// Drop this anywhere you want a "Manage Cookie Preferences" link/button.
export default function CookiePreferencesButton({ className, style, children }: Props) {
  function open() {
    window.dispatchEvent(new CustomEvent('cc:show-prefs'))
  }

  return (
    <button onClick={open} className={className} style={style}>
      {children ?? 'Manage Cookie Preferences'}
    </button>
  )
}
