# Agent Codebase Discovery & Root Cause Diagnostic

## Executive Summary
This diagnostic reviews the agent architecture across `glovix/components/Chat.tsx`, `glovix/lib/project-agent.ts`, `glovix/lib/project-context.ts`, `glovix/store/index.ts`, and `app/api/projects/[id]/agent/route.ts`. 

The analysis identified four major architectural deficiencies causing latency bottlenecks, state pollution ("ghost tasks"), and fragile long-running execution.

---

## 1. Root Cause Analysis: Context Bleed & Ghost Tasks

### Failure Point 1: Persistent Unscoped Plan Leakage (Ghost Task Trigger)
- **Location:** `glovix/components/Chat.tsx` (Lines 2831–2844) & `glovix/store/index.ts`
- **Mechanism:** Global Zustand store retains `generationPlan` across chat turns. When a new, unrelated user prompt is submitted, the agent loop checks `useStore.getState().generationPlan`. If steps from a prior aborted or failed task remain marked as `in_progress` or `pending`, the agent injects an autonomous directive:
  `[Autonomous Execution Directive]: Incomplete plan steps remain for '...'`
- **Impact:** The agent attempts to complete previous failed/abandoned tasks instead of executing the user's active goal.

### Failure Point 2: Unfiltered Ephemeral Context Accumulation
- **Location:** `glovix/components/Chat.tsx` (Lines 2522–2560)
- **Mechanism:** Conversation history sends all historical messages, including massive tool outputs (raw file contents, compilation errors, stack traces). Ephemeral tool outputs are not flushed or pruned between distinct tasks.
- **Impact:** Context pollution leads to LLM hallucination, token budget exhaustion, and degradation in instruction following.

### Failure Point 3: Unconditional Memory Injection
- **Location:** `glovix/lib/project-context.ts` (Lines 11–67)
- **Mechanism:** `buildInjectedProjectContext` unconditionally loads `.glovix/deep-memory.md`, `.glovix/context.md`, `.glovix/glovix.md`, and all `.glovix/knowledge/*.md` files into every single turn's system prompt (up to 14,000 characters), regardless of task relevance.
- **Impact:** Substantial TTFT latency overhead and prompt dilution on simple conversational queries.

---

## 2. Lack of Tiered Execution Engine

- **Mechanism:** The current dispatch mechanism uses a monolithic loop (up to 80 turns) for all inputs. There is no fast-path router to differentiate a simple greeting ("hello") from a single read ("show package.json") or a full multi-file refactor.
- **Impact:** Unnecessary planning overhead, delayed TTFT (>2500ms for simple greetings), and wasted token consumption.

---

## 3. Long-Running Workflow Fragility & Checkpointing Gaps

- **Mechanism:** Intermediate execution state (file snapshots, step progress, retry budgets) is stored only in ephemeral memory.
- **Impact:** If the runtime process crashes, times out, or encounters a transient failure during a multi-step task, all progress is lost and the agent restarts from step 0. There is no disk-backed checkpointing (`state.json` / SQLite) or rollback capability for corrupted artifacts.

---

## 4. Telemetry & Diagnostic Deficits

- **Mechanism:** Telemetry is emitted via fragmented `console.log` statements and inconsistent activity events.
- **Impact:** Inability to detect state leakage, measure token consumption by tier, or programmatically diagnose failure modes.

---

## 5. Architectural Remediation Plan

1. **`SessionContext` Lifecycle & `ContextSanitizer`:** Implement `initialize()`, `checkpoint()`, `flush()`, and `teardown()` with explicit ephemeral vs. persistent tagging and prompt goal alignment.
2. **`TieredRouter` (Tiers 1–5):** Classify tasks before dispatch:
   - **Tier 1 (Instant):** Zero tools, zero planning overhead, direct LLM generation (< 500ms TTFT).
   - **Tier 2 (Single-Tool):** Single read-only tool invocation, no decomposition planner.
   - **Tier 3 (Linear Workflow):** Deterministic sequential tool calls with retry logic.
   - **Tier 4 (Multi-Artifact):** Modular tool chaining with intermediate error verification and rollback.
   - **Tier 5 (Long-Running System):** Hierarchical decomposition, recursive step validation, state serialization at every checkpoint, and token/timeout budgets.
3. **Durable Checkpoint Manager & Resilient Resume:** Atomic `state.json` persistence, automatic step recovery, and circuit breakers for infinite loops/redundant calls.
4. **Telemetry & JSON Diagnostics:** Standardized completion metrics with state leakage detection.
