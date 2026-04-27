'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface DataLocation {
  id: string
  data_category: string
  storage_system: string
  table_name: string
  column_name: string | null
  storage_path: string | null
  description: string | null
  is_pii: boolean
  is_encrypted: boolean
  legal_basis: string
  retention_days: number
  last_verified_at: string
}

const CATEGORY_COLORS: Record<string, string> = {
  contact_info: 'bg-red-100 text-red-800 border-red-200',
  authentication_data: 'bg-orange-100 text-orange-800 border-orange-200',
  session_data: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  message_content: 'bg-purple-100 text-purple-800 border-purple-200',
  health_data: 'bg-pink-100 text-pink-800 border-pink-200',
  financial_data: 'bg-green-100 text-green-800 border-green-200',
  behavioral_data: 'bg-blue-100 text-blue-800 border-blue-200',
  device_data: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  media_content: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  org_data: 'bg-gray-100 text-gray-800 border-gray-200',
}

export default function DataMapTab() {
  const [locations, setLocations] = useState<DataLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{ scanned_at: string; locations_verified: number; findings: unknown[] } | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    fetch('/api/privacy/data-locations')
      .then(r => r.json())
      .then(d => setLocations(d.locations ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function runScan() {
    setScanning(true)
    try {
      const res = await fetch('/api/privacy/scan', { method: 'POST' })
      const data = await res.json()
      setScanResult(data)
      // Refresh last_verified_at
      const updated = await fetch('/api/privacy/data-locations').then(r => r.json())
      setLocations(updated.locations ?? [])
    } finally {
      setScanning(false)
    }
  }

  const filtered = locations.filter(l =>
    !filter || l.table_name.includes(filter) || (l.column_name ?? '').includes(filter) || l.data_category.includes(filter)
  )

  // Group by table
  const grouped = filtered.reduce<Record<string, DataLocation[]>>((acc, l) => {
    acc[l.table_name] = [...(acc[l.table_name] ?? []), l]
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Filter by table, column, or category…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="max-w-xs text-sm"
        />
        <Button variant="outline" size="sm" onClick={runScan} disabled={scanning}>
          {scanning ? 'Scanning…' : 'Run PII Scan'}
        </Button>
        {scanResult && (
          <span className="text-xs text-muted-foreground">
            Scanned {scanResult.locations_verified} locations — {scanResult.findings.length} anomalies
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading data map…</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([table, cols]) => (
            <Card key={table}>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-mono">{table}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {cols.map(loc => (
                    <div key={loc.id} className="flex items-start gap-3 text-sm">
                      <code className="w-40 shrink-0 text-xs text-muted-foreground truncate">
                        {loc.column_name ?? loc.storage_path ?? '(bucket)'}
                      </code>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[loc.data_category] ?? 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                        {loc.data_category.replace(/_/g, ' ')}
                      </span>
                      {loc.is_pii && (
                        <Badge variant="destructive" className="text-xs h-5">PII</Badge>
                      )}
                      {loc.is_encrypted && (
                        <Badge variant="outline" className="text-xs h-5">encrypted</Badge>
                      )}
                      <span className="text-xs text-muted-foreground truncate flex-1">
                        {loc.description}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {loc.retention_days}d retention
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {Object.keys(grouped).length === 0 && (
            <p className="text-sm text-muted-foreground">No data locations found.</p>
          )}
        </div>
      )}
    </div>
  )
}
