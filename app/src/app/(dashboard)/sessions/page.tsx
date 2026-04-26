import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Sessions — Chaplain Connect' }

export default async function SessionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, title, description, scheduled_at, status, chaplain_id, profiles!chaplain_id(full_name)')
    .order('scheduled_at', { ascending: false })
    .limit(20)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Live Sessions</h1>
        <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-3 py-1">
          LiveKit integration coming soon
        </span>
      </div>

      {/* Integration notice */}
      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle className="text-base">Video Session Platform</CardTitle>
          <CardDescription>
            Live sessions will be powered by LiveKit — an open-source, self-hostable WebRTC platform.
            Free tier includes 5,000 minutes/month on LiveKit Cloud.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Once connected, chaplains can:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Start and schedule live video sessions</li>
            <li>Share screens and documents</li>
            <li>Record sessions for the video library</li>
            <li>Invite participants via secure link</li>
          </ul>
        </CardContent>
      </Card>

      {/* Upcoming sessions (from DB) */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Sessions</h2>
        {!sessions || sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions scheduled yet.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => {
              const chaplain = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
              return (
                <Card key={s.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{s.title}</p>
                        {s.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">{s.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Chaplain: {chaplain?.full_name ?? '—'}
                          {s.scheduled_at && ` · ${new Date(s.scheduled_at).toLocaleString()}`}
                        </p>
                      </div>
                      <Badge
                        variant={s.status === 'live' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {s.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
