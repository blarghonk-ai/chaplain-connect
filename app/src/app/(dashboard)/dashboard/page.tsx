import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) redirect('/onboarding')

  const orgs = profile.organizations as { name: string; tier: string; slug: string }[] | { name: string; tier: string; slug: string } | null
  const org = Array.isArray(orgs) ? orgs[0] : orgs

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-muted-foreground">
          {profile.full_name ?? user.email} · {org?.name}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Organization</CardDescription>
            <CardTitle className="text-lg">{org?.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="capitalize">{org?.tier}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Your role</CardDescription>
            <CardTitle className="text-lg capitalize">{profile.role?.replace('_', ' ')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {profile.role === 'org_admin' ? 'Full organization access' : 'Standard access'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
            <CardTitle className="text-lg">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Platform foundation ready</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phase 1 Complete</CardTitle>
          <CardDescription>Foundation is live. Next up: Ministry Platform features.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>✅ Multi-tenant organization setup</li>
            <li>✅ Authentication (email, magic link, Google OAuth)</li>
            <li>✅ Role-based access control</li>
            <li>✅ Row Level Security enforced</li>
            <li>✅ Audit log foundation</li>
            <li>⏳ Live video (Phase 2)</li>
            <li>⏳ Real-time chat (Phase 2)</li>
            <li>⏳ Video library (Phase 2)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
