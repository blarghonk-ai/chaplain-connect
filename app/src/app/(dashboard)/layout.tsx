import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import SignOutButton from './_components/sign-out-button'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, organizations(name)')
    .eq('id', user.id)
    .single()

  const initials = profile?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() ?? '?'

  const orgs = profile?.organizations as { name: string }[] | { name: string } | null
  const org = Array.isArray(orgs) ? orgs[0] : orgs

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 border-r bg-muted/30 flex flex-col">
        <div className="p-4">
          <h2 className="font-bold text-base">Chaplain Connect</h2>
          <p className="text-xs text-muted-foreground truncate">{org?.name}</p>
        </div>

        <Separator />

        <nav className="flex-1 p-3 space-y-1">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/dashboard/sessions">Sessions</NavLink>
          <NavLink href="/dashboard/chat">Chat</NavLink>
          <NavLink href="/dashboard/posts">Content</NavLink>
          <NavLink href="/dashboard/videos">Video Library</NavLink>
          <NavLink href="/dashboard/schedule">Schedule</NavLink>
          <NavLink href="/dashboard/bible">Scripture</NavLink>
          <NavLink href="/dashboard/ai">AI Assistant</NavLink>

          <Separator className="my-2" />
          <NavLink href="/dashboard/profile">Profile</NavLink>

          {['org_admin', 'super_admin'].includes(profile?.role ?? '') && (
            <>
              <Separator className="my-2" />
              <NavLink href="/dashboard/team">Team</NavLink>
              <NavLink href="/dashboard/billing">Billing</NavLink>
              <NavLink href="/dashboard/settings">Settings</NavLink>
              <NavLink href="/dashboard/audit">Audit Log</NavLink>
              {profile?.role === 'super_admin' && (
                <NavLink href="/dashboard/grc">GRC Engine</NavLink>
              )}
            </>
          )}
        </nav>

        <Separator />

        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-sm truncate">{profile?.full_name ?? user.email}</span>
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      {children}
    </Link>
  )
}
