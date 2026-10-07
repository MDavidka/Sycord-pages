/**
 * Tiered Execution Router (Fast-Path vs. Deep-Path Engine)
 * Strictly classifies agent tasks into 5 operational tiers:
 * Tier 1: Instant / Conversational (<500ms TTFT, 0 tools, 0 planning)
 * Tier 2: Single-Tool Utility (1 read-only tool, 0 decomposition planner)
 * Tier 3: Linear Workflow (Sequential tool calls with standard retry logic)
 * Tier 4: Multi-Artifact Task (Modular tool chaining with error verification & rollback)
 * Tier 5: Long-Running / Deep System (Hierarchical decomposition, recursive step validation, disk checkpointing, budget limits)
 */

import type { AgentTier, TaskBudget, TierClassification } from './types.ts';

export class TieredRouter {
  // Regex patterns for fast-path classification
  private static readonly TIER_1_PATTERNS = [
    /^(hi|hello|hey|greetings|howdy|good\s+(morning|afternoon|evening|day))[\s!.]*$/i,
    /^(what\s+is\s+your\s+name|who\s+are\s+you|what\s+can\s+you\s+do)[\s?]*$/i,
    /^(thank\s*you|thanks|thx|great|cool|awesome|looks\s+good)[\s!.]*$/i,
    /^(explain|what\s+is|define|how\s+does)\s+[a-zA-Z0-9_\s]{2,40}\??$/i,
    /^(format\s+(this|the\s+following)|convert\s+to\s+markdown)[\s:]*$/i,
  ];

