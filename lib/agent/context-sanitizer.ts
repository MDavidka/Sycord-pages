/**
 * ContextSanitizer & Ghost Task Eliminator
 * Verifies active prompt alignment, zeroes ephemeral state between discrete task runs,
 * and detects state leakage / ghost tasks.
 */

import type { AgentTier, SessionMessage } from './types.ts';

export interface SanitizedPromptResult {
  sanitized_prompt: string;
  active_goal: string;
  ghost_task_detected: boolean;
  ghost_task_details?: string;
  stripped_patterns: string[];
}

export interface StateLeakageCheckResult {
  leakage_detected: boolean;
  leaked_items: string[];
  details?: string;
}

export class ContextSanitizer {
  private static readonly GHOST_TASK_PATTERNS = [
    /\[Autonomous Execution Directive\]: Incomplete plan steps remain[\s\S]*?(?=\n\n|$)/gi,
    /Previous failed subtask:\s*[\s\S]*?(?=\n\n|$)/gi,
    /Resume prior session\s*[\s\S]*?(?=\n\n|$)/gi,
    /Continuing step \d+ from abandoned task[\s\S]*?(?=\n\n|$)/gi,
  ];

  private static readonly SYSTEM_POLLUTION_PATTERNS = [
    /<\|tool_calls_section_begin\|>[\s\S]*?<\|tool_calls_section_end\|>/gi,
    /<\|im_start\|>[\s\S]*?<\|im_end\|>/gi,
    /__PREVIOUS_TASK_ERROR__:[\s\S]*?(?=\n\n|$)/gi,
  ];

  /**
   * Sanitizes the input prompt, removing stale continuation directives and ghost task instructions.
   */
  public static sanitizeInput(rawPrompt: string): SanitizedPromptResult {
    let cleanPrompt = (rawPrompt || '').trim();
    const strippedPatterns: string[] = [];
    let ghostTaskDetected = false;
    let ghostTaskDetails: string | undefined;

    // Check and strip ghost task directives
    for (const pattern of this.GHOST_TASK_PATTERNS) {
      if (pattern.test(cleanPrompt)) {
        ghostTaskDetected = true;
        ghostTaskDetails = `Detected ghost task pattern matching: ${pattern.toString()}`;
        cleanPrompt = cleanPrompt.replace(pattern, '').trim();
        strippedPatterns.push(pattern.toString());
      }
    }

    // Check and strip low-level markup pollution
    for (const pattern of this.SYSTEM_POLLUTION_PATTERNS) {
      if (pattern.test(cleanPrompt)) {
        cleanPrompt = cleanPrompt.replace(pattern, '').trim();
        strippedPatterns.push(pattern.toString());
      }
    }

    // Extract core user goal
    const activeGoal = cleanPrompt;

    return {
      sanitized_prompt: cleanPrompt,
      active_goal: activeGoal,
      ghost_task_detected: ghostTaskDetected,
      ghost_task_details: ghostTaskDetails,
      stripped_patterns: strippedPatterns,
    };
  }

  /**
   * Verifies that the prompt matches the active execution goal and does not contain
   * stale references to prior completed or failed tasks.
   */
  public static verifyPromptGoalAlignment(
    currentPrompt: string,
    expectedGoal: string
  ): { aligned: boolean; driftReason?: string } {
    const cleanPrompt = currentPrompt.trim().toLowerCase();
    const cleanGoal = expectedGoal.trim().toLowerCase();

    if (!cleanPrompt) {
      return { aligned: false, driftReason: 'Prompt is empty.' };
    }

    // If ghost task directives are present, alignment fails
    for (const pattern of this.GHOST_TASK_PATTERNS) {
      if (pattern.test(currentPrompt)) {
        return {
          aligned: false,
          driftReason: 'Prompt contains leaked ghost task directive from previous session.',
        };
      }
    }

    return { aligned: true };
  }

  /**
   * Checks for cross-session state leakage in message history or context stores.
   */
  public static detectStateLeakage(
    messages: SessionMessage[],
    currentTaskId: string,
    priorKnownTaskIds: string[] = []
  ): StateLeakageCheckResult {
    const leakedItems: string[] = [];
    const priorSet = new Set(priorKnownTaskIds.filter(id => id !== currentTaskId));

    for (const msg of messages) {
      if (msg.taskId && priorSet.has(msg.taskId)) {
        leakedItems.push(`Message from prior task ID: ${msg.taskId}`);
      }

      if (typeof msg.content === 'string') {
        for (const pattern of this.GHOST_TASK_PATTERNS) {
          if (pattern.test(msg.content)) {
            leakedItems.push(`Ghost task directive leaked in message role=${msg.role}`);
          }
        }
      }
    }

    return {
      leakage_detected: leakedItems.length > 0,
      leaked_items: leakedItems,
      details: leakedItems.length > 0 ? leakedItems.join('; ') : undefined,
    };
  }

  /**
   * Builds an isolated, clean prompt representation for the LLM dispatch based on the tier.
   */
  public static buildCleanPrompt(
    systemPromptTemplate: string,
    messages: SessionMessage[],
    activeGoal: string,
    tier: AgentTier
  ): { systemPrompt: string; sanitizedMessages: SessionMessage[] } {
    // For Tier 1 (Instant), minimal prompt overhead
    if (tier === 1) {
      const minimalSystemPrompt = `You are a concise, accurate assistant. Provide a direct, helpful answer with zero overhead. Do not invoke tools.`;
      return {
        systemPrompt: minimalSystemPrompt,
        sanitizedMessages: [
          {
            role: 'user',
            content: activeGoal,
            persistent: false,
          },
        ],
      };
    }

    // For Tiers 2-5, clean system prompt and filter out stale ephemeral messages
    const sanitizedMessages = messages
      .filter(m => m.role === 'user' || m.role === 'assistant' || m.role === 'tool' || m.persistent)
      .map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content.replace(/<\|tool_calls_section_begin\|>[\s\S]*/g, '').trim() : m.content,
        tool_calls: m.tool_calls,
        tool_call_id: m.tool_call_id,
        name: m.name,
      }));

    return {
      systemPrompt: systemPromptTemplate,
      sanitizedMessages,
    };
  }

  /**
   * Memory Zeroing hook: clears global / persistent stores between discrete tasks.
   */
  public static zeroEphemeralMemory(store: {
    generationPlan?: any;
    parsedErrors?: any[];
    terminalOutput?: any[];
    [key: string]: any;
  }): void {
    if (store) {
      if ('generationPlan' in store) store.generationPlan = null;
      if ('parsedErrors' in store) store.parsedErrors = [];
      if ('terminalOutput' in store) store.terminalOutput = [];
    }
  }
}
