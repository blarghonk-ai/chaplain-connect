import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Schedule — Chaplain Connect' }

export default async function SchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Upcoming sessions in next 30 days
  const now = new Date()
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const { data: upcoming } = await supabase
    .from('sessions')
    .select('id, title, scheduled_at, status, profiles!chaplain_id(full_name)')
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', thirtyDaysOut.toISOString())
    .in('status', ['scheduled', 'live'])
    .order('scheduled_at', { ascending: true })
    .limit(10)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-3 py-1">
          Cal.com integration coming soon
        </span>
      </div>

      {/* Integration notice */}
      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle className="text-base">Scheduling Platform</CardTitle>
          <CardDescription>
            Appointment scheduling will be powered by Cal.com — open-source scheduling infrastructure.
            Free for self-hosting; Cal.com Cloud starts free.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Once connected, users can:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Book chaplain appointments directly</li>
            <li>Set availability and buffer times</li>
            <li>Receive automated reminders</li>
            <li>Sync with Google/Outlook calendars</li>
          </ul>
        </CardContent>
      </Card>

      {/* Upcoming sessions */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Upcoming (next 30 days)</h2>
        {!upcoming || upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions scheduled in the next 30 days.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map(s => {
              const chaplain = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles
              const dt = s.scheduled_at ? new Date(s.scheduled_at) : null
              return (
                <div key={s.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                  <div className="text-center min-w-[48px]">
                    {dt && (
                      <>
                        <p className="text-xs text-muted-foreground">{dt.toLocaleDateString('en', { month: 'short' })}</p>
                        <p className="text-xl font-bold leading-none">{dt.getDate()}</p>
                      </>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {chaplain?.full_name ?? '—'}
                      {dt && ` · ${dt.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                  </div>
                  {s.status === 'live' && (
                    <span className="text-xs bg-green-100 text-green-700 border border-green-300 rounded-full px-2 py-0.5">
                      Live now
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