  private static readonly TIER_2_PATTERNS = [
    /^(show|view|read|cat|display|inspect)\s+(the\s+)?(file|contents\s+of\s+)?([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)$/i,
    /^(list|show|ls|find)\s+(the\s+)?(files|directory|workspace|folder)$/i,
    /^(search|grep|find)\s+(for\s+)?["']?([^"']+)["']?\s+in\s+files?$/i,
    /^(get|show|check)\s+(docs|documentation)\s+for\s+([a-zA-Z0-9_-]+)$/i,
  ];

  private static readonly TIER_3_PATTERNS = [
    /^(edit|modify|update|change|fix)\s+([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)(\s+to\s+.+)?$/i,
    /^(create|add|write)\s+(a\s+)?(new\s+)?(file|component)\s+([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)$/i,
    /^(run|execute)\s+(command\s+)?(npm\s+[a-zA-Z0-9_-]+|tsc|eslint|git\s+[a-zA-Z0-9_-]+)$/i,
    /^(typecheck|lint|check\s+types|check\s+lint)$/i,
  ];

  private static readonly TIER_5_KEYWORDS = [
    'refactor entire',
    'full system',
    'multi-step',
    'architect',
    'long-running',
    'autonomous migration',
    'complete redesign',
    'end-to-end',
    'hierarchical',
    'deep refactor',
    'crash resiliency',
    'stability tiering',
  ];

  /**
   * Classify an incoming prompt into one of the 5 operational tiers.
   */
  public static classify(
    prompt: string,
    hints?: {
      tier_override?: AgentTier;
      file_count?: number;
      is_continuation?: boolean;
    }
  ): TierClassification {
    const raw = (prompt || '').trim();

    // 1. Explicit override
    if (hints?.tier_override && hints.tier_override >= 1 && hints.tier_override <= 5) {
      return this.buildClassification(
        hints.tier_override,
        `Explicit tier override (${hints.tier_override}) requested.`
      );
    }

    // 2. Check Tier 5 (Deep System / Long-Running)
    const lower = raw.toLowerCase();
    const isTier5KeywordMatch = this.TIER_5_KEYWORDS.some(kw => lower.includes(kw));
    const isComplexArchitecturePrompt =
      (lower.includes('refactor') && lower.includes('agent')) ||
      (lower.includes('checkpoint') && lower.includes('resilience')) ||
      (lower.includes('autonomous') && lower.length > 300);

    if (isTier5KeywordMatch || isComplexArchitecturePrompt) {
      return this.buildClassification(
        5,
        'Complex architectural scope detected requiring hierarchical decomposition, subtask validation, disk checkpointing, and budget governance.'
      );
    }

    // 3. Check Tier 1 (Instant / Conversational explicit patterns)
    for (const pattern of this.TIER_1_PATTERNS) {
      if (pattern.test(raw)) {
        return this.buildClassification(
          1,
          'Instant conversational query. Zero tools and zero planning overhead required.'
        );
      }
    }

    // 4. Check Tier 2 (Single-Tool Utility)
    for (const pattern of this.TIER_2_PATTERNS) {
      if (pattern.test(raw)) {
        return this.buildClassification(
          2,
          'Single read-only inspection tool required. Decomposition planner skipped.'
        );
      }
    }

    // 5. Check Tier 3 (Linear Workflow)
    for (const pattern of this.TIER_3_PATTERNS) {
      if (pattern.test(raw)) {
        return this.buildClassification(
          3,
          'Deterministic sequential workflow (single file modification / command execution with retries).'
        );
      }
    }

    // 6. Generic Tier 1 check for purely conversational short non-coding questions
    const hasCodeOrFile = /\b([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+|code|file|folder|dir|edit|create|build|run|test|fix|component|page|npm|git|tsc|grep)\b/i.test(raw);
    if (raw.length < 50 && !raw.includes('\n') && !hasCodeOrFile) {
      return this.buildClassification(
        1,
        'Short conversational query without coding or tool requirements.'
      );
    }

    // 6. Check Tier 4 vs Tier 5 by complexity
    const estimatedFiles = (raw.match(/\b[a-zA-Z0-9_-]+\.(tsx|ts|jsx|js|css|json|html|py)\b/g) || []).length;
    const actionWords = (raw.match(/\b(create|edit|update|delete|build|integrate|connect|wire|route)\b/gi) || []).length;

    if (estimatedFiles > 3 || actionWords > 4 || raw.length > 500) {
      return this.buildClassification(
        5,
        'Multi-component / deep system scope requiring hierarchical decomposition and checkpoint serialization.'
      );
    }

    // Default to Tier 4 (Multi-Artifact Task)
    return this.buildClassification(
      4,
      'Multi-artifact task requiring tool chaining, intermediate error verification, and rollback capability.'
    );
  }

  private static buildClassification(tier: AgentTier, reasoning: string): TierClassification {
    const tierMeta: Record<AgentTier, { name: string; fastPath: boolean; planning: boolean; checkpoint: boolean; budget: TaskBudget }> = {
      1: {
        name: 'Tier 1 (Instant / Conversational)',
        fastPath: true,
        planning: false,
        checkpoint: false,
        budget: { max_tokens: 3000, max_execution_time_ms: 3000, max_steps: 1 },
      },
      2: {
        name: 'Tier 2 (Single-Tool Utility)',
        fastPath: true,
        planning: false,
        checkpoint: false,
        budget: { max_tokens: 6000, max_execution_time_ms: 10000, max_steps: 2 },
      },
      3: {
        name: 'Tier 3 (Linear Workflow)',
        fastPath: false,
        planning: false,
        checkpoint: true,
        budget: { max_tokens: 15000, max_execution_time_ms: 25000, max_steps: 6 },
      },
      4: {
        name: 'Tier 4 (Multi-Artifact Task)',
        fastPath: false,
        planning: true,
        checkpoint: true,
        budget: { max_tokens: 35000, max_execution_time_ms: 60000, max_steps: 15 },
      },
      5: {
        name: 'Tier 5 (Long-Running / Deep System)',
        fastPath: false,
        planning: true,
        checkpoint: true,
        budget: { max_tokens: 80000, max_execution_time_ms: 180000, max_steps: 40 },
      },
    };

    const meta = tierMeta[tier];
    return {
      tier,
      tier_name: meta.name,
      confidence: 0.95,
      reasoning,
      fast_path_eligible: meta.fastPath,
      requires_planning: meta.planning,
      requires_checkpointing: meta.checkpoint,
      budget: meta.budget,
    };
  }
}
