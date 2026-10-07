/**
 * Autonomous Agent Circuit Breaker
 * Detects infinite loops, repeated tool failures, and redundant calls,
 * tripping safely to protect budget, memory, and runtime stability.
 */

import type { CircuitBreakerState } from './types.ts';

export interface CircuitBreakerOptions {
  maxConsecutiveErrors?: number;
  maxRepeatedToolCalls?: number;
  maxLoopIterations?: number;
  maxRedundantArgsThreshold?: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState;
  private readonly maxConsecutiveErrors: number;
  private readonly maxRepeatedToolCalls: number;
  private readonly maxLoopIterations: number;
  private readonly recentToolSignatures: Map<string, number> = new Map();

  constructor(initialState?: Partial<CircuitBreakerState>, options?: CircuitBreakerOptions) {
    this.maxConsecutiveErrors = options?.maxConsecutiveErrors ?? 4;
    this.maxRepeatedToolCalls = options?.maxRepeatedToolCalls ?? 4;
    this.maxLoopIterations = options?.maxLoopIterations ?? 25;

    this.state = {
      repeated_tool_count: { ...(initialState?.repeated_tool_count || {}) },
      consecutive_errors: initialState?.consecutive_errors ?? 0,
      loop_iterations: initialState?.loop_iterations ?? 0,
      is_tripped: initialState?.is_tripped ?? false,
      trip_reason: initialState?.trip_reason,
    };
  }

  /**
   * Record a turn iteration.
   */
  public recordIteration(): void {
    this.state.loop_iterations += 1;
    if (this.state.loop_iterations >= this.maxLoopIterations) {
      this.trip(`Max loop iterations exceeded (${this.state.loop_iterations}/${this.maxLoopIterations})`);
    }
  }

  /**
   * Record a tool invocation and inspect for duplicate signatures.
   */
  public recordToolCall(toolName: string, args: Record<string, any> | string): void {
    const rawArgs = typeof args === 'string' ? args : JSON.stringify(args);
    const signature = `${toolName}:${rawArgs}`;

    const count = (this.recentToolSignatures.get(signature) || 0) + 1;
    this.recentToolSignatures.set(signature, count);

    this.state.repeated_tool_count[toolName] = (this.state.repeated_tool_count[toolName] || 0) + 1;

    if (count >= this.maxRepeatedToolCalls) {
      this.trip(`Repeated identical tool invocation threshold reached for '${toolName}' (${count}x calls with same arguments)`);
    }
  }

  /**
   * Record tool success (resets consecutive error counter).
   */
  public recordSuccess(): void {
    this.state.consecutive_errors = 0;
  }

  /**
   * Record tool or turn error.
   */
  public recordError(errorMsg?: string): void {
    this.state.consecutive_errors += 1;
    if (this.state.consecutive_errors >= this.maxConsecutiveErrors) {
      this.trip(
        `Consecutive error threshold reached (${this.state.consecutive_errors}/${this.maxConsecutiveErrors}): ${errorMsg || 'Repeated failures'}`
      );
    }
  }

  public isTripped(): boolean {
    return this.state.is_tripped;
  }

  public getTripReason(): string | undefined {
    return this.state.trip_reason;
  }

  public getState(): CircuitBreakerState {
    return {
      ...this.state,
      repeated_tool_count: { ...this.state.repeated_tool_count },
    };
  }

  private trip(reason: string): void {
    this.state.is_tripped = true;
    this.state.trip_reason = reason;
  }
}
