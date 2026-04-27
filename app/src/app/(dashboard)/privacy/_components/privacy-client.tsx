'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import DataMapTab from './data-map-tab'
import RopaTab from './ropa-tab'
import AssessmentsTab from './assessments-tab'
import ReportsTab from './reports-tab'

interface Stats {
  totalLocations: number
  piiCount: number
  ropaCount: number
  draftAssessments: number
  approvedAssessments: number
  categoryBreakdown: Record<string, number>
  storageBreakdown: Record<string, number>
}

export default function PrivacyClient({ stats }: { stats: Stats }) {
  const [activeTab, setActiveTab] = useState('data-map')

  const CATEGORY_COLORS: Record<string, string> = {
    contact_info: 'bg-red-100 text-red-800',
    authentication_data: 'bg-orange-100 text-orange-800',
    session_data: 'bg-yellow-100 text-yellow-800',
    message_content: 'bg-purple-100 text-purple-800',
    health_data: 'bg-pink-100 text-pink-800',
    financial_data: 'bg-green-100 text-green-800',
    behavioral_data: 'bg-blue-100 text-blue-800',
    device_data: 'bg-cyan-100 text-cyan-800',
    location_data: 'bg-teal-100 text-teal-800',
    media_content: 'bg-indigo-100 text-indigo-800',
    org_data: 'bg-gray-100 text-gray-800',
  }

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">Data Locations</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.totalLocations}</p>
            <p className="text-xs text-muted-foreground">{stats.piiCount} are PII</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">ROPA Records</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.ropaCount}</p>
            <p className="text-xs text-muted-foreground">Article 30 compliant</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">Assessments</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.draftAssessments + stats.approvedAssessments}</p>
            <p className="text-xs text-muted-foreground">{stats.approvedAssessments} approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">Data Categories</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{Object.keys(stats.categoryBreakdown).length}</p>
            <p className="text-xs text-muted-foreground">types tracked</p>
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(stats.categoryBreakdown)
          .sort(([, a], [, b]) => b - a)
          .map(([cat, count]) => (
            <span
              key={cat}
              className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${CATEGORY_COLORS[cat] ?? 'bg-gray-100 text-gray-800'}`}
            >
              {cat.replace(/_/g, ' ')}
              <Badge variant="secondary" className="text-xs h-4 px-1">{count}</Badge>
            </span>
          ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="data-map">Data Map</TabsTrigger>
          <TabsTrigger value="ropa">ROPA</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="data-map" className="mt-4">
          <DataMapTab />
        </TabsContent>

        <TabsContent value="ropa" className="mt-4">
          <RopaTab />
        </TabsContent>

        <TabsContent value="assessments" className="mt-4">
          <AssessmentsTab />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <ReportsTab totalLocations={stats.totalLocations} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
