/**
 * Core Type Definitions for Autonomous Agent Architecture
 * Tiered Execution Engine, Session Context Lifecycle, Telemetry, and Checkpointing
 */

export type AgentTier = 1 | 2 | 3 | 4 | 5;

export type TaskStatus = 'success' | 'failed' | 'timeout' | 'interrupted' | 'running';

export interface TokenUsage {
  prompt: number;
  completion: number;
  total?: number;
}

export interface AgentTelemetry {
  task_id: string;
  tier: AgentTier;
  status: 'success' | 'failed' | 'timeout';
  execution_time_ms: number;
  tokens_consumed: {
    prompt: number;
    completion: number;
  };
  tools_invoked: string[];
  state_leakage_detected: boolean;
  failure_reason: string | null;
}

export interface SessionMessage {
  id?: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCallDefinition[];
  tool_call_id?: string;
  name?: string;
  /** Ephemeral by default. Tagged true only when explicitly marked persistent across runs. */
  persistent?: boolean;
  taskId?: string;
  timestamp?: number;
}

export interface ToolCallDefinition {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolExecutionResult {
  tool: string;
  toolCallId?: string;
  arguments: Record<string, any>;
  output: any;
  success: boolean;
  error?: string;
  duration_ms?: number;
}

export interface ArtifactSnapshot {
  path: string;
  beforeContent: string | null;
  currentContent: string;
  modifiedAt: number;
}

export interface CircuitBreakerState {
  repeated_tool_count: Record<string, number>;
  consecutive_errors: number;
  loop_iterations: number;
  is_tripped: boolean;
  trip_reason?: string;
}

export interface TaskBudget {
  max_tokens: number;
  max_execution_time_ms: number;
  max_steps?: number;
}

export interface CompletedStep {
  step_id: string;
  title: string;
  tool: string;
  args: Record<string, any>;
  output: any;
  timestamp: number;
  success: boolean;
  duration_ms?: number;
}

export interface SubTaskPlan {
  step_id: string;
  title: string;
  description?: string;
  tool: string;
  expected_outcome?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  retry_count: number;
  max_retries: number;
}

export interface SessionCheckpoint {
  task_id: string;
  tier: AgentTier;
  goal: string;
  current_step_index: number;
  total_steps: number;
  status: TaskStatus;
  subtasks: SubTaskPlan[];
  completed_steps: CompletedStep[];
  artifacts_modified: Record<string, { before: string | null; current: string }>;
  tokens_consumed: { prompt: number; completion: number };
  circuit_breaker_state: CircuitBreakerState;
  budget: TaskBudget;
  created_at: number;
  updated_at: number;
}

export interface TierClassification {
  tier: AgentTier;
  tier_name: string;
  confidence: number;
  reasoning: string;
  fast_path_eligible: boolean;
  requires_planning: boolean;
  requires_checkpointing: boolean;
  budget: TaskBudget;
}

export interface AgentTaskInput {
  task_id?: string;
  prompt: string;
  tier_override?: AgentTier;
  budget_override?: Partial<TaskBudget>;
  environment?: Record<string, any>;
  initial_files?: Record<string, string>;
  resume_from_checkpoint?: boolean;
}

export interface AgentTaskResult {
  task_id: string;
  tier: AgentTier;
  status: 'success' | 'failed' | 'timeout';
  response: string;
  telemetry: AgentTelemetry;
  checkpoint?: SessionCheckpoint;
  steps_executed: number;
  tools_invoked: string[];
}
