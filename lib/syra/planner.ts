import { FileMetadata } from './ai-memory-manager';

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  action: 'create' | 'modify' | 'delete' | 'refactor';
  filePath?: string;
  dependencies: string[]; // References to other step IDs
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface BuildPlan {
  id: string;
  title: string;
  description: string;
  steps: PlanStep[];
  estimatedComplexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  estimatedTokens: number;
  reasoning: string;
}

/**
 * Structure an AI plan response into executable steps
 */
export function parsePlanResponse(
  planText: string,
  context: FileMetadata[],
): BuildPlan {
  // This is a simplified parser - in production, you'd use structured LLM output
  const lines = planText.split('\n').filter(l => l.trim());

  const steps: PlanStep[] = [];
  let stepIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.match(/^#+\s+Step/i)) {
      const match = line.match(/Step\s+(\d+):\s*(.*)/i);
      if (match) {
        steps.push({
          id: `step_${stepIndex}`,
          title: match[2],
          description: lines[i + 1] || '',
          action: inferAction(match[2]),
          priority: inferPriority(match[2], stepIndex),
          dependencies: [],
        });
        stepIndex++;
      }
    }
  }

  // Auto-detect dependencies
  for (let i = 0; i < steps.length; i++) {
    for (let j = 0; j < i; j++) {
      if (steps[i].description.includes(steps[j].title)) {
        steps[i].dependencies.push(steps[j].id);
      }
    }
  }

  return {
    id: `plan_${Date.now()}`,
    title: 'Generated Build Plan',
    description: planText.substring(0, 200),
    steps,
    estimatedComplexity: inferComplexity(steps.length),
    estimatedTokens: context.reduce((sum, f) => sum + Math.ceil(f.size / 4), 0),
    reasoning: planText,
  };
}

/**
 * Infer action type from step description
 */
function inferAction(description: string): PlanStep['action'] {
  const lower = description.toLowerCase();
  if (lower.includes('create') || lower.includes('new')) return 'create';
  if (lower.includes('delete') || lower.includes('remove')) return 'delete';
  if (lower.includes('refactor') || lower.includes('restructure')) return 'refactor';
  return 'modify';
}

/**
 * Infer priority from step description
 */
function inferPriority(
  description: string,
  index: number,
): PlanStep['priority'] {
  const lower = description.toLowerCase();
  if (lower.includes('first') || index === 0) return 'critical';
  if (lower.includes('important') || lower.includes('critical')) return 'high';
  if (lower.includes('optional')) return 'low';
  return 'medium';
}

/**
 * Infer complexity from step count
 */
function inferComplexity(stepCount: number): BuildPlan['estimatedComplexity'] {
  if (stepCount <= 1) return 'trivial';
  if (stepCount <= 2) return 'simple';
  if (stepCount <= 5) return 'moderate';
  return 'complex';
}

/**
 * Validate plan feasibility
 */
export function validatePlan(plan: BuildPlan, context: FileMetadata[]): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check for circular dependencies
  const hasCircularDeps = detectCircularDependencies(plan.steps);
  if (hasCircularDeps) {
    errors.push('Plan contains circular dependencies');
  }

  // Check if all referenced files exist or should be created
  const existingFiles = new Set(context.map(f => f.path));
  for (const step of plan.steps) {
    if (step.filePath && step.action !== 'create' && !existingFiles.has(step.filePath)) {
      warnings.push(`Step "${step.title}" references non-existent file: ${step.filePath}`);
    }
  }

  // Check complexity vs step count
  if (plan.steps.length > 10 && plan.estimatedComplexity !== 'complex') {
    warnings.push('Plan has many steps but low complexity estimate');
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Detect circular dependencies in plan steps
 */
function detectCircularDependencies(steps: PlanStep[]): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(stepId: string): boolean {
    visited.add(stepId);
    recursionStack.add(stepId);

    const step = steps.find(s => s.id === stepId);
    if (!step) return false;

    for (const depId of step.dependencies) {
      if (!visited.has(depId)) {
        if (hasCycle(depId)) return true;
      } else if (recursionStack.has(depId)) {
        return true;
      }
    }

    recursionStack.delete(stepId);
    return false;
  }

  for (const step of steps) {
    if (!visited.has(step.id)) {
      if (hasCycle(step.id)) return true;
    }
  }

  return false;
}

/**
 * Serialize plan to JSON for storage/transmission
 */
export function serializePlan(plan: BuildPlan): string {
  return JSON.stringify(plan, null, 2);
}

/**
 * Deserialize plan from JSON
 */
export function deserializePlan(json: string): BuildPlan {
  return JSON.parse(json);
}
