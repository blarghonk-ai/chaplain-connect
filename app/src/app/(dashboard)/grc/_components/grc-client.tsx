'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import ControlsTab from './controls-tab'
import VulnerabilitiesTab from './vulnerabilities-tab'
import RisksTab from './risks-tab'
import EvidenceTab from './evidence-tab'

type Framework = { id: string; key: string; name: string; version: string | null }
type Stats = {
  total: number
  implemented: number
  readinessPct: number
  openCritical: number
  openHigh: number
  highRisks: number
}

const TABS = ['Overview', 'Controls', 'Vulnerabilities', 'Risks', 'Evidence'] as const
type Tab = typeof TABS[number]

export default function GRCClient({ frameworks, stats }: { frameworks: Framework[]; stats: Stats }) {
  const [tab, setTab] = useState<Tab>('Overview')

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab frameworks={frameworks} stats={stats} />}
      {tab === 'Controls' && <ControlsTab />}
      {tab === 'Vulnerabilities' && <VulnerabilitiesTab />}
      {tab === 'Risks' && <RisksTab />}
      {tab === 'Evidence' && <EvidenceTab />}
    </div>
  )
}

function OverviewTab({ frameworks, stats }: { frameworks: Framework[]; stats: Stats }) {
  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Overall Readiness</CardDescription>
            <CardTitle className="text-3xl">{stats.readinessPct}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${stats.readinessPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stats.implemented} / {stats.total} controls</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Critical Vulnerabilities</CardDescription>
            <CardTitle className={`text-3xl ${stats.openCritical > 0 ? 'text-destructive' : 'text-green-600'}`}>
              {stats.openCritical}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.openHigh} high severity open
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardDescription>High Risks (score ≥15)</CardDescription>
            <CardTitle className={`text-3xl ${stats.highRisks > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {stats.highRisks}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Requires treatment plan</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Frameworks</CardDescription>
            <CardTitle className="text-3xl">{frameworks.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Active compliance targets</p>
          </CardContent>
        </Card>
      </div>

      {/* Frameworks grid */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Compliance Frameworks</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {frameworks.map(f => (
            <Card key={f.id}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{f.name}</p>
                    {f.version && <p className="text-xs text-muted-foreground">v{f.version}</p>}
                  </div>
                  <Badge variant="outline" className="uppercase text-xs">{f.key}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CI/CD evidence sources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Automated Evidence Sources</CardTitle>
          <CardDescription>Every CI/CD run generates compliance evidence automatically</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {[
              { tool: 'Gitleaks', maps: 'CC6.7, IA.3.083', type: 'Secret scanning' },
              { tool: 'Trivy', maps: 'CC7.1, RA.L2-3.11.2', type: 'Vulnerability scan' },
              { tool: 'CodeQL', maps: 'CC5.2, SA.L2-3.12.1', type: 'SAST analysis' },
              { tool: 'Semgrep', maps: 'CC5.2, SI.L2-3.14.2', type: 'Security SAST' },
              { tool: 'Checkov', maps: 'CM.L2-3.4.1, CC6.6', type: 'IaC security' },
              { tool: 'Syft/Grype', maps: 'SR.L2-3.17.1, CC9.2', type: 'SBOM + supply chain' },
              { tool: 'GitHub Actions', maps: 'CC8.1, AU.L2-3.3.1', type: 'Change management' },
              { tool: 'Audit logs', maps: 'CC7.2, AU.L2-3.3.2', type: 'Activity logging' },
              { tool: 'Dependabot', maps: 'CC7.1, SI.L2-3.14.1', type: 'Patch management' },
            ].map(e => (
              <div key={e.tool} className="p-3 rounded-lg border bg-muted/20">
                <p className="font-medium">{e.tool}</p>
                <p className="text-xs text-muted-foreground">{e.type}</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">→ {e.maps}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Compliance roadmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Certification Roadmap</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <RoadmapItem phase="Now" items={[
            'Encryption at rest (AES-256) + in transit (TLS 1.3) ✓',
            'Append-only hash-chained audit logs ✓',
            'RLS data isolation (no cross-org leakage) ✓',
            'CI/CD vulnerability scanning (Trivy, Gitleaks, CodeQL) ✓',
            'Software Bill of Materials (SBOM) on every release ✓',
            'MFA enforcement for admins ⏳',
          ]} />
          <Separator />
          <RoadmapItem phase="Before first enterprise contract" items={[
            'SOC 2 Type II observation window (12 months)',
            'HIPAA BAA template drafted',
            'ISO 27001 gap assessment',
            'Annual penetration test',
            'Incident response plan documented',
          ]} />
          <Separator />
          <RoadmapItem phase="Before healthcare customer goes live" items={[
            'HIPAA BAA executed (Supabase, Vercel, Cloudflare, Mux)',
            'GDPR ROPA completed',
            'DPIA for health data processing',
            'Data retention + deletion procedures operational',
          ]} />
          <Separator />
          <RoadmapItem phase="Government/DoD contracts" items={[
            'SOC 2 Type II report issued',
            'ISO 27001 certification',
            'ISO 27701 (privacy) certification',
            'CMMC Level 2 assessment (C3PAO)',
            'FedRAMP Moderate ATO (12–18 month process)',
          ]} />
        </CardContent>
      </Card>
    </div>
  )
}

function RoadmapItem({ phase, items }: { phase: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{phase}</p>
      <ul className="space-y-1">
        {items.map(item => (
          <li key={item} className="text-sm flex gap-2">
            <span className="text-muted-foreground mt-0.5">·</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
