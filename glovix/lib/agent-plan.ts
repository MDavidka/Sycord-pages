import {
  buildGenerationPlan,
  updatePlanStep,
  type GenerationPlan,
  type PlanStepStatus,
} from './generation-plan'
import {
  parsePlanFromConnectionStream,
  normalizeStepStatus as pclNormalizeStatus,
  type PlanStepStatus as PclStepStatus,
} from './plan-connection-language'

/** Normalize Syte update_plan / agent_plans / Connection Language payloads into the PlanChecklist model. */
export function planFromAgentUpdate(args: unknown, existing?: GenerationPlan | null): GenerationPlan | null {
  if (typeof args === 'string') {
    const streamParsed = parsePlanFromConnectionStream(args, existing ? {
      id: existing.id,
      title: existing.title,
      steps: existing.steps.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        status: s.status as PclStepStatus,
      })),
      status: 'active',
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    } : null)

    if (streamParsed.plan && streamParsed.plan.steps.length > 0) {
      return {
        id: streamParsed.plan.id,
        title: streamParsed.plan.title,
        appType: existing?.appType || 'website',
        pages: existing?.pages || [{ route: '/', name: 'Home' }],
        shadcnComponents: existing?.shadcnComponents || [],
        steps: streamParsed.plan.steps.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description || '',
          strict: false,
          status: s.status as PlanStepStatus,
        })),
        notes: streamParsed.plan.notes || existing?.notes,
        createdAt: streamParsed.plan.createdAt,
        updatedAt: streamParsed.plan.updatedAt,
      }
    }
  }

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
    title: String(parsed.title || parsed.name || existing?.title || 'plan'),
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
  return pclNormalizeStatus(value) as PlanStepStatus
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
