import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TeamClient from './_components/team-client'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) redirect('/onboarding')

  const { data: members } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at')
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: true })

  const { data: invitations } = await supabase
    .from('invitations')
    .select('id, email, role, created_at, expires_at, accepted_at')
    .eq('org_id', profile.org_id)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })

  const isAdmin = ['org_admin', 'super_admin'].includes(profile.role)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-muted-foreground text-sm">Manage members and invitations</p>
      </div>
      <TeamClient
        currentUserId={user.id}
        currentRole={profile.role}
        isAdmin={isAdmin}
        members={members ?? []}
        invitations={invitations ?? []}
      />
    </div>
  )
}
