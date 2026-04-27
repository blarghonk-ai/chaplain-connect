export type AgentSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical'
export type AgentDecisionType = 'finding' | 'action' | 'escalation' | 'evidence'
export type HumanGateLevel = 'none' | 'notify' | 'approve' | 'always'

export interface AgentFinding {
  title: string
  description: string
  severity: AgentSeverity
  decisionType: AgentDecisionType
  ruleTriggered: string
  requiresHumanApproval: boolean
  proposedAction?: string
  metadata?: Record<string, unknown>
  slaHours?: number
  grcControlKeywords?: string[]   // hints for linking GRC evidence
}

export interface AgentRunResult {
  runId: string
  findingsCount: number
  actionsAutoTaken: number
  pendingApprovals: number
}
