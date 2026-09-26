/**
 * Plan Connection Language (PCL)
 * Wire protocol, streaming parser, and serializer for AI implementation plans and live progress.
 *
 * Supports:
 * 1. Tag/XML Connection syntax:
 *    <plan title="plan">
 *      <step status="in_progress">inplement the pahse 1 into the correct</step>
 *      <step status="pending">inplement the phase 2</step>
 *    </plan>
 *
 * 2. Code Block syntax:
 *    ```plan
 *    title: plan
 *    - [in_progress] inplement the pahse 1 into the correct
 *    - [pending] inplement the phase 2
 *    ```
 *
 * 3. Markdown task list syntax:
 *    ### Plan: plan
 *    - [>] inplement the pahse 1 into the correct
 *    - [ ] inplement the phase 2
 *
 * 4. Incremental / streaming parsing of partial tokens in real-time.
 */

export type PlanStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface PlanStep {
  id: string;
  title: string;
  description?: string;
  status: PlanStepStatus;
  notes?: string;
  strict?: boolean;
}

export interface StreamingPlan {
  id: string;
  title: string;
  steps: PlanStep[];
  status: 'active' | 'completed' | 'failed';
  elapsedSeconds?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export function normalizeStepStatus(value: unknown): PlanStepStatus {
  if (!value) return 'pending';
  const str = String(value).trim().toLowerCase();
  if (['completed', 'done', 'complete', 'success', 'passed', 'x', '✓'].includes(str)) return 'completed';
  if (['in_progress', 'running', 'active', 'executing', 'progress', 'doing', '>', '→', '▶', 'current'].includes(str)) return 'in_progress';
  if (['failed', 'error', 'canceled', 'cancelled', 'stopped'].includes(str)) return 'failed';
  if (['skipped', 'skip', '-', '–'].includes(str)) return 'skipped';
  return 'pending';
}

/**
 * Extracts and parses a streaming plan from text containing Connection Language tags or code blocks.
 * Designed to work seamlessly with incomplete/in-flight streaming text chunks.
 */
export function parsePlanFromConnectionStream(
  text: string,
  existingPlan?: StreamingPlan | null
): { plan: StreamingPlan | null; cleanText: string; hasPlanBlock: boolean } {
  if (!text || typeof text !== 'string') {
    return { plan: existingPlan || null, cleanText: text || '', hasPlanBlock: false };
  }

  // 1. Check for XML/Tag syntax: <plan ...> ... </plan> (or open <plan ...> ...)
  const planTagMatch = text.match(/<plan(?:\s+title=["']([^"']*)["'])?[^>]*>([\s\S]*?)(?:<\/plan>|$)/i);
  if (planTagMatch) {
    const rawTitle = (planTagMatch[1] || '').trim();
    const body = planTagMatch[2] || '';
    const steps = parseStepsFromXml(body);

    if (steps.length > 0) {
      const isCompleted = steps.every((s) => s.status === 'completed' || s.status === 'skipped');
      const hasFailed = steps.some((s) => s.status === 'failed');
      const plan: StreamingPlan = {
        id: existingPlan?.id || `plan-${Date.now()}`,
        title: rawTitle || existingPlan?.title || 'plan',
        steps,
        status: hasFailed ? 'failed' : isCompleted ? 'completed' : 'active',
        createdAt: existingPlan?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      const cleanText = text.replace(/<plan[\s\S]*?(?:<\/plan>|$)/gi, '').trim();
      return { plan, cleanText, hasPlanBlock: true };
    }
  }

  // 2. Check for ```plan ... ``` code block
  const codeBlockMatch = text.match(/```(?:plan|planning)\s*\n([\s\S]*?)(?:```|$)/i);
  if (codeBlockMatch) {
    const blockContent = codeBlockMatch[1] || '';
    const { title, steps } = parseStepsFromText(blockContent);

    if (steps.length > 0) {
      const isCompleted = steps.every((s) => s.status === 'completed' || s.status === 'skipped');
      const hasFailed = steps.some((s) => s.status === 'failed');
      const plan: StreamingPlan = {
        id: existingPlan?.id || `plan-${Date.now()}`,
        title: title || existingPlan?.title || 'plan',
        steps,
        status: hasFailed ? 'failed' : isCompleted ? 'completed' : 'active',
        createdAt: existingPlan?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      const cleanText = text.replace(/```(?:plan|planning)[\s\S]*?(?:```|$)/gi, '').trim();
      return { plan, cleanText, hasPlanBlock: true };
    }
  }

  // 3. Fallback: Parse Markdown checklist if explicitly marked as Plan
  const planHeadingMatch = text.match(/(?:^|\n)(?:#{1,4}\s*(?:Plan|Implementation Plan)[^\n]*)\n([\s\S]*?)(?:\n#{1,4}|$)/i);
  if (planHeadingMatch) {
    const blockContent = planHeadingMatch[1] || '';
    const { steps } = parseStepsFromText(blockContent);

    if (steps.length >= 2) {
      const isCompleted = steps.every((s) => s.status === 'completed' || s.status === 'skipped');
      const hasFailed = steps.some((s) => s.status === 'failed');
      const plan: StreamingPlan = {
        id: existingPlan?.id || `plan-${Date.now()}`,
        title: existingPlan?.title || 'plan',
        steps,
        status: hasFailed ? 'failed' : isCompleted ? 'completed' : 'active',
        createdAt: existingPlan?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      return { plan, cleanText: text, hasPlanBlock: true };
    }
  }

  return { plan: existingPlan || null, cleanText: text, hasPlanBlock: false };
}

function parseStepsFromXml(xmlBody: string): PlanStep[] {
  const steps: PlanStep[] = [];
  const stepRegex = /<step(?:\s+id=["']([^"']*)["'])?(?:\s+status=["']([^"']*)["'])?[^>]*>([\s\S]*?)(?:<\/step>|$)/gi;
  let match: RegExpExecArray | null;
  let idx = 1;

  while ((match = stepRegex.exec(xmlBody)) !== null) {
    const rawId = match[1] || `step-${idx}`;
    const rawStatus = match[2] || (idx === 1 ? 'in_progress' : 'pending');
    const rawContent = (match[3] || '').trim();

    if (rawContent) {
      steps.push({
        id: rawId,
        title: rawContent.split('\n')[0].replace(/^[-*•\d.]\s*/, '').trim(),
        description: rawContent.includes('\n') ? rawContent.split('\n').slice(1).join(' ').trim() : undefined,
        status: normalizeStepStatus(rawStatus),
      });
      idx++;
    }
  }

  return steps;
}

function parseStepsFromText(content: string): { title?: string; steps: PlanStep[] } {
  const lines = content.split('\n');
  let title = '';
  const steps: PlanStep[] = [];
  let idx = 1;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^title:\s*/i.test(line)) {
      title = line.replace(/^title:\s*/i, '').trim();
      continue;
    }

    // Checkbox / bracket status: - [in_progress] Step title or - [>] Step title or 1. [x] Step
    const bracketMatch = line.match(/^(?:[-*•]|\d+[.)])\s*\[([^\]]+)\]\s*(.*)$/);
    if (bracketMatch) {
      const rawStatus = bracketMatch[1].trim();
      const rawTitle = bracketMatch[2].trim();
      if (rawTitle) {
        steps.push({
          id: `step-${idx}`,
          title: rawTitle,
          status: normalizeStepStatus(rawStatus),
        });
        idx++;
        continue;
      }
    }

    // Inline status suffix: Step title (in_progress) or Step title [running]
    const inlineStatusMatch = line.match(/^(?:[-*•]|\d+[.)])?\s*(.*?)\s*[([](in_progress|pending|completed|done|failed)[)\]]$/i);
    if (inlineStatusMatch) {
      const rawTitle = inlineStatusMatch[1].trim();
      const rawStatus = inlineStatusMatch[2].trim();
      if (rawTitle) {
        steps.push({
          id: `step-${idx}`,
          title: rawTitle,
          status: normalizeStepStatus(rawStatus),
        });
        idx++;
        continue;
      }
    }

    // Plain bullet or numbered line: - implement phase 1 or 1. implement phase 2
    const plainMatch = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (plainMatch) {
      const rawTitle = plainMatch[1].trim();
      if (rawTitle) {
        steps.push({
          id: `step-${idx}`,
          title: rawTitle,
          status: idx === 1 ? 'in_progress' : 'pending',
        });
        idx++;
      }
    }
  }

  return { title, steps };
}

/**
 * Serialize a plan to Connection Language XML format for AI prompts / system injection.
 */
export function serializePlanToConnectionLanguage(plan: StreamingPlan): string {
  const lines = [`<plan title="${escapeXml(plan.title || 'plan')}">`];
  for (const step of plan.steps) {
    lines.push(`  <step id="${escapeXml(step.id)}" status="${step.status}">${escapeXml(step.title)}</step>`);
  }
  lines.push('</plan>');
  return lines.join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
