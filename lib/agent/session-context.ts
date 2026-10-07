/**
 * SessionContext Lifecycle Engine
 * Implements strict context isolation, ephemeral/persistent boundary enforcement,
 * and lifecycle methods: initialize(), checkpoint(), flush(), teardown().
 */

import type {
  AgentTier,
  CircuitBreakerState,
  CompletedStep,
  SessionCheckpoint,
  SessionMessage,
  SubTaskPlan,
  TaskBudget,
  TaskStatus,
} from './types.ts';

export interface SessionContextOptions {
  tier?: AgentTier;
  budget?: Partial<TaskBudget>;
  checkpointDir?: string;
  onCheckpoint?: (checkpoint: SessionCheckpoint) => Promise<void> | void;
}

export class SessionContext {
  public readonly taskId: string;
  public readonly goal: string;
  public readonly tier: AgentTier;
  public readonly createdAt: number;
  public updatedAt: number;
  public status: TaskStatus = 'running';

  public budget: TaskBudget;
  private messages: SessionMessage[] = [];
  private subtasks: SubTaskPlan[] = [];
  private completedSteps: CompletedStep[] = [];
  private artifactsModified: Map<string, { before: string | null; current: string }> = new Map();
  private circuitBreakerState: CircuitBreakerState = {
    repeated_tool_count: {},
    consecutive_errors: 0,
    loop_iterations: 0,
    is_tripped: false,
  };
  private tokensConsumed = { prompt: 0, completion: 0 };
  private activeCheckpointListeners: Array<(checkpoint: SessionCheckpoint) => Promise<void> | void> = [];
  private isTornDown = false;

  private constructor(taskId: string, goal: string, options?: SessionContextOptions) {
    this.taskId = taskId;
    this.goal = goal;
    this.tier = options?.tier ?? 1;
    this.createdAt = Date.now();
    this.updatedAt = this.createdAt;

    const defaultBudget: TaskBudget = {
      max_tokens: this.tier === 1 ? 4000 : this.tier === 2 ? 8000 : this.tier === 3 ? 20000 : this.tier === 4 ? 40000 : 80000,
      max_execution_time_ms: this.tier === 1 ? 5000 : this.tier === 2 ? 15000 : this.tier === 3 ? 30000 : this.tier === 4 ? 60000 : 180000,
      max_steps: this.tier === 1 ? 1 : this.tier === 2 ? 2 : this.tier === 3 ? 5 : this.tier === 4 ? 12 : 30,
    };

    this.budget = {
      ...defaultBudget,
      ...options?.budget,
    };

    if (options?.onCheckpoint) {
      this.activeCheckpointListeners.push(options.onCheckpoint);
    }
  }

  /**
   * Initialize a new isolated SessionContext for a task run.
   */
  public static initialize(
    taskId: string,
    goal: string,
    options?: SessionContextOptions
  ): SessionContext {
    const ctx = new SessionContext(taskId, goal, options);
    // Add initial sanitized goal as ephemeral user message
    ctx.addMessage({
      role: 'user',
      content: goal,
      persistent: false, // Ephemeral by default
      taskId,
      timestamp: Date.now(),
    });
    return ctx;
  }

