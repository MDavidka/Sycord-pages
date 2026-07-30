import {
  buildGenerationPlan,
  updatePlanStep,
  type GenerationPlan,
  type PlanStepStatus,
} from './generation-plan'

/** Normalize Syte update_plan / agent_plans payloads into the PlanChecklist model. */
export function planFromAgentUpdate(args: unknown, existing?: GenerationPlan | null): GenerationPlan | null {
  const parsed = parseLooseObject(args)
  if (!parsed) return existing || null

  const rawSteps = parsed.steps ?? parsed.plan ?? parsed.items
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    // Status-only update against an existing plan
    if (existing && (parsed.stepId || parsed.step_id || parsed.id) && parsed.status) {
      return updatePlanStep(
        existing,
        String(parsed.stepId || parsed.step_id || parsed.id),
        normalizeStepStatus(parsed.status),
      )
    }
    return existing || null
  }

  const steps = rawSteps.map((step, index) => {
    if (typeof step === 'string') {
      return {
        id: `step-${index + 1}`,
        title: step,
        description: '',
        strict: false,
        status: (index === 0 ? 'in_progress' : 'pending') as PlanStepStatus,
      }
    }
    const obj = (step && typeof step === 'object' ? step : {}) as Record<string, unknown>
    const title = String(obj.title || obj.name || obj.label || `Step ${index + 1}`)
    return {
      id: String(obj.id || `step-${index + 1}`),
      title,
      description: String(obj.description || ''),
      strict: Boolean(obj.strict),
      status: normalizeStepStatus(obj.status) || ((index === 0 ? 'in_progress' : 'pending') as PlanStepStatus),
    }
  })

  const base = buildGenerationPlan({
    title: String(parsed.title || parsed.name || existing?.title || 'Plan'),
    appType: String(parsed.appType || existing?.appType || 'website'),
    pages: existing?.pages,
    notes: typeof parsed.note === 'string' ? parsed.note : typeof parsed.notes === 'string' ? parsed.notes : existing?.notes,
    steps: steps.map((s) => ({ id: s.id, title: s.title, description: s.description, strict: s.strict })),
  })

  return {
    ...base,
    steps: steps.map((s, i) => ({
      ...base.steps[i],
      ...s,
      hints: base.steps[i]?.hints,
    })),
  }
}

function normalizeStepStatus(value: unknown): PlanStepStatus {
  const status = String(value || '').toLowerCase()
  if (status === 'completed' || status === 'done' || status === 'complete') return 'completed'
  if (status === 'in_progress' || status === 'running' || status === 'active') return 'in_progress'
  if (status === 'skipped' || status === 'skip') return 'skipped'
  return 'pending'
}

function parseLooseObject(args: unknown): Record<string, any> | null {
  if (!args) return null
  if (typeof args === 'object') return args as Record<string, any>
  if (typeof args !== 'string') return null
  try {
    const parsed = JSON.parse(args)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}
