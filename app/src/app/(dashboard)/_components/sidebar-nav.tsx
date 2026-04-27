'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home, Video, MessageSquare, Layers, BookOpen,
  Users, BookMarked, CalendarDays, Sparkles,
  Shield, Lock, Users2, Clock, CreditCard, Settings2, Bot, LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

const ministryNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard',       icon: Home },
  { href: '/sessions',  label: 'Live Session',     icon: Video },
  { href: '/chat',      label: 'Messages',         icon: MessageSquare },
  { href: '/posts',     label: 'Programs',         icon: Layers },
  { href: '/videos',    label: 'Video Library',    icon: BookOpen },
  { href: '/profile',   label: 'Client Profiles',  icon: Users },
  { href: '/bible',     label: 'Scripture',        icon: BookMarked },
  { href: '/schedule',  label: 'Schedule',         icon: CalendarDays },
]

const adminNav: NavItem[] = [
  { href: '/team',     label: 'Identity & Access', icon: Users2 },
  { href: '/audit',    label: 'Security',           icon: Clock },
  { href: '/billing',  label: 'Billing',            icon: CreditCard },
  { href: '/settings', label: 'Settings',           icon: Settings2 },
]

const superAdminNav: NavItem[] = [
  { href: '/grc',     label: 'GRC Engine', icon: Shield },
  { href: '/privacy', label: 'Privacy',    icon: Lock },
  { href: '/agents',  label: 'AI Agents',  icon: Bot },
]

interface Props {
  fullName: string | null
  role: string | null
  orgName: string | null
}

export default function SidebarNav({ fullName, role, orgName }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const initials = fullName
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?'

  const isAdmin = ['org_admin', 'super_admin'].includes(role ?? '')
  const isSuperAdmin = role === 'super_admin'

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside style={{
      width: 228, flexShrink: 0, background: 'var(--s-bg)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--s-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: 'var(--s-active)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            border: '1px solid oklch(34% 0.095 290)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--s-logo)" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 2v20 M2 12h20" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--s-text)', letterSpacing: '-0.01em' }}>
              Chaplain Connect
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--s-muted)', marginTop: 1 }}>
              {orgName ?? 'Ministry Infrastructure'}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '14px 10px', flex: 1, overflowY: 'auto' }}>
        {/* Ministry section label */}
        <div style={{
          fontSize: 10, color: 'var(--s-text)', letterSpacing: '0.10em',
          textTransform: 'uppercase', padding: '0 13px 8px', fontWeight: 800, opacity: 0.7,
        }}>Ministry</div>

        {ministryNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`cc-nav-item${isActive(href) ? ' cc-active' : ''}`}
          >
            <Icon size={17} strokeWidth={1.9} />
            <span style={{ flex: 1 }}>{label}</span>
          </Link>
        ))}

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--s-border)', margin: '14px 4px 8px' }} />

        {/* Chaplain AI — featured */}
        <Link href="/ai" className={`cc-ai-btn${pathname === '/ai' ? ' cc-active' : ''}`}>
          <div style={{
            width: 26, height: 26, borderRadius: 7, background: 'var(--s-logo)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--s-bg)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2v20 M2 12h20" />
            </svg>
          </div>
          <span style={{ flex: 1 }}>Chaplain AI</span>
          <span style={{
            fontSize: 9.5, background: 'var(--s-logo)', color: 'var(--s-bg)',
            padding: '2px 7px', borderRadius: 10, fontWeight: 800,
          }}>AI</span>
        </Link>

        {/* Admin section */}
        {isAdmin && (
          <>
            <div style={{ height: 1, background: 'var(--s-border)', margin: '4px 4px 14px' }} />
            <div style={{
              fontSize: 10, color: 'var(--s-text)', letterSpacing: '0.10em',
              textTransform: 'uppercase', padding: '0 13px 8px', fontWeight: 800, opacity: 0.7,
            }}>Admin</div>

            {adminNav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`cc-nav-item${isActive(href) ? ' cc-active' : ''}`}
              >
                <Icon size={17} strokeWidth={1.9} />
                <span style={{ flex: 1 }}>{label}</span>
              </Link>
            ))}

            {isSuperAdmin && superAdminNav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`cc-nav-item${isActive(href) ? ' cc-active' : ''}`}
              >
                <Icon size={17} strokeWidth={1.9} />
                <span style={{ flex: 1 }}>{label}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div style={{
        padding: '14px 16px', borderTop: '1px solid var(--s-border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'oklch(91% 0.028 155)', color: 'oklch(32% 0.072 155)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, flexShrink: 0, letterSpacing: '0.02em',
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: 'var(--s-text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {fullName ?? 'User'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--s-muted)' }}>
            {role?.replace('_', ' ') ?? 'Chaplain'} · Active
          </div>
        </div>
        <button
          onClick={handleSignOut}
          title="Sign out"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--s-muted)', padding: 4, borderRadius: 6,
            display: 'flex', alignItems: 'center',
          }}
        >
          <LogOut size={15} strokeWidth={1.9} />
        </button>
      </div>
    </aside>
  )
}
