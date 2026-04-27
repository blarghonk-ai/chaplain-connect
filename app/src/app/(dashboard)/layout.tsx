import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SidebarNav from './_components/sidebar-nav'

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

  const orgs = profile?.organizations
  const org = (Array.isArray(orgs) ? orgs[0] : orgs) as { name: string } | null

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      <SidebarNav
        fullName={profile?.full_name ?? null}
        role={profile?.role ?? null}
        orgName={org?.name ?? null}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {children}
      </div>
    </div>
  )
}
