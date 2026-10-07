# Autonomous Agent Refactor Prompt for Antigravity

# MISSION
You are an autonomous Senior Systems & Agentic Architect operating inside this VM environment. Your objective is to inspect, profile, and refactor the AI agent codebase located in this workspace to support reliable long-running autonomous workflows, eliminate context pollution across runs, and implement a tiered latency/execution engine.

---

## 1. ENVIRONMENT & RESOURCE CONSTRAINTS (VM SAFETY)
- **Work Directory:** Confine all file changes, scratchpads, and execution logs strictly to `./` (current repository root).
- **Concurrency & Resource Limits:** 
  - Never run resource-intensive operations in parallel (e.g., test suites, benchmarks, high-iteration agent loops, or LLM batching).
  - Use serialized process execution and monitor RAM/CPU before running stress tests:
    ```bash
    # Verify resource headroom before spawning heavy processes
    python3 -c "import psutil; assert psutil.virtual_memory().percent < 80, 'Memory threshold exceeded'"
    ```
- **Idempotency & Reversibility:** Create a clean git checkpoint branch (`git checkout -b refactor/agent-stability-tiering`) before making structural code changes.

---

## 2. CORE ARCHITECTURAL REQUIREMENTS TO IMPLEMENT

### A. Context Isolation & Ghost Task Elimination
- **Root Cause:** Eliminate state bleed where artifacts, failures, and intermediate messages from prior tasks leak into subsequent runs.
- **Implementation:**
  - Implement an explicit `SessionContext` lifecycle: `initialize()`, `checkpoint()`, `flush()`, and `teardown()`.
  - Enforce a strict boundary where conversation history and tool outputs are ephemeral by default unless explicitly tagged as persistent.
  - Implement an input sanitization hook that verifies the active prompt matches only current execution goals.

### B. Tiered Execution Router (Fast-Path vs. Deep-Path)
Refactor the agent dispatch mechanism into a strict 5-tier classification engine:
1. **Tier 1 (Instant / Conversational):** Zero tools, zero planning overhead, direct LLM generation (e.g., greetings, basic formatting). Target TTFT: `< 500ms`.
2. **Tier 2 (Single-Tool Utility):** Single read-only tool invocation, no decomposition planner.
3. **Tier 3 (Linear Workflow):** Deterministic sequential tool calls with standard retry logic.
4. **Tier 4 (Multi-Artifact Task):** Modular tool chaining with intermediate error verification and rollbacks.
5. **Tier 5 (Long-Running / Deep System):** Full hierarchical decomposition, recursive step validation, state serialization at every checkpoint, and budget limits (token & timeout).

### C. Long-Running Task Resiliency
- Implement durable checkpointing to disk (`state.json` or SQLite) after every discrete sub-task.
- Enable deterministic resume functionality: if interrupted or timed out, the agent must inspect the latest checkpoint and resume rather than re-running from step 0.
- Add an explicit circuit breaker for infinite loops, repeated tool failures, and redundant calls.

### D. Telemetry & JSON Diagnostic Loop
Standardize all run metrics into a structured telemetry format emitted on run completion:
```json
{
  "task_id": "uuid",
  "tier": 1,
  "status": "success | failed | timeout",
  "execution_time_ms": 0,
  "tokens_consumed": { "prompt": 0, "completion": 0 },
  "tools_invoked": [],
  "state_leakage_detected": false,
  "failure_reason": null
}
```

3. EXECUTION PROTOCOL
Execute this assignment methodically across four sequential phases:
Phase 1: Codebase Discovery & Root Cause Analysis
 * Scan repo architecture, agent runners, prompt loaders, and memory management layers.
 * Identify where historical state is stored and where memory bleeding occurs across task runs.
 * Output a concise markdown diagnostic summarizing the failure points.
Phase 2: Core Refactor
 * Implement the TieredRouter to split Tier 1 direct responses from Tier 5 deep tasks.
 * Build the ContextSanitizer to enforce memory zeroing between discrete task runs.
 * Implement checkpointing and serialization for long-running workflows.
Phase 3: Verification & Stress Testing
 * Add automated test cases covering:
   * Tier 1 execution (verifying zero tool calls and minimal latency).
   * Context pollution test (running a failing task followed by an unrelated query, verifying no cross-talk).
   * Long-running simulation (Tier 5 multi-step execution with a simulated crash and resume).
 * Run test suites sequentially to respect VM memory boundaries.
Phase 4: Delivery Summary
Provide a final report detailing:
 * Modified files and key architectural changes.
 * Benchmark results (latency on Tier 1 vs. reliability on Tier 5).
 * Instructions for running the new agent and monitoring diagnostics.