  /**
   * Resume an existing SessionContext from a disk checkpoint.
   */
  public static fromCheckpoint(
    checkpoint: SessionCheckpoint,
    options?: Partial<SessionContextOptions>
  ): SessionContext {
    const ctx = new SessionContext(checkpoint.task_id, checkpoint.goal, {
      tier: checkpoint.tier,
      budget: { ...checkpoint.budget, ...options?.budget },
      onCheckpoint: options?.onCheckpoint,
    });

    ctx.status = checkpoint.status === 'interrupted' || checkpoint.status === 'timeout' || checkpoint.status === 'failed' ? 'running' : checkpoint.status;
    ctx.subtasks = checkpoint.subtasks ? checkpoint.subtasks.map(s => ({ ...s })) : [];
    ctx.completedSteps = checkpoint.completed_steps ? checkpoint.completed_steps.map(s => ({ ...s })) : [];
    ctx.tokensConsumed = { ...(checkpoint.tokens_consumed || { prompt: 0, completion: 0 }) };
    ctx.circuitBreakerState = {
      repeated_tool_count: { ...(checkpoint.circuit_breaker_state?.repeated_tool_count || {}) },
      consecutive_errors: checkpoint.circuit_breaker_state?.consecutive_errors ?? 0,
      loop_iterations: checkpoint.circuit_breaker_state?.loop_iterations ?? 0,
      is_tripped: checkpoint.circuit_breaker_state?.is_tripped ?? false,
      trip_reason: checkpoint.circuit_breaker_state?.trip_reason,
    };
    ctx.updatedAt = Date.now();

    for (const [path, diff] of Object.entries(checkpoint.artifacts_modified || {})) {
      ctx.artifactsModified.set(path, { ...diff });
    }

    return ctx;
  }

  /**
   * Add a message to the session context.
   * Default: ephemeral (persistent = false) unless explicitly tagged persistent.
   */
  public addMessage(message: Omit<SessionMessage, 'taskId'> & { taskId?: string }): void {
    if (this.isTornDown) throw new Error(`Cannot add message to torn-down session ${this.taskId}`);
    this.messages.push({
      ...message,
      persistent: Boolean(message.persistent),
      taskId: this.taskId,
      timestamp: message.timestamp || Date.now(),
    });
    this.updatedAt = Date.now();
  }

  /**
   * Get messages formatted for model consumption.
   * By default returns active session messages.
   * Can filter for persistent only or active execution scope.
   */
  public getMessages(options?: { persistentOnly?: boolean; includeSystem?: boolean }): SessionMessage[] {
    let result = [...this.messages];
    if (options?.persistentOnly) {
      result = result.filter(m => m.persistent || m.role === 'system');
    }
    if (options?.includeSystem === false) {
      result = result.filter(m => m.role !== 'system');
    }
    return result;
  }

  /**
   * Record token consumption.
   */
  public recordTokens(promptTokens: number, completionTokens: number): void {
    this.tokensConsumed.prompt += promptTokens;
    this.tokensConsumed.completion += completionTokens;
    this.updatedAt = Date.now();
  }

  public getTokensConsumed(): { prompt: number; completion: number; total: number } {
    return {
      prompt: this.tokensConsumed.prompt,
      completion: this.tokensConsumed.completion,
      total: this.tokensConsumed.prompt + this.tokensConsumed.completion,
    };
  }

  /**
   * Record an artifact modification for atomic rollbacks and tracking.
   */
  public recordArtifactChange(path: string, currentContent: string, beforeContent?: string | null): void {
    const existing = this.artifactsModified.get(path);
    const initialBefore = existing ? existing.before : (beforeContent !== undefined ? beforeContent : null);
    this.artifactsModified.set(path, {
      before: initialBefore,
      current: currentContent,
    });
    this.updatedAt = Date.now();
  }

  public getArtifactModifications(): Record<string, { before: string | null; current: string }> {
    const res: Record<string, { before: string | null; current: string }> = {};
    for (const [path, diff] of this.artifactsModified.entries()) {
      res[path] = { ...diff };
    }
    return res;
  }

  /**
   * Register subtasks for Tier 4/5 hierarchical planning.
   */
  public setSubtasks(subtasks: SubTaskPlan[]): void {
    this.subtasks = subtasks.map(s => ({ ...s }));
    this.updatedAt = Date.now();
  }

  public getSubtasks(): SubTaskPlan[] {
    return this.subtasks.map(s => ({ ...s }));
  }

  public getNextPendingSubtask(): SubTaskPlan | null {
    return this.subtasks.find(s => s.status === 'pending' || s.status === 'in_progress') || null;
  }

  /**
   * Record a completed discrete subtask step.
   */
  public recordCompletedStep(step: CompletedStep): void {
    this.completedSteps.push({ ...step });
    const subtask = this.subtasks.find(s => s.step_id === step.step_id);
    if (subtask) {
      subtask.status = step.success ? 'completed' : 'failed';
    }
    this.updatedAt = Date.now();
  }

