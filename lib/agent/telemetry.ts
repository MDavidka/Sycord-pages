/**
 * Telemetry & JSON Diagnostic Engine
 * Standardizes run metrics and emits structured diagnostics on task completion.
 */

import type { AgentTelemetry, AgentTier, TaskStatus } from './types.ts';

export class TelemetryCollector {
  public readonly taskId: string;
  public readonly tier: AgentTier;
  private readonly startTime: number;
  private endTime: number | null = null;
  private status: 'success' | 'failed' | 'timeout' = 'success';
  private promptTokens = 0;
  private completionTokens = 0;
  private toolsInvoked: Set<string> = new Set();
  private stateLeakageDetected = false;
  private failureReason: string | null = null;

  constructor(taskId: string, tier: AgentTier, initialTokens?: { prompt: number; completion: number }) {
    this.taskId = taskId;
    this.tier = tier;
    this.startTime = Date.now();
    if (initialTokens) {
      this.promptTokens = initialTokens.prompt || 0;
      this.completionTokens = initialTokens.completion || 0;
    }
  }

  public recordTokens(prompt: number, completion: number): void {
    this.promptTokens += prompt;
    this.completionTokens += completion;
  }

  public recordToolInvocation(toolName: string): void {
    if (toolName) {
      this.toolsInvoked.add(toolName);
    }
  }

  public markStateLeakage(detected: boolean = true): void {
    this.stateLeakageDetected = detected;
  }

  public setStatus(status: 'success' | 'failed' | 'timeout', failureReason?: string | null): void {
    this.status = status;
    if (failureReason !== undefined) {
      this.failureReason = failureReason;
    }
  }

  public finalize(finalStatus?: 'success' | 'failed' | 'timeout', failureReason?: string | null): AgentTelemetry {
    if (finalStatus) {
      this.status = finalStatus;
    }
    if (failureReason !== undefined) {
      this.failureReason = failureReason;
    }
    this.endTime = Date.now();

    return this.toJSON();
  }

  public toJSON(): AgentTelemetry {
    const duration = (this.endTime || Date.now()) - this.startTime;
    return {
      task_id: this.taskId,
      tier: this.tier,
      status: this.status,
      execution_time_ms: Math.max(0, duration),
      tokens_consumed: {
        prompt: this.promptTokens,
        completion: this.completionTokens,
      },
      tools_invoked: Array.from(this.toolsInvoked),
      state_leakage_detected: this.stateLeakageDetected,
      failure_reason: this.failureReason ?? null,
    };
  }

  /**
   * Validate that a telemetry object strictly conforms to the required JSON schema.
   */
  public static validateTelemetry(obj: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!obj || typeof obj !== 'object') {
      return { valid: false, errors: ['Telemetry must be an object'] };
    }

    if (typeof obj.task_id !== 'string' || !obj.task_id.trim()) {
      errors.push('task_id must be a non-empty string');
    }

    if (typeof obj.tier !== 'number' || obj.tier < 1 || obj.tier > 5) {
      errors.push('tier must be an integer between 1 and 5');
    }

    if (obj.status !== 'success' && obj.status !== 'failed' && obj.status !== 'timeout') {
      errors.push("status must be 'success' | 'failed' | 'timeout'");
    }

    if (typeof obj.execution_time_ms !== 'number' || obj.execution_time_ms < 0) {
      errors.push('execution_time_ms must be a non-negative number');
    }

    if (!obj.tokens_consumed || typeof obj.tokens_consumed !== 'object') {
      errors.push('tokens_consumed must be an object with prompt and completion counts');
    } else {
      if (typeof obj.tokens_consumed.prompt !== 'number') errors.push('tokens_consumed.prompt must be a number');
      if (typeof obj.tokens_consumed.completion !== 'number') errors.push('tokens_consumed.completion must be a number');
    }

    if (!Array.isArray(obj.tools_invoked)) {
      errors.push('tools_invoked must be an array of strings');
    }

    if (typeof obj.state_leakage_detected !== 'boolean') {
      errors.push('state_leakage_detected must be a boolean');
    }

    if (obj.failure_reason !== null && typeof obj.failure_reason !== 'string') {
      errors.push('failure_reason must be string or null');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
