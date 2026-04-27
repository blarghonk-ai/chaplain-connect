'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import AgentRegistryTab from './agent-registry-tab'
import ApprovalQueueTab from './approval-queue-tab'
import RunHistoryTab from './run-history-tab'
import SecurityEventsTab from './security-events-tab'

interface Stats {
  totalAgents: number
  activeAgents: number
  pendingApprovals: number
  criticalPending: number
  weeklyRuns: number
  weeklyFindings: number
}

export default function AgentsClient({ stats }: { stats: Stats }) {
  const [tab, setTab] = useState('registry')

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">Active Agents</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.activeAgents}</p>
            <p className="text-xs text-muted-foreground">of {stats.totalAgents} registered</p>
          </CardContent>
        </Card>
        <Card className={stats.criticalPending > 0 ? 'border-red-400' : ''}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">Pending Approval</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-2xl font-bold ${stats.criticalPending > 0 ? 'text-red-600' : ''}`}>
              {stats.pendingApprovals}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.criticalPending > 0
                ? `${stats.criticalPending} critical`
                : 'no critical items'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">Runs (7 days)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.weeklyRuns}</p>
            <p className="text-xs text-muted-foreground">automated executions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">Findings (7 days)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.weeklyFindings}</p>
            <p className="text-xs text-muted-foreground">across all agents</p>
          </CardContent>
        </Card>
      </div>

      {stats.criticalPending > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <span className="font-semibold">Action required:</span>
          {stats.criticalPending} critical decision{stats.criticalPending !== 1 ? 's' : ''} awaiting your approval.
          <button className="ml-auto underline font-medium" onClick={() => setTab('queue')}>
            Review now
          </button>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="registry">Agents</TabsTrigger>
          <TabsTrigger value="queue">
            Approval Queue
            {stats.pendingApprovals > 0 && (
              <Badge
                variant={stats.criticalPending > 0 ? 'destructive' : 'secondary'}
                className="ml-1.5 text-xs h-4 px-1"
              >
                {stats.pendingApprovals}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Run History</TabsTrigger>
          <TabsTrigger value="security">Security Events</TabsTrigger>
        </TabsList>

        <TabsContent value="registry" className="mt-4">
          <AgentRegistryTab />
        </TabsContent>
        <TabsContent value="queue" className="mt-4">
          <ApprovalQueueTab />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <RunHistoryTab />
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          <SecurityEventsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
