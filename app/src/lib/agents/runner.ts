import { createAdminClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'
import type { AgentFinding, AgentRunResult } from './types'

const REASONING_SEVERITIES = new Set(['medium', 'high', 'critical'])

async function generateReasoning(finding: AgentFinding): Promise<string> {
  if (!process.env.GROQ_API_KEY) return ''
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'You are a compliance and security analyst for Chaplain Connect, a ministry SaaS platform serving hospitals, nonprofits, and DoD. Provide concise, actionable analysis in 2–3 sentences. Be direct and specific about the risk and what needs to happen.',
        },
        {
          role: 'user',
          content: `Analyze this agent finding:\n\nTitle: ${finding.title}\nSeverity: ${finding.severity}\nDescription: ${finding.description}\nProposed action: ${finding.proposedAction ?? 'None specified'}\nContext: ${JSON.stringify(finding.metadata ?? {}, null, 2)}`,
        },
      ],
      max_tokens: 220,
      temperature: 0.2,
    })
    return completion.choices[0]?.message?.content?.trim() ?? ''
  } catch {
    return ''
  }
}

async function findGrcControl(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  keywords: string[]
): Promise<string | null> {
  for (const kw of keywords) {
    const { data } = await admin
      .from('grc_controls')
      .select('id')
      .or(`title.ilike.%${kw}%,control_id.ilike.%${kw}%,category.ilike.%${kw}%`)
      .limit(1)
      .single()
    if (data?.id) return data.id
  }
  // Fall back to any control
  const { data } = await admin.from('grc_controls').select('id').limit(1).single()
  return data?.id ?? null
}

export async function runAgent(
  agentId: string,
  triggeredBy: 'scheduled' | 'manual' | 'event',
  agentLogic: (
    runId: string,
    admin: Awaited<ReturnType<typeof createAdminClient>>
  ) => Promise<AgentFinding[]>
): Promise<AgentRunResult> {
  const admin = await createAdminClient()

  // Create run record
  const { data: run, error: runErr } = await admin
    .from('agent_runs')
    .insert({ agent_id: agentId, triggered_by: triggeredBy, status: 'running' })
    .select()
    .single()

  if (!run || runErr) throw new Error(`Failed to create agent run: ${runErr?.message}`)

  const { data: agent } = await admin
    .from('agent_registry')
    .select('name, agent_type')
    .eq('id', agentId)
    .single()

  try {
    const findings = await agentLogic(run.id, admin)

    let findingsCount = 0
    let actionsAutoTaken = 0
    let pendingApprovals = 0

    for (const finding of findings) {
      findingsCount++

      // Generate Groq reasoning for significant findings
      const groqReasoning = REASONING_SEVERITIES.has(finding.severity)
        ? await generateReasoning(finding)
        : null

      const requiresApproval = finding.requiresHumanApproval
      const approvalStatus = requiresApproval ? 'pending' : 'auto_approved'

      const { data: decision } = await admin
        .from('agent_decisions')
        .insert({
          run_id: run.id,
          agent_id: agentId,
          decision_type: finding.decisionType,
          severity: finding.severity,
          title: finding.title,
          description: finding.description,
          groq_reasoning: groqReasoning,
          rule_triggered: finding.ruleTriggered,
          proposed_action: finding.proposedAction ?? null,
          requires_human_approval: requiresApproval,
          approval_status: approvalStatus,
          metadata: finding.metadata ?? {},
        })
        .select('id')
        .single()

      if (requiresApproval && decision) {
        pendingApprovals++
        const dueAt = new Date(
          Date.now() + (finding.slaHours ?? 24) * 3_600_000
        ).toISOString()
        await admin
          .from('agent_approval_queue')
          .insert({ decision_id: decision.id, due_at: dueAt })
      } else {
        actionsAutoTaken++
      }
    }

    // Emit GRC evidence for this run
    const keywords = ['monitor', 'change', 'audit', 'access', 'review']
    const controlId = await findGrcControl(admin, keywords)
    if (controlId) {
      await admin.from('grc_evidence').insert({
        control_id: controlId,
        title: `${agent?.name ?? 'Agent'} — automated run`,
        description: `${agent?.name} completed at ${new Date().toISOString()}. Findings: ${findingsCount}. Auto-resolved: ${actionsAutoTaken}. Pending human approval: ${pendingApprovals}.`,
        source: 'manual',
        collected_at: new Date().toISOString(),
        hash: Buffer.from(`agent_run_${run.id}_${Date.now()}`).toString('hex').slice(0, 64),
        metadata: {
          agent_run_id: run.id,
          agent_type: agent?.agent_type,
          findings_count: findingsCount,
          triggered_by: triggeredBy,
        },
      })
    }

    // Complete the run
    await admin
      .from('agent_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        findings_count: findingsCount,
        actions_taken: actionsAutoTaken,
        summary: `${findingsCount} finding${findingsCount !== 1 ? 's' : ''}. ${actionsAutoTaken} auto-resolved. ${pendingApprovals} pending approval.`,
      })
      .eq('id', run.id)

    await admin
      .from('agent_registry')
      .update({ last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', agentId)

    return { runId: run.id, findingsCount, actionsAutoTaken, pendingApprovals }
  } catch (err) {
    await admin
      .from('agent_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      })
      .eq('id', run.id)
    throw err
  }
}