  public getCompletedSteps(): CompletedStep[] {
    return this.completedSteps.map(s => ({ ...s }));
  }

  /**
   * Update circuit breaker tracking state.
   */
  public updateCircuitBreaker(stateOrUpdater: CircuitBreakerState | ((state: CircuitBreakerState) => void)): void {
    if (typeof stateOrUpdater === 'function') {
      stateOrUpdater(this.circuitBreakerState);
    } else {
      this.circuitBreakerState = {
        repeated_tool_count: { ...(stateOrUpdater.repeated_tool_count || {}) },
        consecutive_errors: stateOrUpdater.consecutive_errors ?? 0,
        loop_iterations: stateOrUpdater.loop_iterations ?? 0,
        is_tripped: stateOrUpdater.is_tripped ?? false,
        trip_reason: stateOrUpdater.trip_reason,
      };
    }
    this.updatedAt = Date.now();
  }

  public getCircuitBreakerState(): CircuitBreakerState {
    return {
      ...this.circuitBreakerState,
      repeated_tool_count: { ...this.circuitBreakerState.repeated_tool_count },
    };
  }

  /**
   * Checkpoint the current session state.
   * Emits checkpoint payload to registered disk listeners and returns serialized snapshot.
   */
  public async checkpoint(statusOverride?: TaskStatus): Promise<SessionCheckpoint> {
    if (statusOverride) {
      this.status = statusOverride;
    }
    this.updatedAt = Date.now();

    const snapshot: SessionCheckpoint = {
      task_id: this.taskId,
      tier: this.tier,
      goal: this.goal,
      current_step_index: this.completedSteps.length,
      total_steps: this.subtasks.length || this.completedSteps.length,
      status: this.status,
      subtasks: this.subtasks.map(s => ({ ...s })),
      completed_steps: this.completedSteps.map(s => ({ ...s })),
      artifacts_modified: this.getArtifactModifications(),
      tokens_consumed: { ...this.tokensConsumed },
      circuit_breaker_state: this.getCircuitBreakerState(),
      budget: { ...this.budget },
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };

    for (const listener of this.activeCheckpointListeners) {
      try {
        await listener(snapshot);
      } catch (err) {
        console.error(`[SessionContext] Checkpoint listener error:`, err);
      }
    }

    return snapshot;
  }

  /**
   * Flush context to eliminate state bleed.
   * By default flushes all ephemeral messages, intermediate tool results,
   * and unpersisted draft states, leaving only persistent tagged elements.
   */
  public flush(scope: 'ephemeral_only' | 'all' = 'ephemeral_only'): void {
    if (scope === 'all') {
      this.messages = [];
      this.artifactsModified.clear();
      this.subtasks = [];
      this.completedSteps = [];
      this.circuitBreakerState = {
        repeated_tool_count: {},
        consecutive_errors: 0,
        loop_iterations: 0,
        is_tripped: false,
      };
    } else {
      // Ephemeral only: retain only persistent tagged messages and baseline system messages
      this.messages = this.messages.filter(m => m.persistent || m.role === 'system');
    }
    this.updatedAt = Date.now();
  }

  /**
   * Teardown the session context.
   * Ensures clean termination, memory release, and final checkpoint creation.
   */
  public async teardown(finalStatus: TaskStatus = 'success'): Promise<SessionCheckpoint> {
    if (this.isTornDown) {
      return this.checkpoint();
    }
    this.status = finalStatus;
    const finalCheckpoint = await this.checkpoint(finalStatus);
    this.isTornDown = true;
    this.activeCheckpointListeners = [];
    return finalCheckpoint;
  }

  /**
   * Check if any cross-talk or state leakage occurred.
   */
  public verifyNoStateLeakage(unrelatedTaskId?: string): boolean {
    if (!unrelatedTaskId) return true;
    const hasLeakedMessage = this.messages.some(m => m.taskId === unrelatedTaskId);
    return !hasLeakedMessage;
  }
}
