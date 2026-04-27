'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ConsentRecord {
  id: string
  purpose: string
  legal_basis: string
  regulation_short: string | null
  granted_at: string
  withdrawn_at: string | null
  is_active: boolean
  consent_version: string
}

interface WithdrawalEvent {
  id: string
  purpose: string
  withdrawn_at: string
  status: string
}

const PURPOSE_LABELS: Record<string, string> = {
  marketing_communications: 'Marketing Communications',
  analytics_tracking: 'Analytics & Tracking',
  personalization: 'Personalization',
  third_party_sharing: 'Third-Party Sharing',
  research: 'Research & Development',
  ai_training: 'AI Model Training',
}

const BASIS_COLORS: Record<string, string> = {
  consent: 'bg-blue-100 text-blue-800',
  legitimate_interest: 'bg-purple-100 text-purple-800',
  contract: 'bg-green-100 text-green-800',
  legal_obligation: 'bg-orange-100 text-orange-800',
  vital_interests: 'bg-red-100 text-red-800',
  public_task: 'bg-gray-100 text-gray-800',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

export default function ConsentTab() {
  const [consents, setConsents] = useState<ConsentRecord[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [withdrawing, setWithdrawing] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/consent/grant').then(r => r.json()),
      fetch('/api/consent/withdrawals').then(r => r.json()),
    ]).then(([consentData, withdrawalData]) => {
      setConsents(consentData.consents ?? [])
      setWithdrawals(withdrawalData.withdrawals ?? [])
    }).finally(() => setLoading(false))
  }, [])

  async function withdrawConsent(purpose: string) {
    setWithdrawing(purpose)
    try {
      await fetch('/api/consent/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose }),
      })
      // Refresh
      const [consentData, withdrawalData] = await Promise.all([
        fetch('/api/consent/grant').then(r => r.json()),
        fetch('/api/consent/withdrawals').then(r => r.json()),
      ])
      setConsents(consentData.consents ?? [])
      setWithdrawals(withdrawalData.withdrawals ?? [])
    } finally {
      setWithdrawing(null)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading consent records…</p>

  const activeConsents = consents.filter(c => c.is_active)
  const historicConsents = consents.filter(c => !c.is_active)

  return (
    <div className="space-y-6">
      {/* Active consents */}
      <div>
        <h3 className="text-sm font-semibold mb-3">
          Active Consent Grants
          <span className="ml-2 text-xs font-normal text-muted-foreground">({activeConsents.length})</span>
        </h3>
        {activeConsents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active consent records.</p>
        ) : (
          <div className="space-y-2">
            {activeConsents.map(c => (
              <Card key={c.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">
                          {PURPOSE_LABELS[c.purpose] ?? c.purpose.replace(/_/g, ' ')}
                        </p>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${BASIS_COLORS[c.legal_basis] ?? 'bg-gray-100 text-gray-800'}`}>
                          {c.legal_basis.replace(/_/g, ' ')}
                        </span>
                        {c.regulation_short && (
                          <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                            {c.regulation_short}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Granted {new Date(c.granted_at).toLocaleDateString()} · v{c.consent_version}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs shrink-0 text-red-600 hover:text-red-700 hover:border-red-300"
                      disabled={withdrawing === c.purpose}
                      onClick={() => withdrawConsent(c.purpose)}
                    >
                      {withdrawing === c.purpose ? 'Withdrawing…' : 'Withdraw'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Withdrawal events */}
      {withdrawals.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Withdrawal Log</h3>
          <div className="space-y-2">
            {withdrawals.map(w => (
              <Card key={w.id} className="opacity-75">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {PURPOSE_LABELS[w.purpose] ?? w.purpose.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Withdrawn {new Date(w.withdrawn_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[w.status] ?? 'bg-gray-100 text-gray-800'}`}>
                      {w.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Historic / withdrawn consents */}
      {historicConsents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Consent History</h3>
          <div className="space-y-1">
            {historicConsents.map(c => (
              <div key={c.id} className="flex items-center gap-3 text-xs text-muted-foreground py-1.5 border-b last:border-0">
                <span className="flex-1 font-medium">
                  {PURPOSE_LABELS[c.purpose] ?? c.purpose.replace(/_/g, ' ')}
                </span>
                <span>Granted {new Date(c.granted_at).toLocaleDateString()}</span>
                {c.withdrawn_at && (
                  <span>Withdrawn {new Date(c.withdrawn_at).toLocaleDateString()}</span>
                )}
                <span className="line-through opacity-50">inactive</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
