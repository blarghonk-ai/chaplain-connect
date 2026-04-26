import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Video Library — Chaplain Connect' }

export default async function VideosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: videos } = await supabase
    .from('videos')
    .select('id, title, description, thumbnail_url, duration_secs, created_at, profiles!uploaded_by(full_name)')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(20)

  function formatDuration(secs: number | null): string {
    if (!secs) return ''
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Video Library</h1>
        <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-3 py-1">
          Mux integration coming soon
        </span>
      </div>

      {/* Integration notice */}
      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle className="text-base">Video Streaming Platform</CardTitle>
          <CardDescription>
            Video hosting will be powered by Mux — professional-grade video infrastructure.
            Free tier includes 100,000 delivery minutes/month.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Once connected, your organization can:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Upload sermon recordings and teaching videos</li>
            <li>Auto-generate thumbnails and captions</li>
            <li>Stream at adaptive quality for any connection</li>
            <li>Automatically store session recordings</li>
          </ul>
        </CardContent>
      </Card>

      {/* Video grid */}
      {!videos || videos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No videos uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map(v => {
            const uploader = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles
            return (
              <Card key={v.id} className="overflow-hidden">
                {v.thumbnail_url ? (
                  <div className="aspect-video bg-muted overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-video bg-muted flex items-center justify-center text-muted-foreground text-sm">
                    No thumbnail
                  </div>
                )}
                <CardContent className="pt-3 pb-4">
                  <p className="font-medium text-sm">{v.title}</p>
                  {v.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{v.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {v.duration_secs && <span>{formatDuration(v.duration_secs)}</span>}
                    <span>{uploader?.full_name ?? '—'}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
