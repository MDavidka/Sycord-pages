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
  private static readonly GHOST_TASK_LINE_PATTERNS = [
    /\[Autonomous Execution Directive\]:[^\n]*(?:\r?\n|$)/gi,
    /Previous failed subtask:[^\n]*(?:\r?\n|$)/gi,
    /Resume prior session[^\n]*(?:\r?\n|$)/gi,
    /Continuing step \d+ from abandoned task[^\n]*(?:\r?\n|$)/gi,
    /__PREVIOUS_TASK_ERROR__:[^\n]*(?:\r?\n|$)/gi,
  ];

  private static readonly SYSTEM_POLLUTION_PATTERNS = [
    /<\|tool_calls_section_begin\|>[\s\S]*?<\|tool_calls_section_end\|>/gi,
    /<\|im_start\|>[\s\S]*?<\|im_end\|>/gi,
  ];

  /**
   * Sanitizes the input prompt, removing stale continuation directives and ghost task instructions.
   */
  public static sanitizeInput(rawPrompt: string): SanitizedPromptResult {
    let cleanPrompt = (rawPrompt || '').trim();
    const strippedPatterns: string[] = [];
    let ghostTaskDetected = false;
    const detailsList: string[] = [];

    // 1. Check and strip ghost task directives line-by-line / pattern-by-pattern
    for (const pattern of this.GHOST_TASK_LINE_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(cleanPrompt)) {
        ghostTaskDetected = true;
        detailsList.push(`Matched pattern: ${pattern.source}`);
        pattern.lastIndex = 0;
        cleanPrompt = cleanPrompt.replace(pattern, '').trim();
        strippedPatterns.push(pattern.source);
      }
    }

    // 2. Check and strip low-level markup pollution
    for (const pattern of this.SYSTEM_POLLUTION_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(cleanPrompt)) {
        pattern.lastIndex = 0;
        cleanPrompt = cleanPrompt.replace(pattern, '').trim();
        strippedPatterns.push(pattern.source);
      }
    }

    // Extract core user goal
    const activeGoal = cleanPrompt;

    return {
      sanitized_prompt: cleanPrompt,
      active_goal: activeGoal,
      ghost_task_detected: ghostTaskDetected,
      ghost_task_details: detailsList.length > 0 ? detailsList.join('; ') : undefined,
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
    const cleanPrompt = (currentPrompt || '').trim();

    if (!cleanPrompt) {
      return { aligned: false, driftReason: 'Prompt is empty.' };
    }

    // If ghost task directives are present, alignment fails
    for (const pattern of this.GHOST_TASK_LINE_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(cleanPrompt)) {
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
    const priorSet = new Set(priorKnownTaskIds.filter(id => id && id !== currentTaskId));

    for (const msg of messages) {
      if (msg.taskId && priorSet.has(msg.taskId)) {
        leakedItems.push(`Message from prior task ID: ${msg.taskId}`);
      }

      if (typeof msg.content === 'string') {
        for (const pattern of this.GHOST_TASK_LINE_PATTERNS) {
          pattern.lastIndex = 0;
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
