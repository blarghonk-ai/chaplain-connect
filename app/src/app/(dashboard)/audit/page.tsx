import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const ACTION_COLORS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  invite_member: 'secondary',
  remove_member: 'destructive',
  change_member_role: 'secondary',
  update_org: 'default',
  create_org: 'default',
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) redirect('/onboarding')
  if (!['org_admin', 'super_admin'].includes(profile.role)) redirect('/dashboard')

  const params = await searchParams
  const page = parseInt(params.page ?? '1')
  const pageSize = 50
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('audit_logs')
    .select('*, profiles(full_name)', { count: 'exact' })
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (params.action) {
    query = query.eq('action', params.action)
  }

  const { data: logs, count } = await query

  const totalPages = Math.ceil((count ?? 0) / pageSize)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground text-sm">
          Append-only record of all actions in your organization
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity ({count ?? 0} events)</CardTitle>
          <CardDescription>
            Hash-chained for tamper evidence. Page {page} of {totalPages || 1}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!logs || logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No audit events yet</p>
          ) : (
            <div className="space-y-0 divide-y text-sm">
              {logs.map((log) => {
                const actor = (log.profiles as { full_name: string | null } | null)?.full_name ?? 'System'
                return (
                  <div key={log.id} className="py-3 flex items-start gap-4">
                    <div className="w-36 shrink-0 text-xs text-muted-foreground pt-0.5">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={ACTION_COLORS[log.action] ?? 'outline'}
                          className="text-xs font-mono"
                        >
                          {log.action}
                        </Badge>
                        <span className="text-muted-foreground">
                          {log.resource_type}
                          {log.resource_id && (
                            <span className="font-mono text-xs ml-1 opacity-60">
                              {log.resource_id.slice(0, 8)}…
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>by <span className="font-medium text-foreground">{actor}</span></span>
                        {log.metadata && Object.keys(log.metadata as object).length > 0 && (
                          <span className="font-mono opacity-60">
                            {JSON.stringify(log.metadata).slice(0, 80)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 font-mono text-xs text-muted-foreground/40 hidden lg:block">
                      {log.hash.slice(0, 12)}…
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex gap-2 mt-4 justify-center">
              {page > 1 && (
                <a href={`?page=${page - 1}`} className="text-sm text-primary hover:underline">← Previous</a>
              )}
              {page < totalPages && (
                <a href={`?page=${page + 1}`} className="text-sm text-primary hover:underline">Next →</a>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
